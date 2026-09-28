# Lumina — Deep Performance Investigation: Explorer Clicks & 1.5s Delay

The latest changes are:

* `TabContentPane.tsx`

  * Opening a note now shows an `Opening…` pane while editor initialization finishes.
* `ExplorerOperations.ts`

  * Folder expand/collapse updates now use React lower-priority transitions.

These are useful UX improvements, but they do **not yet prove that the underlying 1.5-second delay has been reduced**.

The next task is therefore NOT to add more transitions, memoization, or loading UI blindly.

We need to identify exactly what consumes the ~1.5 seconds.

---

## PRIMARY OBJECTIVE

Investigate these two interactions separately:

### A. Opening a note from the file explorer

Measure:

```text
Explorer click
    ↓
click handler begins
    ↓
note/tab state mutation
    ↓
TabContentPane mounts/renders
    ↓
document lookup/load
    ↓
editor initialization
    ↓
editor first usable paint
```

### B. Expanding/collapsing a folder

Measure:

```text
folder click
    ↓
click handler begins
    ↓
expanded-state mutation
    ↓
visible tree calculation
    ↓
React reconciliation
    ↓
Virtuoso/list update
    ↓
visible rows paint
```

Do not assume the expensive operation is React rendering.

It could be:

* synchronous JavaScript
* filesystem work
* document parsing
* Markdown parsing
* editor initialization
* ProseMirror/CodeMirror/Lexical initialization
* Zustand subscriptions
* derived selectors
* tree flattening
* virtualization
* layout/reflow
* ResizeObserver callbacks
* IPC
* Electron main-process communication
* garbage collection
* multiple cascading renders

We need evidence.

---

# PHASE 1 — INSTRUMENT THE TWO USER ACTIONS

Add temporary high-resolution instrumentation using:

```ts
performance.now()
```

Do NOT use `console.time()` as the primary measurement.

Create a small helper if useful:

```ts
const mark = (label: string) => {
  performance.mark(label);
};

const measure = (name: string, start: string, end: string) => {
  try {
    performance.measure(name, start, end);
  } catch {}
};
```

Or simply log elapsed milliseconds from a single starting timestamp.

The instrumentation must identify:

```text
[ExplorerPerf] folder-click-start
[ExplorerPerf] folder-state-update
[ExplorerPerf] tree-flatten-start
[ExplorerPerf] tree-flatten-end
[ExplorerPerf] render-start
[ExplorerPerf] render-end
[ExplorerPerf] paint
```

and for notes:

```text
[ExplorerPerf] note-click-start
[ExplorerPerf] tab-open-start
[ExplorerPerf] document-load-start
[ExplorerPerf] document-load-end
[ExplorerPerf] TabContentPane-mount
[ExplorerPerf] editor-init-start
[ExplorerPerf] editor-init-end
[ExplorerPerf] first-visible-paint
```

The goal is to produce an actual timeline.

---

# PHASE 2 — FIND THE REAL NOTE-OPENING COST

Trace the complete path beginning at the explorer click.

Inspect:

* `ExplorerOperations.ts`
* the explorer row click handler
* workspace/tab store actions
* `openTab`
* `activateTab`
* document lookup/loading
* `TabContentPane.tsx`
* editor component initialization
* Markdown parsing
* editor state creation
* plugin/extension initialization
* backlinks/metadata/indexing triggers
* any IPC involved
* any filesystem reads
* Zustand subscriptions triggered by opening the note

Determine whether clicking a note causes unrelated work.

Specifically investigate whether:

```text
open note
```

also causes:

```text
filesystem scan
folder tree rebuild
search index update
backlinks calculation
metadata extraction
graph update
workspace persistence
recent-files update
global store update
all-tab rerender
all-editor resize
```

If any of those happen synchronously on the critical path, identify them.

---

# IMPORTANT — DISTINGUISH "OPEN TAB" FROM "INITIALIZE EDITOR"

The tab itself should become active extremely quickly.

Ideally:

```text
click
  ↓
activate tab
  ↓
paint active tab
  ↓
initialize editor
```

not:

```text
click
  ↓
load everything
  ↓
initialize editor
  ↓
calculate everything
  ↓
finally activate tab
```

