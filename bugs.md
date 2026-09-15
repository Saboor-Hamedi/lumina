# Task: Improve edge (wire) rendering and alignment in Lumina's Canvas

## Context
You are working on Lumina, an Electron + TypeScript + Tailwind knowledge workspace app.
One feature is "Canvas" — a freeform diagramming surface (similar to Excalidraw / tldraw /
React Flow). Users place shape nodes (rectangle, circle, cylinder, hexagon, diamond,
triangle, heart, stick figure, etc.) and connect them with wires/edges. There is a right-hand
"Canvas Studio" panel with tabs: Shapes, Wires, Layout, Export. The Layout tab already has
20px grid snapping, "Snap All Nodes to 20px Grid", align-selected-cards, distribute-spacing,
and viewport zoom controls. There is also a "Spatial Navigator" showing node count.

## Current state of edges (the problem)
In the current canvas:
- Edges attach to arbitrary points on node boundaries rather than fixed anchor ports, so
  lines leave shapes at random angles and the diagram looks accidental rather than deliberate.
- Bezier control points are not derived from the exit direction, so curves wobble, bulge on
  short edges, and flatten on long edges.
- Edges cross over node labels and text (e.g. a wire passes through a shape's placeholder
  text; an edge label chip sits on top of a line and is unreadable).
- Arrowhead styling is inconsistent — some edges render an arrowhead, others do not.
- Edge endpoints touch/overlap the node stroke instead of stopping just outside it.
- Node positions snap to a 20px grid but edge segments do not, so horizontal/vertical runs
  sit at off-grid coordinates and read as misaligned.
- Only freeform curved routing exists; there is no orthogonal (right-angle) option, which is
  what most technical diagrams (e.g. database diagrams) need to look clean.

## Required changes

### 1. Fixed anchor ports
Give every node a set of fixed connection ports (minimum N/E/S/W; ideally 8 with corners).
Each port has a position and an outward normal direction vector.
When an edge is created or a node is moved, automatically select the port pair that produces
the shortest path AND whose normals face each other. Never attach to arbitrary boundary points.

### 2. Direction-aware bezier curves
Derive bezier control points from each port's outward normal. Offset magnitude should be
proportional to endpoint distance but clamped (e.g. clamp(distance * 0.4, 40, 150)) so short
edges do not bulge and long edges do not flatten. Every edge must leave and enter its node
perpendicular to that node's boundary.

### 3. Orthogonal (Manhattan) routing mode
Add a routing mode toggle in the Wires tab with three options: Curved / Orthogonal / Straight.
Orthogonal routing should exit the source port along its normal, travel to a midpoint on the
dominant axis, turn at right angles, and arrive perpendicular at the target port. Round all
corners with small arc segments (radius ≈ 8px) rather than hard 90° joins.

### 4. Grid-snap edge segments
Snap orthogonal segment positions to the same 20px grid the nodes use, respecting the existing
"20px Grid Snapping" toggle and Ctrl+' shortcut. Horizontal and vertical runs must land on grid
multiples so they visually align with node edges.

### 5. Fix overlaps and collisions
- Inset edge endpoints ~6px outside the node boundary so arrowheads never touch the shape stroke.
- Render edge label chips with an opaque background and padding, layered above edges but
  below nodes, so labels are never crossed by wires.
- When multiple edges connect the same node pair, fan them out with a perpendicular offset
  (index * 12px) so they do not stack on top of each other.
- Prefer routes that avoid passing through other nodes' bounding boxes where feasible.

### 6. Consistent stroke and arrowhead styling
- One stroke width for all edges (1.5–2px), with stroke-linecap="round" and stroke-linejoin="round".
- A single reusable SVG marker definition for arrowheads, sized relative to stroke width, applied
  consistently to every directed edge.
- Add an invisible transparent hit-area path (stroke-width ~12px) beneath each visible edge so
  edges are easy to click and select.

### 7. Live alignment guides
While dragging a node, detect when its center or any edge aligns with another node's center or
edge (tolerance ~5px), snap to that alignment, and draw a temporary guide line. This prevents
misalignment during placement rather than only correcting it afterward via the Layout panel.

## Constraints
- Match the existing Canvas Studio visual language and theming (the app supports light and
  dark themes — do not hardcode colors; use the existing theme tokens/CSS variables).
- Keep the canvas file format backward compatible: existing saved canvases must still open.
  If new per-edge fields are needed (routing mode, port ids, label offset), make them optional
  with sensible defaults derived from current behavior.
- Rendering must stay smooth while dragging — recompute routes incrementally for affected
  edges only, not the entire graph on every pointer move.

## Deliverables
1. A port/anchor module that computes ports and selects the best port pair for an edge.
2. A routing module exposing curved, orthogonal, and straight path generators returning SVG path strings.
3. Updated edge rendering with consistent strokes, shared arrowhead markers, label chips, and hit areas.
4. Routing mode toggle wired into the Wires tab of Canvas Studio.
5. Live alignment guides during node drag.

Before writing code, inspect the existing canvas implementation and tell me which files you
will change and how the current edge data model is structured.