const FOV = Math.PI / 2;
const NUM_RAYS = 250;
const RULER_HEIGHT = 20;
const WALL_HEIGHT_FACTOR = 120;
const AUTO_STEP_DELAY_MS = 300;
const RAY_BATCH_SIZE = 10;
const RAY_LENGTH = 1000;

const STOP_ERROR = 'RENDER_STOPPED';

export const ALGORITHM_DESCRIPTIONS = Object.freeze({
  painter:
    'Алгоритм художника (back-to-front): стены сортируются от дальних к ближним. Для каждого луча проверяются все стены в этом порядке, ближние перезаписывают дальние.',
  raycasting:
    'Raycasting: для каждого столбца экрана из позиции игрока выпускается луч. Он пошагово проходит по клеткам карты, пока не встретит стену; используется расстояние до первой найденной стены. Этот метод применялся в Wolfenstein 3D.',
  bsp:
    'BSP (front-to-back): стены обрабатываются от ближних к дальним. Буфер глубины отсекает дальние стены — если пиксель уже занят, новая стена его не перезаписывает. Экономит отрисовку. Гений Кармака.',
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function rayIntersect(rx, ry, ra, wall) {
  const { x1, y1, x2, y2 } = wall;
  const x3 = rx;
  const y3 = ry;
  const x4 = rx + Math.cos(ra) * RAY_LENGTH;
  const y4 = ry + Math.sin(ra) * RAY_LENGTH;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0001) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u > 0) {
    return { dist: u * RAY_LENGTH, wallIndex: wall.index };
  }
  return null;
}

function midpointDistance(wall, player) {
  const mx = (wall.x1 + wall.x2) / 2;
  const my = (wall.y1 + wall.y2) / 2;
  return Math.hypot(mx - player.x, my - player.y);
}

function indexedWalls(walls) {
  return walls.map((wall, index) => ({ ...wall, index }));
}

export class Renderer3D {
  #canvas;
  #ctx;
  #sceneProvider;
  #ui;

  #width = 800;
  #height = 600;

  #isRendering = false;
  #stepMode = false;
  #stepResolve = null;
  #shouldStop = false;
  #columnFilled = new Array(NUM_RAYS).fill(false);

  #algorithms;
  #resizeTimeout = null;
  #boundResize;

  constructor({ canvas, sceneProvider, ui }) {
    if (!canvas) {
      throw new Error('Renderer3D: canvas is required');
    }
    if (typeof sceneProvider !== 'function') {
      throw new Error('Renderer3D: sceneProvider must be a function');
    }

    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this.#sceneProvider = sceneProvider;
    this.#ui = ui;

    this.#algorithms = {
      raycasting: this.#renderRaycasting.bind(this),
      painter: this.#renderPainter.bind(this),
      bsp: this.#renderBSP.bind(this),
    };

    this.#boundResize = this.#handleWindowResize.bind(this);

    this.#initUI();
    this.resize();
    window.addEventListener('resize', this.#boundResize);
  }

