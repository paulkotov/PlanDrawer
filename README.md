# Plan Drawer

Browser app for sketching a **2D floor plan** and previewing the walls in **3D**. The workflow is inspired by [Autodesk Forge SketchIt](https://github.com/Autodesk-Forge/forge-sketchit-revit) — specifically the [`www`](https://github.com/Autodesk-Forge/forge-sketchit-revit/tree/master/www) front-end, which splits sketching and visualization into two parts.

The UI is in **Russian**.

## Two parts

### 1. Walls drawer (2D plan)

Top-down plan editor for drawing wall segments — the same core idea as SketchIt’s SVG canvas: place walls as lines on a flat layout before viewing the result in 3D.

- **Click and drag** to draw wall segments on a grid
- **Wall count** updates as you sketch
- **Demo map** — load a sample layout with one click
- **Clear** — reset the plan and the 3D view
- **Fixed viewpoint** — player position and field of view are shown on the plan (for the 3D preview)
- **Touch support** — draw on mobile and tablet

Concepts borrowed from SketchIt’s `www` editor:

- Walls as **line segments** (start/end points), not filled shapes
- **Live preview** while drawing — the segment under the cursor is shown before it is committed
- **Plan-first workflow** — sketch the layout, then open the 3D view

### 2. Walls 3D viewer

First-person **3D preview** of the walls drawn on the plan — analogous to SketchIt switching from the sketch canvas to the Forge Viewer after a model is generated.

- Renders the current wall layout from the fixed viewpoint on the plan
- Updates when you click **Рендерить** after editing the plan
- Clears when you reset the plan

## Quick start

No build step or dependencies. ES modules require a local HTTP server (opening `index.html` directly via `file://` will not work).

```bash
# Option 1: Python
python3 -m http.server 8080

# Option 2: Node (npx)
npx serve .

# Option 3: PHP
php -S localhost:8080
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

## Usage

1. In the **walls drawer** panel, sketch walls on the 2D plan — or click **Демо карта** for a sample layout.
2. Click **Рендерить** to build the 3D preview in the **walls 3D viewer** panel.
3. Edit the plan and render again to refresh the view, or **Очистить** to start over.

## Inspiration

This project reuses the **two-part layout** from SketchIt’s `www` app:

| SketchIt (`www`) | Plan Drawer |
|------------------|-------------|
| SVG canvas + sidebar tools | 2D canvas wall drawer |
| Wall elements as curves (start/end) | Wall segments on a grid |
| Temporary preview while placing points | Live segment preview while dragging |
| Forge Viewer for 3D model | In-browser first-person 3D wall viewer |

Plan Drawer is a **standalone, dependency-free** take on the sketching half of that idea. It does not connect to Forge, Revit, or Design Automation.

Source reference: [Autodesk-Forge/forge-sketchit-revit — `www`](https://github.com/Autodesk-Forge/forge-sketchit-revit/tree/master/www)

## Project structure

```
.
├── index.html    # Layout: walls drawer + 3D viewer panels
├── main.js       # App bootstrap, wires editor and viewer
├── editor.js     # MapEditor — 2D plan, wall drawing, player/FOV overlay
├── render.js     # Renderer3D — first-person wall preview
└── styles.css    # Dark theme, responsive two-panel layout
```

## Tech stack

- Vanilla JavaScript (ES modules)
- HTML5 Canvas 2D API
- No frameworks, bundler, or npm dependencies

## Browser support

Any modern browser with ES module and Canvas support (Chrome, Firefox, Safari, Edge).

## License

No license file is included yet. Add one before publishing if you plan to open-source the project.
