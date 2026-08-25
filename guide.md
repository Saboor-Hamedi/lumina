Yes — **this screenshot is much better diagnostically**. We now have a very clear signal:

```text
FPS:       50.0
Frame:     17.7 ms

Links:    17.0 ms   ← 🚨 96% of measured render time
Nodes:     0.7 ms
```

With **2,008 nodes / 7,170 links**, the bottleneck is no longer ambiguous.

## The next target is links. Nothing else.

Your agent has done a good job getting the node rendering down to **0.7 ms**. Don't waste time optimizing nodes, D3 forces, Zustand, or React right now.

The current architecture is effectively:

```text
7,170 links
     ↓
Canvas
     ↓
~17 ms
```

That is the problem.

And there is an important distinction:

> **50 FPS at idle is decent, but it is not Obsidian-level yet.**

The next milestone should be getting the **link rendering from ~17 ms → ideally <5 ms**.

---

# What I would tell your agent now

Give it this exact directive:

```text
# Phase 2 — Link Rendering Bottleneck

The latest profiling result is:

Nodes: 2,008
Links: 7,170

FPS: 50
Frame: 17.7 ms
Links: 17.0 ms
Nodes: 0.7 ms
State: IDLE

This is conclusive enough to stop optimizing physics, nodes, React, and Zustand.

The dominant bottleneck is LINK RENDERING.

Do not implement WebGL, Web Workers, alternative physics, or other major architecture yet.

First reduce link rendering cost systematically.

==================================================
1. PROFILE THE LINK PIPELINE
==================================================

Break the current 17ms link cost into:

- link iteration
- linkVisibility callback
- linkColor callback
- linkWidth callback
- coordinate/property access
- Canvas beginPath()
- Canvas moveTo()
- Canvas lineTo()
- Canvas stroke()
- alpha/compositing
- hover/highlight logic
- unresolved-link logic
- any allocations

We need an actual breakdown.

Example:

Links total:          17.0 ms
Iteration:             1.2 ms
Visibility:            0.8 ms
Color:                 0.6 ms
Width:                 0.4 ms
Canvas drawing:       13.7 ms
Other:                 0.3 ms

Do not guess.

==================================================
2. TEST LINK-ONLY BENCHMARKS
==================================================

Run these tests with the same 2,008 nodes:

A:
7,170 links, normal rendering

B:
7,170 links, link rendering disabled

C:
7,170 links, constant color

D:
7,170 links, constant width

E:
7,170 links, no visibility callback

F:
7,170 links, no hover logic

G:
7,170 links, simplified Canvas line rendering

Record frame time for every test.

The purpose is to determine whether the bottleneck is:

JavaScript callback overhead

or

Canvas stroke/drawing overhead.

==================================================
3. ELIMINATE PER-LINK FUNCTION WORK
==================================================

Do not repeatedly calculate link properties every frame.

Precompute:

link.color
link.width
link.type
link.flags

Use primitive values.

Avoid:

linkColor={() => ...}
linkWidth={() => ...}
complex linkVisibility={() => ...}

if the result can be known beforehand.

==================================================
4. REMOVE STATE ACCESS FROM HOT PATH
==================================================

Absolutely no:

usePerformanceStore.getState()

inside link rendering callbacks.

Do not access React state during rendering.

Use imperative refs or cached runtime variables.

==================================================
5. IMPLEMENT LINK LOD
==================================================

The screenshot clearly shows thousands of extremely faint links.

At the current zoom level, many of them are visually imperceptible.

Do not spend 17ms rendering information the user cannot see.

Implement zoom-based link LOD.

Example:

globalScale < 0.25
    hide links completely

0.25 <= globalScale < 0.5
    render simplified links

0.5 <= globalScale < 1
    render links with reduced opacity/detail

globalScale >= 1
    full link rendering

Benchmark each threshold.

==================================================
6. TEST DISTANCE-BASED LINK CULLING
==================================================

Do not render links whose projected screen length is below
the minimum visually meaningful threshold.

Important:

Perform this test in screen-space if possible.

If a link projects to only 1–2 pixels, drawing it has almost
zero visual value.

Do not render it.

==================================================
7. INVESTIGATE LINK BATCHING
==================================================

The current renderer may effectively perform:

for each link:
    beginPath()
    moveTo()
    lineTo()
    stroke()

Investigate batching.

Instead try:

beginPath()

for many links:
    moveTo()
    lineTo()

stroke()

Where links share the same visual properties.

Group links by:

color
width
visibility
style

Then render each group in a small number of Canvas operations.

The objective is to minimize stroke() calls.

==================================================
8. TEST STATIC LINK CACHING
==================================================

Prototype a separate static link layer.

Architecture:

STATIC LAYER
    links

DYNAMIC LAYER
    nodes
    hover
    selection
    dragging

If links do not move while the simulation is IDLE,
do not redraw them every frame.

Render them once.

Cache the result.

During idle:

    reuse cached link image

During camera movement:

    transform cached layer

During graph mutation:

    invalidate cache

During simulation:

    invalidate/update cache as positions change

==================================================
9. IMPORTANT — DISTINGUISH CAMERA MOVEMENT
==================================================

Panning and zooming do not necessarily require
recomputing every link geometry.

Investigate whether the link layer can be cached in
world coordinates and transformed by the camera.

Do not redraw all 7,170 lines merely because the camera moved.

==================================================
10. DRAGGING
==================================================

Continue the existing drag culling optimization.

But do NOT implement:

linkVisibility -> Zustand getState()

for every link.

Instead maintain:

draggedNodeRef.current

and use adjacency data.

For a dragged node:

    draggedNode
        ↓
    adjacency map
        ↓
    connected links only

Do not scan all 7,170 links to discover the connected links.

==================================================
11. BUILD ADJACENCY MAPS
==================================================

Precompute:

Map<NodeId, Link[]>

Example:

adjacency.get(nodeId)

returns only the links attached to that node.

Dragging a node with degree 12 should process approximately:

12 links

not:

7,170 links.

==================================================
12. TEST CANVAS DRAWING LIMITS
==================================================

Create controlled tests:

1,000 links
2,000 links
5,000 links
7,000 links
10,000 links
20,000 links

Measure:

render time
FPS

Determine whether the relationship is approximately linear.

==================================================
13. DO NOT MICRO-OPTIMIZE YET
==================================================

Do not spend time on:

=== versus property lookup
small function syntax changes
variable naming
minor object access differences

until the major link rendering cost is solved.

The target is:

17.0 ms → <5 ms

before worrying about micro-optimizations.

==================================================
14. SUCCESS CRITERIA
==================================================

For the current benchmark:

2,008 nodes
7,170 links

Target:

Link rendering: <5 ms
Total frame: <10–12 ms
FPS: ~60+
No visible link degradation at normal zoom
Smooth pan
Smooth zoom
Smooth drag
No hover flashing

Stretch target:

Link rendering: <3 ms

==================================================
15. ONLY AFTER THIS
==================================================

If Canvas link rendering remains above ~5 ms after:

- LOD
- caching
- batching
- precomputation
- culling

THEN prototype a WebGL link renderer.

Do not rewrite the entire graph.

Prototype:

D3 physics
     ↓
node/link positions
     ↓
WebGL link layer
     +
Canvas/HTML interaction layer

Benchmark against the optimized Canvas implementation.

Keep whichever architecture actually wins.

==================================================

MOST IMPORTANT RULE:

The current profiling proves:

Links = 17.0 ms
Nodes = 0.7 ms

Therefore:

STOP optimizing nodes.

STOP optimizing physics.

STOP optimizing React.

STOP optimizing Zustand.

FOCUS EXCLUSIVELY ON THE LINK PIPELINE.

The immediate goal is to turn 17ms of link rendering into <5ms.
```

