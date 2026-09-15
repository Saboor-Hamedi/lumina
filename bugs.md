Viewed package.json:1-70

Error: The stream was interrupted. Please continue the task you were working on. (Error ID: 679fddc9-d386-499f-87e0-11af7ff7a182-942-2010)

Error: The stream was interrupted. Please continue the task you were working on. (Error ID: 679fddc9-d386-499f-87e0-11af7ff7a182-944-2010)

Viewed package.json:71-139
Searched for files: *vite.config*
Viewed electron.vite.config.mjs:1-50
Viewed App.jsx:1-54
Viewed MainLayout.jsx:1-100
Viewed AppModals.jsx:1-60
Viewed workspaceStore.js:1-100
Viewed workspaceStore.js:200-300
Searched for "getSnippets"
Viewed workspaceManager.js:605-640

Error: The stream was interrupted. Please continue the task you were working on. (Error ID: 679fddc9-d386-499f-87e0-11af7ff7a182-966-2010)

Viewed workspaceManager.js:200-260
Viewed workspaceManager.js:270-350
Viewed workspaceScanner.js:1-80
Viewed workspaceScanner.js:250-330
Viewed Sidebar.jsx:1-17
Searched for "useVaultStore"
Viewed FileExplorer.jsx:520-580
Viewed TabContentPane.jsx:1-83
Viewed Editor.jsx:1-60
Viewed B:\electron\lumina\src\renderer\src\features\Editor\EditorCanvas.jsx:2-61
Searched for files: *EditorCanvas*
Searched for "@xenova/transformers"
Viewed analyze-bundle.js:1-60
Ran command: `npm run analyze:bundle`

I am analyzing the application dependencies and bundle metrics to identify real performance bottlenecks.

Here is a comprehensive performance audit of the Lumina architecture (**Electron + React 19 + Zustand + Three.js + Vite**), categorized by impact.

---

### 1. Initial Launch & Bundle Size (Highest Impact)

