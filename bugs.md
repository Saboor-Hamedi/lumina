# Lumina RightSidebar — Maximize/Restore Layout Synchronization Fix

## Context

There is currently a specific layout bug involving:

`src/renderer/src/features/Inspector/RightSidebar.tsx`

### Reproduction

1. Launch Lumina.
2. Maximize the window.
3. Minimize the application.
4. Restore/maximize the application again.
5. Observe the RightSidebar.

### Current behavior

When the application is restored/maximized:

- The main application appears.
- The RightSidebar initially renders in an incorrect horizontal position / appears displaced.
- After a short moment, another layout/resize/render pass occurs.
- The RightSidebar then moves/snaps into its correct position.

This is visually noticeable.

## Objective

Fix the underlying layout synchronization problem so that:

> **When Lumina is restored/maximized, the RightSidebar is positioned correctly on its first visible layout frame.**

Do NOT simply add an arbitrary `setTimeout()` such as 100ms/200ms to hide the problem.

Do NOT introduce animation to disguise the issue.

Do NOT continuously poll the sidebar position.

We need to identify why the sidebar is initially using stale geometry.

---

# Phase 1 — Inspect the Architecture

First inspect the complete layout chain around:

- `RightSidebar.tsx`
- its parent component
- `MainLayout`
- the central editor/content area
- any left sidebar
- any resizable panel implementation
- window resize handling
- Electron BrowserWindow resize/maximize/restore events
- Zustand stores involved in layout/sidebar state
- CSS containing:
  - `position`
  - `absolute`
  - `fixed`
  - `sticky`
  - `width`
  - `right`
  - `left`
  - `transform`
  - `calc()`
  - viewport units
  - flex/grid sizing
  - `ResizeObserver`
  - `window.innerWidth`
  - `window.innerHeight`
  - `clientWidth`
  - `offsetWidth`
  - `getBoundingClientRect()`

Determine exactly how RightSidebar decides:

- its x position
- its width
- its parent/container dimensions
- its vertical position
- whether it is inside or outside the main layout flow
- whether its geometry comes from React state
- whether its geometry comes directly from CSS
- whether geometry is cached

Do not modify code yet.

---

# Phase 2 — Identify the Stale Geometry

We need to determine whether the problem is caused by:

### Possibility A — stale `window.innerWidth`

For example:

```ts
const right = window.innerWidth - something
```

being calculated before the restored window has reached its final dimensions.

### Possibility B — stale parent dimensions

For example:

```ts
const rect = container.getBoundingClientRect()
```

being measured during an intermediate layout state.

### Possibility C — React state lag

For example:

```text
Electron resize
    ↓
window dimensions change
    ↓
layout state updates
    ↓
RightSidebar renders
```

where the sidebar temporarily renders using the previous dimensions.

### Possibility D — CSS transform/layout transition

Look specifically for:

```css
transform: translateX(...);
```

or transitions that can cause the sidebar to visually remain in its previous geometry before settling.

### Possibility E — flex/grid reflow

The sidebar may be correctly participating in a flex/grid layout, but some parent is temporarily using stale width/height constraints during maximize restoration.

### Possibility F — ResizeObserver timing

If ResizeObserver is involved, verify whether:

- it observes the correct element
- it updates state
- the sidebar renders once before observer geometry arrives
- observer callbacks cause the second corrective movement

### Possibility G — Electron restore/maximize lifecycle

Investigate whether Lumina is reacting to:

- `resize`
- `maximize`
- `unmaximize`
- BrowserWindow bounds changes

and whether multiple events occur during restoration.

---

# Phase 3 — Instrument the Geometry

Before fixing it, temporarily add development-only instrumentation.

Capture the following whenever the RightSidebar calculates or receives its geometry:

```ts
{
  timestamp: performance.now(),
  windowWidth: window.innerWidth,
  windowHeight: window.innerHeight,
  devicePixelRatio: window.devicePixelRatio,
  sidebarRect: sidebarElement?.getBoundingClientRect(),
  parentRect: parentElement?.getBoundingClientRect(),
}
```

Also log:

```ts
window.visualViewport?.width
window.visualViewport?.height
```

if available.

The goal is to answer:

> **What dimensions does Lumina think the window/container has on the first render after restore, and what dimensions does it have when the sidebar finally snaps into place?**

Do not leave noisy logging permanently enabled.

---

# Phase 4 — Prefer Layout-Driven Positioning

If RightSidebar is currently calculating its own absolute position from JavaScript, determine whether that calculation is actually necessary.

Prefer:

```text
Application Layout
├── Main Content
└── Right Sidebar
```

with CSS controlling the relationship where possible.

For example, if the sidebar naturally belongs to the right edge of the application, prefer a layout structure such as:

```css
.appLayout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
}

.rightSidebar {
  width: var(--sidebar-width);
}
```

or an equivalent flex architecture.

The goal is:

> The browser should calculate the sidebar's position from the current layout geometry instead of React calculating an x-coordinate.

Do NOT blindly convert the existing architecture to grid/flex. Only do this if the current implementation is unnecessarily geometry-driven.

---

# Phase 5 — If JavaScript Measurement Is Required

If the sidebar genuinely requires measurement, make the measurement lifecycle robust.

Prefer observing the actual layout container:

```ts
const observer = new ResizeObserver((entries) => {
  const entry = entries[0]

  // derive geometry from the current element
})
```

rather than assuming that a `window.resize` event alone represents the final layout.

If a measurement must happen synchronously before paint, evaluate whether `useLayoutEffect` is appropriate.

