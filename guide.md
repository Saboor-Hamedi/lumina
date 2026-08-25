# Lumina Graph Architecture & Optimizations

This document outlines the packages, tools, and custom performance techniques used to build Lumina's hyper-fast Obsidian-style knowledge graph.

## Core Packages
- **`react-force-graph-2d` / `react-force-graph-3d`**: The primary rendering wrappers. They handle drawing to the HTML5 Canvas (2D) and WebGL (3D) while giving us direct access to the simulation loop.
- **`d3-force`**: The underlying physics engine driving the layout. It uses the Barnes-Hut algorithm for n-body repulsion and calculates the spring forces between links.
- **`three.js`**: Powers the 3D graph representation (we use custom `SphereGeometry` and `MeshBasicMaterial` for lightweight 3D nodes).
- **`zustand`**: Used for state management. Granular component-level subscriptions prevent the entire graph from re-rendering when dragging UI sliders.

## Key Performance Techniques

Because `react-force-graph` runs a continuous animation loop calculating physics and rendering graphics 60 times a second for potentially thousands of nodes, we implemented several advanced optimizations:

### 1. Canvas Rendering Pipeline Optimization
The `paintNode` (2D Canvas) function runs once per node, per frame (e.g., 42,000 times a second for 700 nodes). 
- **Eliminated `getState()` Overhead**: We removed expensive Zustand `.getState()` polling from inside the render loops, instead caching settings at the React component level via hooks. 
- **O(1) Link Loop Checks**: Link rendering functions (`linkWidth`, `linkColor`) are evaluated for every edge every frame. We replaced slow object property lookups (`link.source.id === hoverNode.id`) with ultra-fast memory reference equality (`link.source === hoverNode`), making hover highlights instantaneous.
- **Level of Detail (LOD)**: `ctx.fillText` is historically one of the most expensive Canvas API calls. The engine actively monitors the camera zoom (`globalScale`) and completely halts text rendering if the user zooms out beyond a certain threshold.

### 2. Physics & Interaction Smoothing
- **Frictionless Dragging (No Collisions)**: In the massive central graph, computing rigid collisions (`forceCollide`) between hundreds of overlapping nodes while the user drags is incredibly expensive and makes dragging feel "stuck" or "heavy." We entirely removed rigid collisions and rely solely on natural magnetic repulsion (`forceManyBody`).
- **Elastic Radial Pinning (Inline Graph)**: Rather than rigidly locking the central node to the middle of the screen (`fx=0, fy=0`), we leave it unpinned and use D3's `forceRadial` to dynamically pull it toward the center. This creates a satisfying, elastic "rubber band" bounce when dragged and released.
- **Inflated Hit-Detection (Pointer Area)**: Because we designed our nodes to look beautifully minimal and small on screen, fast mouse movements would outpace the engine's tracking, dropping the node. We solved this by using `nodePointerAreaPaint` to draw massive, invisible hit-boxes around every node, guaranteeing robust dragging.
- **Smooth Release (No Reheating)**: We avoid manually calling `d3ReheatSimulation()` when a node is dropped, allowing the physics engine to naturally settle rather than violently exploding and rearranging the graph on release.

### 3. Data Preparation
- **O(1) Map Lookups for Links**: When parsing the vault for Markdown wikilinks, scanning thousands of files causes a massive `O(N^2)` CPU spike if checking arrays. We pre-compute a `Map` of all lowercase file titles, dropping graph loading times to zero.
- **Object Identity Preservation**: When we update graph settings, we heavily reuse the exact same JavaScript object references for nodes and links. If you pass new object references, the `react-force-graph` engine assumes the entire graph is brand new and triggers a violent, full-layout reset.

### 4. Smart Viewport Framing
- **No Infinite Zoom**: We completely replaced the default `zoomToFit` command on initial load. `zoomToFit` behaves erratically (zooming out to infinity for large graphs, or microscopic 15x magnification for 2-node graphs). We manually command the camera to open directly at `1.0` zoom at coordinate `(0,0)`, providing a perfectly framed vault every time.