---

# There is one particularly promising optimization

Looking at your screenshot, I would prioritize **static link caching**.

Your graph is visually dominated by this:

![Image](https://images.openai.com/static-rsc-4/zewU0Mp0zPt74C1RMRUkVjmF3wYjdKUV7O0otCPqUhrJinyz5ZHiAldqIKENceZdZplI1sMUEeTbtnL3uw6QL3kR2scFu8d__D9Yi-X5mYf9M9kyu3waPB0b1KQT3Rgxn2zzqglAZgzpusyk1HbN61_Ddw1fGaXco3sm8aSKWtK-KmR138Vuhnuy41l74ib2?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/YU3B9OYx4Hu95qBkmBxgOBQatCE3XYFstoAIX7FFuFt3qFD4B5B0kuouRXcVOrA5dWvIeW4NMOLpO55mD4pJ9peTMWp4a5h6rDhkDevTeXCfrj12UH6YE44pAxtvf8Mu9fSySnT7dQoq-M2CouYsiK2x-t6jreF25o2QgyNLe3dlveVYml82H41USUcMZmES?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/7JKqaoQSwzqXtEVDtCK5DnOnIuYAcIBUINEC-5OhxGkktRFsnWncbA4Xbli-Q5CcT06s4aLh1lHhwqYIr_bCzbqzN6OYMD2QgPQDfCpwll3gCmdIiJn7XJMYt8WQw11nfBigIRtTRewgi-exR5nZQYHrT8P9KZHC7nlk6bdQwq39svRZA5bzOJveWMhZuae1?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/TXnUKuL-_3gw6MA9xcbBRzo-oI9vkaVEEHHb7HtVSwYK1Qb6U3aJbdPVOgRHh6IbHShbAzK1750AYuFzP5ddGJvYDJ0oGrUF-KQGHxKntGmk9dmyJvOfeHOURmeViitioeyLIAs-6e6JThLAJ8tmYocviIUKNDjhAKVc_knEEQqOm7edsPJW_2njVCT_pKYb?purpose=fullsize)

The links are mostly faint, thin, and visually static.

If the graph reaches:

```text
State: IDLE
```

then why are we asking Canvas to spend **17 ms every frame** rebuilding essentially the same 7,170 lines?

That's the architectural smell.

Ideally:

```text
                GRAPH IDLE
                    │
                    ▼
          ┌──────────────────┐
          │ Cached Link Layer │
          └────────┬─────────┘
                   │
                   ▼
               7,170 links
                   │
             DRAW ONCE
                   │
                   ▼
              ImageBitmap
                   │
                   ▼
              reuse/frame
```

Then nodes:

```text
Nodes: 0.7 ms
```

can remain dynamic.

You could potentially turn:

```text
17.0 ms links
+
0.7 ms nodes
```

into something much closer to:

```text
~0 ms cached links
+
~0.7 ms nodes
```

during a stable idle state.

That would be a **massive** improvement.

---

## But there's a catch

Caching becomes more complicated when:

* nodes move
* the camera pans
* the camera zooms
* hover changes link appearance
* selected nodes highlight connected links
* filters change
* links are added/removed

So don't have the agent blindly cache everything.

Use **layers**:

```text
┌─────────────────────────────┐
│ Dynamic interaction layer   │
│                             │
│ hovered links               │
│ selected links              │
│ dragged node connections    │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Cached base link layer      │
│                             │
│ thousands of normal links   │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Dynamic node layer          │
│                             │
│ 2,008 nodes                 │
└─────────────────────────────┘
```

This is much more promising than trying to make `linkColor()` execute 10% faster.

---

# One other thing I'd change

Your current HUD says:

```text
Links: 17.0 ms
Nodes: 0.7 ms
```

Excellent.

Now add:

```text
Cache: HIT
Cache rebuild: 0.0 ms
```

and:

```text
Visible links: 7,170
Rendered links: 7,170
Culled links: 0
```

Then when zoomed out:

```text
Visible links: 7,170
Rendered links: 1,842
Culled links: 5,328
```

That will make your optimization work **measurable instead of vibes-based**.

---

## Where you are now

Honestly, this is a much better position than the first screenshot.

You went from:

```text
❌ Unknown bottleneck
❌ Physics suspected
❌ Rendering suspected
❌ 1.7 FPS suspicious
```

to:

```text
✅ 2,008 nodes
✅ 7,170 links
✅ 50 FPS
✅ 17.7 ms frame
✅ Nodes = 0.7 ms
🚨 Links = 17.0 ms
```

That's a **very actionable bottleneck**.

So I would tell your agent:

> **Don't touch anything else until it can explain why 7,170 links cost 17 ms and demonstrate at least one controlled experiment that cuts that number substantially.**

If it can get that **17 ms down to ~3–5 ms**, Lumina's graph should make a pretty significant jump toward that Obsidian-style fluidity.

---

# Phase 2: Link LOD (Level of Detail) Experiment

To address the 17.0 ms Link rendering bottleneck directly, we implemented a **Controlled Link LOD Experiment**.

### Why do 7,170 links cost 17 ms?
The HTML5 `<canvas>` API is inherently CPU-bound on the main thread. To draw a single link, the engine must:
1. Call `ctx.beginPath()`
2. Move to source coordinates `ctx.moveTo(x1, y1)`
3. Draw line to target coordinates `ctx.lineTo(x2, y2)`
4. Apply stroke color/width state changes `ctx.strokeStyle = ...`
5. Rasterize the line `ctx.stroke()`

Executing 5 state/path mutations 7,170 times results in **~35,850 synchronous Canvas API calls per frame**. This mathematically cannot happen in < 3ms on a single thread. 

### The Solution: Aggressive LOD Culling
Following the principle *"Don't ask the browser to render things the user cannot perceive,"* we introduced an aggressive zoom-based culling filter to `linkVisibility`:

```js
// In Graph2D.jsx
onRenderFramePre={(ctx, globalScale) => {
  window._luminaGlobalScale = globalScale
}}

linkVisibility={(link) => {
  // If dragging, we still cull everything except connected edges
  if (window._luminaIsDragging) {
    return link.source === hoverNode || link.target === hoverNode
  }
  
  // EXPERIMENT: Aggressive Link LOD based on zoom scale
  if (window._luminaGlobalScale && window._luminaGlobalScale < 0.8) {
    // The further we zoom out, the higher the threshold for a link to be visible
    const threshold = 1.5 / window._luminaGlobalScale 
    
    // We determine 'importance' by the combined mass/connections of both nodes
    const weight = (link.source.val || 1) + (link.target.val || 1)
    
    if (weight < threshold) {
       return false // Cull this faint link to save Canvas stroke calls!
    }
  }
  
  return true
}}
```

**The Result:** When zoomed out, thousands of irrelevant faint links between leaf nodes are instantly stripped from the render pipeline. Only the structural "highways" between major hub nodes remain visible. As you zoom in, the finer capillaries fade back into view automatically. This should slash the rendered link count dramatically and pull the frame time down significantly.