The new `Opening…` pane is good for perceived responsiveness, but the architecture should still avoid blocking the main renderer thread.

Determine whether the 1.5 seconds is:

### Case 1 — JavaScript blocking

Example:

```text
click
████████████████████ 1500 ms
                       ↓
                     paint
```

If this is the case, `startTransition()` will not solve the underlying problem.

### Case 2 — React rendering

Example:

```text
click
state update
████████████ render/reconciliation
paint
```

Then identify which components render and why.

### Case 3 — editor initialization

Example:

```text
click
tab active
paint
editor initialization
████████████████ 1500 ms
```

Then optimize editor creation/lifecycle.

### Case 4 — asynchronous I/O

Example:

```text
click
tab active
await document load
████████████████ 1500 ms
editor
```

Then investigate the actual I/O/document pipeline.

### Case 5 — layout/compositor

If JavaScript finishes quickly but the screen updates much later, investigate:

* forced synchronous layout
* ResizeObserver
* editor measurements
* DOM size calculations
* CSS/layout thrashing
* expensive painting

Do not confuse this with React rendering.

---

# PHASE 3 — FOLDER COLLAPSE

Inspect `ExplorerOperations.ts` and everything called by folder expansion/collapse.

We want to know the exact complexity.

For example, determine whether this:

```ts
toggleFolder(folderId)
```

causes:

```text
toggle state
→ flatten entire filesystem tree
→ recreate every node
→ recreate every object
→ recreate every visible row
→ update Virtuoso
```

If so, determine whether the flattening is actually necessary.

Measure:

```text
number of total nodes
number of visible nodes
number of nodes whose visibility actually changed
number of React rows rerendered
time spent flattening
time spent rendering
time spent in Virtuoso
```

The ideal collapse operation should be approximately proportional to the affected visible subtree, not the entire vault.

For example:

```text
Folder A
 ├─ file 1
 ├─ file 2
 ├─ folder B
 │   ├─ file 3
 │   └─ file 4
 └─ file 5
```

Collapsing `Folder A` should not require rebuilding unrelated branches.

---

# PHASE 4 — RENDER COUNTERS

Temporarily add render counters to the important components:

```text
FileExplorer
ExplorerVirtuosoList
ExplorerSelection
SortableListItem
TabContentPane
editor component
folder row
file row
```

Log:

```text
component
render count
reason
```

Especially measure a single folder collapse.

Example:

```text
Folder collapse:

FileExplorer: +1
ExplorerVirtuosoList: +1
FolderRow: +1
FileRow: +0
UnrelatedFolderRow: +0
```

That would be healthy.

If instead you see:

```text
FileExplorer: +1
ExplorerVirtuosoList: +1
500 rows: rerendered
```

we have found a major problem.

Likewise for opening one note:

```text
click Note A

TabContentPane(A): +1
TabContentPane(B): +0
TabContentPane(C): +0
...
```

We should NOT be rendering every open editor merely because one note was activated.

---

# PHASE 5 — INVESTIGATE THE 10-NOTE THRESHOLD

There is another important clue:

The application behaves well with a small number of open notes but becomes noticeably worse around ~10 notes.

That strongly suggests some work is scaling with the number of mounted editors/tabs.

Test exactly:

```text
1 note
5 notes
10 notes
20 notes
50 notes
```

For each configuration measure:

### Opening a note

```text
click → active tab visible
```

### Folder collapse

```text
click → collapsed tree visible
```

### Window resize

```text
resize start → stable layout
```

Record:

```text
total duration
React commit duration
number of component renders
number of editor renders
number of ResizeObserver callbacks
number of resize handlers
number of DOM measurements
number of IPC calls
```

We need to determine whether the cost scales approximately:

```text
O(1)
O(number of visible rows)
O(number of open tabs)
O(number of mounted editors)
O(number of files)
O(number of total tree nodes)
```

This is extremely important.

---

# PHASE 6 — CHECK HIDDEN EDITORS

Inspect `TabContentPane.tsx` carefully.

Determine whether inactive editors are:

### Option A

```text
mounted but hidden
```

or

### Option B

```text
unmounted
```

or

### Option C

```text
mounted but effectively frozen/inactive
```

If 50 editors are mounted, determine whether each one still:

* observes DOM size
* listens to resize
* recalculates layout
* updates selection
* runs effects
* subscribes to Zustand
* processes editor state
* performs syntax highlighting
* reacts to window resize
* runs MutationObservers
* runs ResizeObservers
* schedules animation frames

An inactive editor should ideally do almost no expensive work.

---

# PHASE 7 — RESIZE OBSERVER AUDIT

Because we have already observed the window resize problem when many notes are open, explicitly search the codebase for:

```text
ResizeObserver
window.addEventListener("resize"
addEventListener("resize"
requestAnimationFrame
requestIdleCallback
MutationObserver
getBoundingClientRect
offsetWidth
offsetHeight
clientWidth
clientHeight
scrollHeight
```

For every occurrence determine:

1. Which component owns it?
2. Is it per editor?
3. Is it cleaned up?
4. Does it run when the editor is hidden?
5. Does it trigger state updates?
6. Can 10/20/50 editors trigger it simultaneously?

This may reveal that the folder/open-note delay and the resize delay share the same underlying architecture problem.

---

# PHASE 8 — CHECK FOR SYNCHRONOUS STORE CASCADES

Audit Zustand subscriptions involved in:

```text
activeTabId
openTabs
selectedSnippetId
selectedNoteIds
expandedFolders
documents
editor state
workspace state
```

Look for selectors that return fresh objects/arrays/sets:

```ts
state => ({
  ...
})
```

or:

```ts
state => new Set(...)
```

or:

```ts
state => [...state.someArray]
```

or derived values that are recalculated for every store update.

Determine whether opening one note causes unrelated components to receive new references.

Pay particular attention to:

```text
FileExplorer
MainLayout
TabBar
TabContentPane
Editor
RightSidebar
Graph
StatusBar
```

---

# PHASE 9 — DO NOT ACCEPT "START TRANSITION" AS THE FINAL FIX

`startTransition()` is useful when the work is React scheduling work.

But if the operation contains:

```text
JSON parsing
large array transformation
filesystem operation
synchronous editor construction
large Markdown parse
DOM measurement
expensive JavaScript loop
```

then putting the state update inside:

```ts
startTransition(...)
```

does not make that synchronous work disappear.

Likewise, rendering:

```text
Opening...
```

does not make a 1.5-second main-thread block disappear.

We need to know whether the UI is genuinely yielding.

---

# PHASE 10 — ACCEPTANCE CRITERIA

Do not report "improved" merely because the interaction feels better.

Produce measured results.

Create a table like:

| Operation       | Notes | Before | After | Main cost |
| --------------- | ----: | -----: | ----: | --------- |
| Open note       |     1 |      ? |     ? | ?         |
| Open note       |    10 |      ? |     ? | ?         |
| Open note       |    20 |      ? |     ? | ?         |
| Open note       |    50 |      ? |     ? | ?         |
| Collapse folder |     1 |      ? |     ? | ?         |
| Collapse folder |    10 |      ? |     ? | ?         |
| Collapse folder |    20 |      ? |     ? | ?         |
| Collapse folder |    50 |      ? |     ? | ?         |
| Window resize   |     1 |      ? |     ? | ?         |
| Window resize   |    10 |      ? |     ? | ?         |
| Window resize   |    20 |      ? |     ? | ?         |

Use the same test procedure each time.

---

# FINAL DELIVERABLE

After investigation, report:

## 1. Root cause

State the specific operation responsible for the delay.

Not:

> "React seems slow."

Instead:

> "Opening a note causes X, which synchronously performs Y, taking approximately Z ms."

## 2. Scaling behavior

State whether the cost scales with:

```text
open tabs
mounted editors
visible tree nodes
total files
folder depth
```

## 3. Evidence

Include actual measured timings and render counts.

## 4. Minimal fix

Identify the smallest architectural change that removes the bottleneck.

## 5. Secondary optimizations

Only after the primary bottleneck is identified.

## 6. Regression check

Verify:

* 1 note
* 10 notes
* 20 notes
* 50 notes
* folder expand
* folder collapse
* opening notes
* rapid note switching
* window resize/maximize

Do not make broad architectural changes until the measurements identify the bottleneck.

The goal is not merely to make the UI *look* responsive.

The goal is to make the underlying interaction genuinely fast.
