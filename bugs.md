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
