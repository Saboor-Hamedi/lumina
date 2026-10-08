# Resolved Issues & Bugs

## 1. Electron Binary Missing on Fresh Install — [COMPLETED]

**Issue:**

```
Error: Electron uninstall
at getElectronPath (node_modules/electron-vite/dist/chunks/lib-ClgyQuZx.js:132:19)
at startElectron (node_modules/electron-vite/dist/chunks/lib-ClgyQuZx.js:205:26)
```

**Root Cause:**
When running `npm install`, lifecycle script execution can skip or interrupt `node_modules/electron/install.js`, leaving `path.txt` and `electron.exe` missing in `node_modules/electron/dist/`.

**Permanent Automation:**

- Created [`scripts/ensure-electron.mjs`](file:///b:/electron/lumina/scripts/ensure-electron.mjs) which verifies `require('electron')` before dev or build runs.
- If missing, it automatically triggers `node node_modules/electron/install.js` and configures `path.txt`.
- Added to `predev` and `prebuild` in [`package.json`](file:///b:/electron/lumina/package.json).
- Result: Even after completely removing `node_modules`, `npm run dev` and `npm run build` will automatically ensure the Electron binary is present and launch seamlessly.

## 2. Vite Worker Code-Splitting Build Error (`Invalid value "iife" for option "worker.format"`) — [COMPLETED]

**Issue:**
```
[vite:worker-import-meta-url] Invalid value "iife" for option "worker.format" - UMD and IIFE output formats are not supported for code-splitting builds.
file: .../src/renderer/src/features/AI/services/aiWorkerManager.ts
```

**Root Cause:**
Vite's default format for worker bundles is `'iife'`. In the renderer, `aiWorkerManager.ts` initializes a Web Worker for `@xenova/transformers`, which uses dynamic imports and produces multiple split chunks. Rollup rejects multi-chunk code-splitting when target format is IIFE or UMD.

**Fix:**
Added `worker: { format: 'es' }` to the `renderer` config section in [`electron.vite.config.mjs`](file:///b:/electron/lumina/electron.vite.config.mjs). This instructs Vite to bundle workers as ES modules, which seamlessly supports code-splitting and aligns with modern Electron Chromium renderer behavior (`type: 'module'`). Verified full `npm run build` succeeds cleanly.

