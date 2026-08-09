const EDITOR_SIZE = 400;
const GRID_STEP = 40;
const FOV = Math.PI / 2;
const VIEW_INDICATOR_LENGTH = 40;
const FOV_INDICATOR_LENGTH = 80;
const MIN_DRAG_DISTANCE = 10;

const COLORS = {
  WALL: 'rgba(128, 128, 128, 0.4)',
  GUIDE: 'rgba(128, 128, 128, 0.5)',
  PREVIEW: 'rgba(255, 255, 255, 0.5)',
  PLAYER: '#00d4ff',
  PLAYER_VIEW: 'rgba(0, 212, 255, 0.3)',
};

const DEMO_WALLS = Object.freeze([
  { x1: 50, y1: 50, x2: 300, y2: 50 },
  { x1: 300, y1: 50, x2: 300, y2: 150 },
  { x1: 50, y1: 50, x2: 50, y2: 200 },
  { x1: 50, y1: 200, x2: 150, y2: 200 },
  { x1: 150, y1: 120, x2: 220, y2: 120 },
  { x1: 220, y1: 120, x2: 220, y2: 200 },
  { x1: 50, y1: 300, x2: 210, y2: 230 },
  { x1: 250, y1: 220, x2: 350, y2: 280 },
]);

function getEventCoordinates(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const source =
    event.touches?.[0] ?? event.changedTouches?.[0] ?? event;

  return {
    x: (source.clientX - rect.left) * (canvas.width / rect.width),
    y: (source.clientY - rect.top) * (canvas.height / rect.height),
  };
}

export class MapEditor {
  #canvas;
  #ctx;
  #size;

  #walls = [];
  #guideLines = [];
  #player = { x: 350, y: 350, angle: -Math.PI * 0.75 };

  #currentTool = 'wall';
  #isDrawing = false;
  #startPoint = null;

  #changeListeners = new Set();
  #clearListeners = new Set();

  constructor({ canvas, size = EDITOR_SIZE }) {
    if (!canvas) throw new Error('MapEditor: canvas is required');

    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this.#size = size;

    this.#attachListeners();
    this.draw();
  }

  getScene() {
    return { walls: this.#walls, player: this.#player };
  }

  get wallCount() {
    return this.#walls.length;
  }

  setTool(tool) {
    if (tool !== 'wall' && tool !== 'guide') return;
    this.#currentTool = tool;
  }

  clear() {
    this.#walls = [];
    this.#guideLines = [];
    this.draw();
    this.#emitChange();
    this.#emitClear();
  }

  loadDemo() {
    this.#walls = DEMO_WALLS.map((wall) => ({ ...wall }));
    this.draw();
    this.#emitChange();
  }

  onChange(callback) {
    this.#changeListeners.add(callback);
    return () => this.#changeListeners.delete(callback);
  }

  onClear(callback) {
    this.#clearListeners.add(callback);
    return () => this.#clearListeners.delete(callback);
  }

  destroy() {
    this.#detachListeners();
    this.#changeListeners.clear();
    this.#clearListeners.clear();
  }

  draw() {
    const ctx = this.#ctx;
    const size = this.#size;

    ctx.fillStyle = '#0a0a15';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#1a1a2a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i += GRID_STEP) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = COLORS.GUIDE;
    for (const line of this.#guideLines) {
      ctx.beginPath();
      ctx.moveTo(line.x1, line.y1);
      ctx.lineTo(line.x2, line.y2);
      ctx.stroke();
    }

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.font = '12px sans-serif';
    this.#walls.forEach((wall, i) => {
      const hue = (i * 47) % 360;
      ctx.strokeStyle = `hsl(${hue}, 70%, 55%)`;
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();

      const mx = (wall.x1 + wall.x2) / 2;
      const my = (wall.y1 + wall.y2) / 2;
      ctx.fillStyle = '#fff';
      ctx.fillText(i.toString(), mx - 4, my + 4);
    });