#### **Issue: Heavy dependencies are bundled into the initial startup chunk**
- Currently, [MainLayout.jsx](file:///B:/electron/lumina/src/renderer/src/features/Layout/MainLayout.jsx) and [AppModals.jsx](file:///B:/electron/lumina/src/renderer/src/features/Layout/AppModals.jsx) statically import:
  - `Graph` (pulls in `three`, `react-force-graph-2d`, `react-force-graph-3d`, `d3-force`)
  - `CanvasDrawerModal` (pulls in the full infinite spatial canvas, geometric shape algorithms, SVG/PNG export engines)
  - `PDFViewerTab` (pulls in `pdf-lib`)
  - `Settings`, `Theme`, `Documentation`, `Guide` modals
- Only `LuminaChat` is currently lazy-loaded with `React.lazy()`.
- **Result**: On first app launch, the V8 engine has to parse and compile Three.js, PDF rendering engines, and the canvas system before showing the main window, adding noticeable startup latency.

#### **Recommended Action:**
1. **Lazy-load heavy modals and viewers**:
   ```javascript
   const Graph = React.lazy(() => import('../Graph/Graph'))
   const CanvasDrawerModal = React.lazy(() => import('../canvas/CanvasDrawerModal'))
   const PDFViewerTab = React.lazy(() => import('../media/PDFViewerTab'))
   const Settings = React.lazy(() => import('../Settings/Settings'))
   const Documentation = React.lazy(() => import('../Docs/Documentation'))
   ```
2. **Configure manual Rollup chunks in [`electron.vite.config.mjs`](file:///B:/electron/lumina/electron.vite.config.mjs)**:
   Isolate large vendor libraries (`three`, `codemirror`, `pdf-lib`, `mermaid`) into separate async chunks so the core renderer bundle stays ultra-slim.

---

### 2. IPC & Vault Scaling (Scalability for large vaults)

#### **Issue: Full file text broadcast across IPC on every change**
- In [workspaceScanner.js](file:///B:/electron/lumina/src/main/workspace/workspaceScanner.js) and [workspaceManager.js](file:///B:/electron/lumina/src/main/workspace/workspaceManager.js):
  - When scanning or watching the vault, the main process reads the **full text (`code`)** of every single file and passes the entire array across the Electron IPC bridge to the renderer (`useVaultStore.snippets`).
- When a vault grows to 500–2,000+ notes or contains large canvas/markdown files, serializing and deserializing tens of megabytes of JSON over IPC on every file change causes micro-stutters.

#### **Recommended Action:**
- **Separate Metadata from Note Body**:
  - `getSnippets()` should return note headers and metadata only: `{ id, title, relativePath, folderId, timestamp, tags, type, size }`.
  - Fetch the actual document body `code` on-demand via `readSnippet(id)` only when a note is opened in a tab.
- **Delta IPC updates**:
  - Instead of re-broadcasting the full `snippets` array on every watcher event, emit incremental events: `{ action: 'updated', snippet }` or `{ action: 'deleted', id }`.

---

### 3. DOM & GPU Resource Management Across Tabs

#### **Issue: All open tabs remain mounted in the DOM**
- [TabContentPane.jsx](file:///B:/electron/lumina/src/renderer/src/features/Layout/TabContentPane.jsx) keeps all open tabs mounted in the DOM simultaneously using `opacity: 0; visibility: hidden;` to preserve scroll positions and editor history.
- If a user opens 10+ tabs (including multiple spatial Canvases and Graph tabs), multiple WebGL contexts and CodeMirror DOM trees remain active in memory. Chromium has a hard limit of concurrent active WebGL contexts (~8 to 16) before context loss occurs.

#### **Recommended Action:**
- **LRU Tab Pool (e.g. 3–5 active tabs)**:
  - Keep the active tab and the 2–3 most recently visited tabs mounted for instant switching.
  - For older inactive tabs, unmount the heavy DOM node and store lightweight state (scroll percentage, cursor offset) in memory.
- **Pause Inactive Tab Loops**:
  - In inactive Canvas and Graph tabs, explicitly pause `requestAnimationFrame` loops when `!isSelected` so background tabs consume 0% GPU.

---

### 4. Zustand Store Granularity & Component Re-renders

#### **Issue: Sidebar and file tree re-render on note content changes**
- In [FileExplorer.jsx](file:///B:/electron/lumina/src/renderer/src/features/Explorer/FileExplorer.jsx), the component subscribes to `snippets = useVaultStore(s => s.snippets)`.
- When a note is auto-saved while typing in the editor, `state.snippets` gets an updated reference, causing `FileExplorer` to re-evaluate its folder groupings and trigger re-renders even though the file tree structure hasn't changed.

#### **Recommended Action:**
- Split `useVaultStore`:
  - **Tree Store (`vaultMetadata`)**: Contains paths, folder structures, file names, and file IDs. Updates only on create/rename/move/delete.
  - **Editor Store (`activeDocument`)**: Contains dirty states, drafts, and active note content.
- This ensures typing in an editor never triggers a render in the navigation sidebar or file tree.

---

### 5. Graphics & Three.js Cleanup

#### **Current State & Opportunity:**
- We already implemented floating sidebar overlays, link LOD culling, and hover caching in the Graph view.
- To prevent long-term memory leaks during extended sessions:
  - Ensure all Three.js geometries and textures in `Graph3D` call `.dispose()` when switching views or unmounting.
  - Use `cancelAnimationFrame` consistently in custom animation hooks when windows are minimized or hidden.

---

### Summary Priority Matrix

| Priority | Optimization | Effort | Impact |
|---|---|---|---|
| **P0** | **Lazy-load Graph, Canvas, PDF, Settings modals (`React.lazy`)** | Low | Cuts initial bundle size by ~50% & noticeably speeds up cold launch. |
| **P1** | **Lazy-load note bodies on demand (Metadata vs. Body)** | Medium | Keeps RAM low and removes IPC serialization lag on large vaults. |
| **P2** | **LRU Tab Mounting & Pause Inactive Canvas/Graph loops** | Medium | Drastically reduces GPU & memory consumption with many open tabs. |
| **P3** | **Split Vault Tree Metadata from Active Editor Text** | Low-Medium | Eliminates unnecessary re-renders in the file tree while typing. |