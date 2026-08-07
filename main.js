import { MapEditor } from './editor.js';
import { Renderer3D } from './render.js';

const appElements = {
  editorCanvas: document.getElementById('editor'),
  renderCanvas: document.getElementById('render'),
  wallCountEl: document.getElementById('wall-count'),
  algorithmSelect: document.getElementById('algorithm'),
  algoDesc: document.getElementById('algo-desc'),
  statsEl: document.getElementById('stats'),
  orderDisplay: document.getElementById('order-display'),
  renderBtn: document.getElementById('render-btn'),
  stepBtn: document.getElementById('step-btn'),
  stopBtn: document.getElementById('stop-btn'),
  stepModeCheckbox: document.getElementById('step-mode-checkbox'),
  demoBtn: document.getElementById('demo-btn'),
  clearBtn: document.getElementById('clear-btn'),
};

const editor = new MapEditor({ canvas: appElements.editorCanvas });

const renderer = new Renderer3D({
  canvas: appElements.renderCanvas,
  sceneProvider: () => editor.getScene(),
  ui: {
    algorithmSelect: appElements.algorithmSelect,
    algoDesc: appElements.algoDesc,
    statsEl: appElements.statsEl,
    orderDisplay: appElements.orderDisplay,
    renderBtn: appElements.renderBtn,
    stepBtn: appElements.stepBtn,
    stopBtn: appElements.stopBtn,
    stepModeCheckbox: appElements.stepModeCheckbox,
  },
});

const syncWallCount = () => {
  if (appElements.wallCountEl) appElements.wallCountEl.textContent = editor.wallCount;
};

editor.onChange(syncWallCount);
editor.onClear(() => renderer.clearCanvas());
syncWallCount();

appElements.demoBtn?.addEventListener('click', () => editor.loadDemo());
appElements.clearBtn?.addEventListener('click', () => editor.clear());
appElements.renderBtn?.addEventListener('click', () => renderer.start());
appElements.stepBtn?.addEventListener('click', () => renderer.step());
appElements.stopBtn?.addEventListener('click', () => renderer.stop());
