# Plan Drawer

Browser app for drawing a **2D walls plan** and previewing the walls in **3D**. 

## Two parts

### 1. Walls drawer (2D plan)

Top-down plan editor for drawing wall segments — the same core idea as SketchIt’s SVG canvas: place walls as lines on a flat layout before viewing the result in 3D.

- Walls as **line segments** (start/end points)
- **Live preview** while drawing — the segment under the cursor is shown before it is committed
- **Plan-first workflow** — sketch the layout, then open the 3D view
- Scrolling, pan and zoom drawing area

### 2. Walls 3D viewer

First-person **3D preview** of the walls drawn on the plan.

- Renders the current wall layout from the fixed viewpoint on the plan
- Clears when you reset the plan# PlanDrawer
