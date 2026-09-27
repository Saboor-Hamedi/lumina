# Lumina — 10+ Open Notes Resize Performance Investigation

## NEW BREAKTHROUGH

The RightSidebar/MainLayout problem has now been reproduced under a very specific condition:

> The layout behaves correctly with a small number of open notes, but the problem appears when approximately **10 or more notes are open**.

This changes the investigation completely.

The RightSidebar is probably NOT the root cause.

The likely root cause is:

> **Window resize causes work to scale with the number of open notes/editors, blocking or delaying the renderer's ability to update the MainLayout.**

The visible symptom is the RightSidebar covering/pushing the editor/titlebar, but that may simply be because the browser cannot complete the layout/paint quickly enough.

---

# PRIMARY MISSION

Do NOT modify `RightSidebar.tsx` yet.

Do NOT modify CSS positioning yet.

Find out:

> **What happens to the renderer when the window is resized with 1, 5, 10, 20, and 50 open notes?**

We need a measurable answer.

---

# TEST MATRIX

Run the same resize operation with:

| Open notes | Result    |
| ---------: | --------- |
|          1 | baseline  |
|          5 | baseline  |
|         10 | reproduce |
|         20 | reproduce |
|         50 | stress    |

For each case measure:

- resize event frequency
- MainLayout renders
- TabContentPane renders
- editor renders
- editor layout/update calls
- React commits
- long tasks
- frame time
- FPS
- main-thread blocking time

---

# STEP 1 — FIND EVERY RESIZE LISTENER

Search the entire renderer codebase for:

```text
window.addEventListener('resize'
```

```text
ResizeObserver
```

```text
visualViewport
```

```text
resize
```

Also search for:

```text
getBoundingClientRect
```

```text
offsetWidth
```

```text
clientWidth
```

```text
scrollWidth
```

```text
innerWidth
```

```text
innerHeight
```

Determine which components react to window/container size changes.

Especially inspect:

- TabContentPane
- editor component
- Markdown editor
- preview
- CodeMirror/Monaco if present
- MainLayout
- RightSidebar
- Graph
- FileExplorer
- tab bar

---

# STEP 2 — DETERMINE HOW MANY EDITORS ARE ACTUALLY ALIVE

Do not assume that 50 tabs means 50 expensive editors.

Verify.

Instrument the editor component:

```tsx
console.count('[EDITOR RENDER]')
```

Also log mount/unmount:

```tsx
useEffect(() => {
  console.log('[EDITOR MOUNT]', id)

  return () => {
    console.log('[EDITOR UNMOUNT]', id)
  }
}, [id])
```

Then open:

1 note
2 notes
5 notes
10 notes
20 notes
50 notes

Determine:

> How many actual editor instances exist simultaneously?

---

# STEP 3 — TEST RESIZE WITH ONLY ONE ACTIVE EDITOR

This is critical.

If there are 20 open notes but only one editor should actually be actively responding to layout changes, determine whether the inactive editors are still receiving resize work.

During resize log:

```text
noteId
active/inactive
resize callback
layout/update call
```

We want to detect something like:

```text
Resize
├── Editor A
├── Editor B
├── Editor C
├── Editor D
├── Editor E
├── ...
└── Editor T
```

If inactive editors are all responding, we found a major source of scaling.

---

# STEP 4 — PROFILE THE MAIN THREAD

Use Chrome DevTools Performance.

Record:

```text
1 note → resize
10 notes → resize
20 notes → resize
50 notes → resize
```

Look specifically for:

- Long Task
- React commit
- scripting
- layout
- style recalculation
- forced synchronous layout
- paint
- composite

The critical question:

> Does the renderer spend hundreds of milliseconds or seconds doing JavaScript/layout work during resize?

If yes, RightSidebar is merely the visible victim.

---

# STEP 5 — CHECK TABCONTENTPANE

We previously optimized:

```text
TabContentPane
MainLayout
renderedEditors
FileExplorer
Virtuoso
```

Do not assume that optimization solved all editor work.

Inspect whether `TabContentPane` still receives props that change during resize.

Check:

```text
width
height
container dimensions
layout state
window dimensions
editor dimensions
sidebar width
```

If inactive panes receive new props during every resize event, that can cause:

```text
resize
↓
50 TabContentPane updates
↓
50 editor checks
↓
React reconciliation
↓
layout
↓
paint
```

---

# STEP 6 — CHECK EDITOR INTERNAL RESIZE HANDLERS

If using CodeMirror, Monaco, or another editor, inspect whether every editor instance receives a resize notification.

The goal should generally be:

```text
Window resize
        ↓
active/visible editor
        ↓
update its layout
```

not:

```text
Window resize
        ↓
all 50 editors
        ↓
all 50 perform layout calculations
```

If inactive editors are hidden, determine whether their editor engines genuinely need resize processing.

---

# STEP 7 — CHECK HIDDEN TAB STRATEGY

Inspect how inactive tabs are rendered.

We need to distinguish:

### Strategy A

```text
All 50 editors mounted
Only one visible
```

versus:

### Strategy B

```text
Only active editor mounted
Inactive documents retained as models/state
```

versus:

### Strategy C

```text
All editors mounted
Inactive editors remain alive but have their expensive view/layout work disabled
```

Do NOT automatically switch to Strategy B.

The correct architecture depends on Lumina's tab/editor requirements.

But determine which architecture currently exists.

---

# STEP 8 — LOOK FOR CASCADING WIDTH UPDATES

Search for something like:

```text
window resize
↓
windowWidth state
↓
MainLayout
↓
activeTab
↓
all TabContentPanes
↓
editor width
↓
editor layout
```

Also look for Zustand selectors that subscribe to broad layout state.

Bad:

```ts
useWorkspaceStore((state) => state.layout)
```

if `layout` changes during every resize.

Prefer granular subscriptions where possible.

---

# STEP 9 — DETERMINE IF THE MAIN THREAD IS ACTUALLY BLOCKED

This is essential.

If the window is being resized and the RightSidebar appears visually wrong for 2–3 seconds, determine whether JavaScript is blocking the renderer.

Add a temporary heartbeat:

```ts
let last = performance.now()

function heartbeat(now: number) {
  const delta = now - last

  if (delta > 100) {
    console.warn('[MAIN THREAD GAP]', delta)
  }

  last = now
  requestAnimationFrame(heartbeat)
}

requestAnimationFrame(heartbeat)
```

If you see:

```text
[MAIN THREAD GAP] 2500
```

then we have confirmed:

> The renderer is blocked.

At that point, stop changing sidebar positioning.

Find the expensive task.

---

# STEP 10 — CHECK WHETHER RESIZE TRIGGERS EDITOR CONTENT WORK

Look for resize-triggered operations such as:

- Markdown parsing
- syntax highlighting
- document serialization
- plugin execution
- backlinks calculation
- graph updates
- search indexing
- autosave
- persistence
- IPC
- filesystem operations

A resize event should NOT cause any of those unless there is a very specific reason.

Resize should primarily affect:

```text
geometry
layout
paint
```

not:

```text
document processing
indexing
filesystem
graph computation
```

---

# STEP 11 — CHECK GRAPH

Even though the graph is now very fast during normal use, determine whether it reacts to window resize.

Test:

```text
10 notes
graph closed

10 notes
graph open

20 notes
graph open
```

If the resize problem becomes significantly worse when graph/UI visualization is active, inspect its resize path.

Do not assume because graph interaction is fast that its resize handler is cheap.

---

# STEP 12 — CHECK RIGHTSIDEBAR LAST

Only after measuring the above should RightSidebar be investigated again.

The sidebar may simply be doing:

```text
correct CSS layout
+
renderer blocked
=
visually stale frame
```

The browser cannot paint the correct geometry while JavaScript is monopolizing the renderer.

---

# SUCCESS CRITERIA

The fix should make resize cost approximately independent of the number of open notes.

Conceptually:

```text
1 note   → cheap resize
10 notes → nearly same resize cost
50 notes → nearly same resize cost
```

It does NOT need to be mathematically identical.

But we should NOT have:

```text
1 note   → 5ms
10 notes → 300ms
50 notes → 2000ms
```

That indicates resize work is scaling with editor count.

---

# IMPORTANT ARCHITECTURAL PRINCIPLE

Opening more notes should increase:

```text
memory
document/model count
```

but should NOT make a basic window resize increasingly expensive.

The user should be able to have:

```text
50 open notes
+
large file explorer
+
graph
+
right sidebar
```

and still resize the application smoothly.

---

# FINAL REPORT

Do not report a fix until you can provide:

### 1. Number of live editors

```text
1 note  → X editors
10 notes → X editors
50 notes → X editors
```

### 2. Resize work

```text
1 note  → X ms
10 notes → X ms
50 notes → X ms
```

### 3. Main-thread blocking

```text
1 note  → X ms max gap
10 notes → X ms max gap
50 notes → X ms max gap
```

### 4. Root cause

Identify the exact component/function responsible.

### 5. Fix

Explain exactly what changed.

### 6. Regression test

Confirm:

- 50 tabs remain fast
- tab switching remains fast
- editor editing remains fast
- resize is smooth
- minimize → restore is smooth
- RightSidebar no longer visually lags
- MainLayout no longer gets temporarily covered