  destroy() {
    window.removeEventListener('resize', this.#boundResize);
    if (this.#resizeTimeout) clearTimeout(this.#resizeTimeout);
    this.stop();
  }

  resize() {
    const container = this.#canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.#width = Math.floor(rect.width * dpr);
    this.#height = Math.floor(rect.height * dpr);

    this.#canvas.width = this.#width;
    this.#canvas.height = this.#height;
    this.#canvas.style.width = `${rect.width}px`;
    this.#canvas.style.height = `${rect.height}px`;

    if (!this.#isRendering) {
      this.#clearAndPaintBackground();
      if (this.#ui.algorithmSelect?.value === 'bsp') this.#drawCoverageRuler();
    }
  }

  clearCanvas() {
    this.#columnFilled.fill(false);
    this.#clearAndPaintBackground();
    if (this.#ui.statsEl) this.#ui.statsEl.textContent = '';
    if (this.#ui.orderDisplay) this.#ui.orderDisplay.textContent = '';
  }

  async start() {
    if (this.#isRendering) return;

    const { walls } = this.#sceneProvider();
    if (!walls.length) {
      alert('Сначала нарисуйте стены!');
      return;
    }

    this.#isRendering = true;
    this.#shouldStop = false;
    this.#stepMode = !!this.#ui.stepModeCheckbox?.checked;

    this.#setControlState({ rendering: true });
    if (this.#ui.statsEl) this.#ui.statsEl.textContent = '';

    const algorithmKey = this.#ui.algorithmSelect?.value ?? 'painter';
    const algorithm = this.#algorithms[algorithmKey];

    try {
      if (!algorithm) throw new Error(`Unknown algorithm: ${algorithmKey}`);
      await algorithm();
    } catch (error) {
      if (error?.message !== STOP_ERROR) throw error;
    } finally {
      this.#isRendering = false;
      this.#stepResolve = null;
      this.#setControlState({ rendering: false });
    }
  }

  stop() {
    if (!this.#isRendering) return;
    this.#shouldStop = true;
    if (this.#stepResolve) {
      const resolve = this.#stepResolve;
      this.#stepResolve = null;
      resolve();
    }
  }

  step() {
    if (!this.#stepResolve) return;
    if (this.#ui.stepBtn) this.#ui.stepBtn.disabled = true;
    const resolve = this.#stepResolve;
    this.#stepResolve = null;
    resolve();
  }

  #initUI() {
    const { algorithmSelect, algoDesc, orderDisplay } = this.#ui;
    if (!algorithmSelect) return;

    algoDesc.textContent =
      ALGORITHM_DESCRIPTIONS[algorithmSelect.value] ??
      ALGORITHM_DESCRIPTIONS.painter;

    algorithmSelect.addEventListener('change', () => {
      algoDesc.textContent =
        ALGORITHM_DESCRIPTIONS[algorithmSelect.value] ?? '';
      if (orderDisplay) orderDisplay.textContent = '';
    });
  }

  #handleWindowResize() {
    if (this.#resizeTimeout) clearTimeout(this.#resizeTimeout);
    this.#resizeTimeout = setTimeout(() => this.resize(), 100);
  }

  #setControlState({ rendering }) {
    const { renderBtn, stopBtn, stepBtn, stepModeCheckbox } = this.#ui;
    if (renderBtn) renderBtn.disabled = rendering;
    if (stopBtn) stopBtn.disabled = !rendering;
    if (stepModeCheckbox) stepModeCheckbox.disabled = rendering;
    if (stepBtn) stepBtn.disabled = !(rendering && this.#stepMode);
  }

  async #waitForNextStep() {
    if (this.#shouldStop) throw new Error(STOP_ERROR);

    if (this.#stepMode) {
      if (this.#ui.stepBtn) this.#ui.stepBtn.disabled = false;
      return new Promise((resolve) => {
        this.#stepResolve = resolve;
      });
    }

    return sleep(AUTO_STEP_DELAY_MS);
  }

  #clearAndPaintBackground() {
    const ctx = this.#ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.#width, this.#height);
    this.#drawBackground();
  }

  #drawBackground() {
    const ctx = this.#ctx;
    const w = this.#width;
    const h = this.#height;

    const sky = ctx.createLinearGradient(0, 0, 0, h / 2);
    sky.addColorStop(0, '#1a1a3a');
    sky.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h / 2);

    const floor = ctx.createLinearGradient(0, h / 2, 0, h - RULER_HEIGHT);
    floor.addColorStop(0, '#1a1a1a');
    floor.addColorStop(1, '#2a2a2a');
    ctx.fillStyle = floor;
    ctx.fillRect(0, h / 2, w, h / 2 - RULER_HEIGHT);
  }

  #drawColumn(x, dist, wallIndex, rayAngle, playerAngle) {
    const corrected = dist * Math.cos(rayAngle - playerAngle);
    const wallH = Math.min(
      (this.#height * WALL_HEIGHT_FACTOR) / corrected,
      this.#height - RULER_HEIGHT,
    );
    const wallTop = (this.#height - RULER_HEIGHT - wallH) / 2;

    const hue = (wallIndex * 47) % 360;
    const bright = Math.max(20, 65 - corrected / 6);
    const columnWidth = this.#width / NUM_RAYS;

    this.#ctx.fillStyle = `hsl(${hue}, 60%, ${bright}%)`;
    this.#ctx.fillRect(x * columnWidth, wallTop, columnWidth + 1, wallH);

    this.#columnFilled[x] = true;
  }

  #drawCoverageRuler() {
    const ctx = this.#ctx;
    const w = this.#width;
    const h = this.#height;
    const rulerY = h - RULER_HEIGHT;
    const columnWidth = w / NUM_RAYS;

    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, rulerY, w, RULER_HEIGHT);

    const filledCount = this.#columnFilled.reduce(
      (acc, filled) => acc + (filled ? 1 : 0),
      0,
    );
    const coveragePercent = (filledCount / NUM_RAYS) * 100;

    ctx.fillStyle = coveragePercent === 100 ? '#00ff88' : '#00d4ff';
    for (let i = 0; i < NUM_RAYS; i++) {
      if (this.#columnFilled[i]) {
        ctx.fillRect(i * columnWidth, rulerY, columnWidth + 1, RULER_HEIGHT);
      }
    }

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i <= NUM_RAYS; i++) {
      const x = i * columnWidth;
      ctx.beginPath();
      ctx.moveTo(x, rulerY);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${coveragePercent.toFixed(1)}%`, w / 2, rulerY + RULER_HEIGHT / 2 + 4);

    return coveragePercent;
  }

  #paintColumnBuffer(player, columnData) {
    this.#drawBackground();
    for (let i = 0; i < NUM_RAYS; i++) {
      const data = columnData[i];
      if (data) {
        this.#drawColumn(i, data.dist, data.wallIndex, data.rayAngle, player.angle);
      }
    }
  }

  async #renderRaycasting() {
    const { walls, player } = this.#sceneProvider();
    this.#columnFilled.fill(false);
    this.#clearAndPaintBackground();

    const wallList = indexedWalls(walls);
    let totalChecks = 0;

    for (let i = 0; i < NUM_RAYS; i++) {
      const rayAngle = player.angle - FOV / 2 + (i / NUM_RAYS) * FOV;
      let closestDist = Infinity;
      let hitIndex = -1;

      for (const wall of wallList) {
        totalChecks++;
        const hit = rayIntersect(player.x, player.y, rayAngle, wall);
        if (hit && hit.dist < closestDist) {
          closestDist = hit.dist;
          hitIndex = wall.index;
        }
      }

      if (hitIndex >= 0) {
        this.#drawColumn(i, closestDist, hitIndex, rayAngle, player.angle);
      }

      if (i % RAY_BATCH_SIZE === 0) {
        await this.#waitForNextStep();
      }
    }

    this.#setStats(
      `Raycasting: ${NUM_RAYS} лучей × ${wallList.length} стен = ${totalChecks} проверок`,
    );
    this.#setOrder('Порядок: все стены проверяются для каждого луча');
  }

  async #renderPainter() {
    const { walls, player } = this.#sceneProvider();
    this.#columnFilled.fill(false);
    this.#clearAndPaintBackground();

    const wallList = indexedWalls(walls)
      .map((wall) => ({ ...wall, dist: midpointDistance(wall, player) }))
      .sort((a, b) => b.dist - a.dist);

    this.#setOrder(
      `Порядок отрисовки (back→front): [${wallList.map((w) => w.index).join(' → ')}]`,
    );

    const columnData = new Array(NUM_RAYS).fill(null);

    for (const wall of wallList) {
      for (let i = 0; i < NUM_RAYS; i++) {
        const rayAngle = player.angle - FOV / 2 + (i / NUM_RAYS) * FOV;
        const hit = rayIntersect(player.x, player.y, rayAngle, wall);
        if (hit) {
          columnData[i] = { dist: hit.dist, wallIndex: wall.index, rayAngle };
        }
      }

      await this.#waitForNextStep();
      this.#paintColumnBuffer(player, columnData);
    }

    this.#setStats(`Painter: ${wallList.length} стен (дальние → ближние)`);
  }

  async #renderBSP() {
    const { walls, player } = this.#sceneProvider();
    this.#columnFilled.fill(false);
    this.#clearAndPaintBackground();

    const wallList = indexedWalls(walls);
    const orderedWalls = [...wallList].sort(
      (a, b) => midpointDistance(a, player) - midpointDistance(b, player),
    );

    this.#setOrder(
      `Порядок обхода BSP (front→back): [${orderedWalls.map((w) => w.index).join(' → ')}]`,
    );

    const depthBuffer = new Array(NUM_RAYS).fill(Infinity);
    const columnData = new Array(NUM_RAYS).fill(null);

    let wallsProcessed = 0;
    let earlyExit = false;

    for (const wall of orderedWalls) {
      for (let i = 0; i < NUM_RAYS; i++) {
        const rayAngle = player.angle - FOV / 2 + (i / NUM_RAYS) * FOV;
        const hit = rayIntersect(player.x, player.y, rayAngle, wall);
        if (hit && hit.dist < depthBuffer[i]) {
          depthBuffer[i] = hit.dist;
          columnData[i] = { dist: hit.dist, wallIndex: wall.index, rayAngle };
        }
      }

      wallsProcessed++;
      await this.#waitForNextStep();
      this.#paintColumnBuffer(player, columnData);

      const coverage = this.#drawCoverageRuler();
      if (coverage >= 100) {
        earlyExit = true;
        this.#setStats(
          `BSP: ${wallsProcessed} из ${orderedWalls.length} стен обработано (раннее завершение при 100% заполнении)`,
        );
        break;
      }
    }

    if (!earlyExit) {
      this.#setStats(`BSP: ${orderedWalls.length} стен (ближние → дальние)`);
    }
  }

  #setStats(text) {
    if (this.#ui.statsEl) this.#ui.statsEl.textContent = text;
  }

  #setOrder(text) {
    if (this.#ui.orderDisplay) this.#ui.orderDisplay.textContent = text;
  }
}