    this.#drawPlayer();
  }

  #drawPlayer() {
    const ctx = this.#ctx;
    const { x, y, angle } = this.#player;

    ctx.fillStyle = COLORS.PLAYER;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = COLORS.PLAYER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + Math.cos(angle) * VIEW_INDICATOR_LENGTH,
      y + Math.sin(angle) * VIEW_INDICATOR_LENGTH,
    );
    ctx.stroke();

    ctx.strokeStyle = COLORS.PLAYER_VIEW;
    ctx.lineWidth = 1;
    for (const a of [angle - FOV / 2, angle + FOV / 2]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x + Math.cos(a) * FOV_INDICATOR_LENGTH,
        y + Math.sin(a) * FOV_INDICATOR_LENGTH,
      );
      ctx.stroke();
    }
  }

  #drawPreview(endPoint) {
    this.draw();
    const ctx = this.#ctx;
    ctx.strokeStyle =
      this.#currentTool === 'guide'
        ? COLORS.GUIDE
        : COLORS.PREVIEW;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(this.#startPoint.x, this.#startPoint.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  #attachListeners() {
    const canvas = this.#canvas;

    canvas.addEventListener('mousedown', this.#handleDrawStart);
    canvas.addEventListener('mousemove', this.#handleDrawMove);
    canvas.addEventListener('mouseup', this.#handleDrawEnd);
    canvas.addEventListener('mouseleave', this.#handleDrawCancel);

    canvas.addEventListener('touchstart', this.#handleDrawStart, { passive: false });
    canvas.addEventListener('touchmove', this.#handleDrawMove, { passive: false });
    canvas.addEventListener('touchend', this.#handleDrawEnd, { passive: false });
    canvas.addEventListener('touchcancel', this.#handleDrawCancel);
  }

  #detachListeners() {
    const canvas = this.#canvas;

    canvas.removeEventListener('mousedown', this.#handleDrawStart);
    canvas.removeEventListener('mousemove', this.#handleDrawMove);
    canvas.removeEventListener('mouseup', this.#handleDrawEnd);
    canvas.removeEventListener('mouseleave', this.#handleDrawCancel);

    canvas.removeEventListener('touchstart', this.#handleDrawStart);
    canvas.removeEventListener('touchmove', this.#handleDrawMove);
    canvas.removeEventListener('touchend', this.#handleDrawEnd);
    canvas.removeEventListener('touchcancel', this.#handleDrawCancel);
  }

  #handleDrawStart = (event) => {
    event.preventDefault();
    this.#startPoint = getEventCoordinates(event, this.#canvas);
    this.#isDrawing = true;
  };

  #handleDrawMove = (event) => {
    if (!this.#isDrawing) return;
    event.preventDefault();
    const coords = getEventCoordinates(event, this.#canvas);
    this.#drawPreview(coords);
  };

  #handleDrawEnd = (event) => {
    if (!this.#isDrawing) return;
    event.preventDefault();

    const coords = getEventCoordinates(event, this.#canvas);
    const dx = coords.x - this.#startPoint.x;
    const dy = coords.y - this.#startPoint.y;

    if (Math.hypot(dx, dy) > MIN_DRAG_DISTANCE) {
      const line = {
        x1: Math.round(this.#startPoint.x),
        y1: Math.round(this.#startPoint.y),
        x2: Math.round(coords.x),
        y2: Math.round(coords.y),
      };

      if (this.#currentTool === 'wall') {
        this.#walls.push(line);
      } else {
        this.#guideLines.push(line);
      }
      this.#emitChange();
    }

    this.#isDrawing = false;
    this.#startPoint = null;
    this.draw();
  };

  #handleDrawCancel = () => {
    if (!this.#isDrawing) {
      return;
    }
    this.#isDrawing = false;
    this.#startPoint = null;
    this.draw();
  };

  #emitChange() {
    const scene = this.getScene();
    for (const cb of this.#changeListeners) cb(scene);
  }

  #emitClear() {
    for (const cb of this.#clearListeners) cb();
  }
}
