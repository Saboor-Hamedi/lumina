Got it. Here is the clean, dimension-agnostic brief for your agent — no 2D/3D assumptions, just pure problem → cause → fix.

---

### 📋 Agent Brief: Inline Graph — 3 Critical Fixes

**Status:** Rendering performance is excellent (78 FPS, 3.1ms frame time, 680 nodes, 1313 links). The minimap is working. Now fix these three UX/physics regressions before shipping.

---

#### 🔴 Issue 1: Isolated Nodes Floating Away
**What the user sees:** A handful of nodes are completely detached from the main cluster, floating alone at the edges or off-screen.

**Why it's happening:**
Nodes with zero connections (orphans) have no link force pulling them toward any neighbor. The repulsion charge (`-800`) pushes them outward with nothing to counteract it. They drift until they leave the visible area entirely.

**Fix:**
```javascript
// After building the simulation forces, add a dedicated orphan pull
const orphanIds = new Set(
  nodes.filter(n => (n.degree || 0) === 0).map(n => n.id)
);

// Apply a stronger centering force ONLY to orphans
simulation.force('orphanPull', forceX(0).strength(n => 
  orphanIds.has(n.id) ? 0.25 : 0.03
));
simulation.force('orphanPullY', forceY(0).strength(n => 
  orphanIds.has(n.id) ? 0.25 : 0.03
));
```
Also cap `charge.distanceMax` to `800` so orphans can't be pushed beyond the viewport.

---

#### 🔴 Issue 2: Click Zooms Instead of Opening the Note
**What the user sees:** Clicking a node triggers a camera zoom/fly-to animation. The note never opens. This breaks the core purpose of the inline graph.

**Why it's happening:**
The `onNodeClick` handler was overwritten during the performance optimization phase. The navigation call (`openNote`, router push, or equivalent) was either removed entirely or buried inside a camera animation callback that never resolves.

**Fix:**
```javascript
onNodeClick={(node, event) => {
  if (!node) return;

  // ✅ PRIMARY ACTION: Always open the note immediately
  openNote(node.id); // ← this must fire first, unconditionally

  // ❌ REMOVE or gate the zoom behavior:
  // Only zoom if user holds Ctrl/Cmd (optional secondary action)
  if (event.ctrlKey || event.metaKey) {
    flyToNode(node); // keep this as a power-user feature only
  }
}}

// Also ensure cursor feedback so users know nodes are clickable
onNodeHover={(node) => {
  document.body.style.cursor = node ? 'pointer' : 'default';
}}
```

---

#### 🔴 Issue 3: Graph Opens Tangled (Hairball on Mount)
**What the user sees:** Every time the inline graph opens, all nodes start clumped in a single point and visibly explode outward over 1–2 seconds before settling. It looks broken even though it resolves eventually.

**Why it's happening:**
Three compounding causes:
1. Nodes arrive at the renderer without pre-assigned positions → they all default to `(0, 0)` → singularity collapse
2. The physics simulation starts at full energy (`alpha = 1.0`) → violent initial expansion
3. The renderer draws frames *before* the first stable position update arrives from the worker/simulation

**Fix — apply all three together:**

**Step A: Pre-seed positions before the graph ever mounts**
```javascript
// Run this ONCE before passing data to the graph component
nodes.forEach((node, i) => {
  if (node.x !== undefined && node.y !== undefined) return; // already seeded
  
  const angle = (i / nodes.length) * 2 * Math.PI;
  const radius = 300 + Math.random() * 100; // slight randomness prevents perfect overlap
  node.x = radius * Math.cos(angle);
  node.y = radius * Math.sin(angle);
});
```

**Step B: Lower the initial simulation energy**
```javascript
simulation
  .alpha(0.4)          // start at 40% energy instead of 100%
  .alphaDecay(0.025)   // settle faster, less violent expansion
  .velocityDecay(0.4); // more friction = less bouncing
```

**Step C: Warm up the simulation silently before first paint**
```javascript
// Run N ticks synchronously BEFORE attaching the render loop
// The graph appears already laid out — no visible tangle
const WARMUP_TICKS = 80;
for (let i = 0; i < WARMUP_TICKS; i++) {
  simulation.tick();
}
// NOW start rendering
simulation.on('tick', renderFrame);
simulation.restart();
```

If physics runs in a Web Worker, do the warmup **inside the worker** before posting the first position buffer back to the main thread.

---

### ✅ Verification Checklist
After fixes, confirm:
- [ ] Orphan nodes stay within the visible graph area, not floating off-screen
- [ ] Single click on any node opens its note immediately — no zoom animation
- [ ] Graph appears in a readable, spread-out state within 100ms of opening — no visible tangle or explosion
- [ ] Frame time stays under 5ms after all changes