Example pattern:

```ts
useLayoutEffect(() => {
  // measure DOM after React commits
  // update geometry if required
}, [dependencies])
```

However:

**Do not blindly replace `useEffect` with `useLayoutEffect`.**

First establish that the visual jump occurs because geometry is being measured after the first paint.

---

# Phase 6 — Handle Resize/Restore as a Geometry Event

If Electron/window resize events are being mirrored into Zustand or React state, inspect that pipeline.

We want something conceptually like:

```text
OS window state changes
        ↓
Browser viewport changes
        ↓
DOM layout recalculates
        ↓
ResizeObserver / layout measurement
        ↓
Sidebar receives final geometry
```

Avoid architectures like:

```text
Electron maximize event
        ↓
guess new width
        ↓
store width
        ↓
render sidebar
        ↓
browser eventually recalculates actual viewport
        ↓
second render
        ↓
sidebar snaps
```

The browser's actual layout should be the source of truth whenever possible.

---

# Phase 7 — Check for CSS Transitions

Inspect the sidebar and all relevant parent containers for:

```css
transition: all...;
```

or transitions involving:

```css
left
right
top
bottom
width
height
transform
margin
padding
```

A particularly suspicious pattern would be:

```css
transition: all 0.2s ease;
```

on a layout container.

If the sidebar is simply correcting its geometry, we should NOT animate that correction.

Replace broad layout transitions with explicit transitions only where animation is genuinely intended.

---

# Phase 8 — Check ResizeObserver / Effect Loops

Make sure the fix does not create:

```text
ResizeObserver
    ↓
setState
    ↓
render
    ↓
ResizeObserver
    ↓
setState
    ↓
render
```

The observer should only update state when the relevant geometry actually changed.

Use equality checks where necessary.

For example:

```ts
if (
  previousWidth !== width ||
  previousHeight !== height
) {
  updateLayout(...)
}
```

Do not create a continuously updating geometry loop.

---

# Phase 9 — Preserve Performance

This is important.

Lumina already handles large numbers of tabs smoothly, so do NOT solve this by introducing a global resize state that causes the entire application to re-render.

Avoid:

```ts
useWorkspaceStore((state) => state.windowWidth)
```

inside many components unless those components genuinely need it.

The resize/geometry update should be scoped to the components that actually depend on it.

Prefer:

```text
Window resize
    ↓
Layout container
    ↓
RightSidebar geometry
```

rather than:

```text
Window resize
    ↓
global store
    ↓
MainLayout
    ↓
FileExplorer
    ↓
Tabs
    ↓
Editors
    ↓
Graph
    ↓
RightSidebar
```

The maximize/restore fix must not regress the performance architecture we just established.

---

# Phase 10 — Verify With a Stress Test

After implementing the fix, test all of these:

### Test 1 — Normal resize

Drag the window edge repeatedly.

Expected:

- sidebar remains correctly positioned
- no visible jumping
- no accumulating offset

### Test 2 — Maximize

```text
Normal
→ Maximize
```

Expected:

- sidebar is correct immediately

### Test 3 — Minimize → Restore

```text
Maximized
→ Minimize
→ Restore
```

Expected:

- sidebar is correct on the first visible frame
- no delayed snap

### Test 4 — Maximize → Unmaximize

```text
Maximized
→ Restore
→ Maximize
```

Repeat 10–20 times.

Expected:

- no positional drift

### Test 5 — With many tabs

Keep approximately 50 tabs open.

Repeat minimize/restore.

Expected:

- sidebar correct
- tab performance unchanged

### Test 6 — With large explorer

Use a large workspace/file tree.

Repeat minimize/restore.

Expected:

- sidebar correct
- no explorer-wide rerender storm

### Test 7 — Different sidebar widths

If RightSidebar is resizable:

1. Make it narrow.
2. Make it wide.
3. Minimize.
4. Restore.
5. Maximize/unmaximize repeatedly.

Expected:

- width preserved correctly
- position remains correct

---

# Acceptance Criteria

The fix is complete only when:

### Visual

- RightSidebar appears in the correct position immediately after maximize/restore.
- There is no visible "wrong position → snap into position" behavior.
- No arbitrary timeout is required.
- No animation is being used to hide the problem.
- No positional drift occurs after repeated maximize/unmaximize cycles.

### Architectural

- Actual DOM/layout geometry is the source of truth where possible.
- JavaScript measurements are only used where genuinely necessary.
- ResizeObserver is used where appropriate for container geometry.
- No unnecessary global resize state is introduced.
- No polling loop is introduced.

### Performance

With ~50 tabs open:

- minimize/restore remains responsive
- tab switching remains fast
- RightSidebar correction does not trigger a broad application rerender
- FileExplorer does not rebuild unnecessarily
- editor panes do not all rerender

---

# Final Report

After implementing the fix, report:

1. Root cause.
2. Exact files changed.
3. What caused the initial incorrect sidebar position.
4. Why the sidebar subsequently snapped into place.
5. Exact architectural fix.
6. Whether ResizeObserver/useLayoutEffect/CSS/layout changes were required.
7. Confirmation that no timeout/polling hack was introduced.
8. Performance impact.
9. Results from:
   - maximize
   - minimize → restore
   - maximize ↔ unmaximize
   - 50 open tabs
   - large file explorer

Most importantly:

**Do not stop at "it looks fixed."**

Identify the actual source of the stale geometry and fix that source.

The target behavior is:

> **Window restored → browser lays out → RightSidebar is already exactly where it belongs. No second visual correction.**
