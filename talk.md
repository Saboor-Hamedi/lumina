# Lumina — Codebase Audit & Improvement Report

Deep read-only audit of the `lumina` codebase (Electron 39 + React 19 + CodeMirror 6 + Rust N-API core).
Findings are grouped by severity. `★` marks items verified by reading the code directly.

---

## 1. Critical Bugs

### 1.1 ★ Path traversal — arbitrary file delete/write
- `src/main/workspace/workspaceOperations.ts:434` (`bulkDelete`) and `:233,:260` (`saveSnippet`) call `path.join(workspacePath, rendererInput)` with **no** `assertSafeWorkspacePath` call.
- `assertSafeWorkspacePath` exists at `:338` but is not used on these write/delete paths.
- `isProtectedPath` (`:327`) only rejects segments starting with `.`, so `..\..\..\` passes.
- **Impact:** a malicious/buggy renderer or imported content can recursively delete or overwrite files anywhere on disk. Highest-severity issue.
- Same class of bug in: `importExternalPaths` (`:711`), `workspaceMediaManager.ts:69` (`saveWorkspaceImage`), `workspaceHandlers.ts:81-121` (`saveImageFromPath`), `workspaceHandlers.ts:288` (`open-folder`), `systemHandlers.ts:151` (`shell:openPath`) — all accept unvalidated renderer paths.

### 1.2 ★ Settings save silently lost after a failure
- `src/main/settings/settingsManager.ts:645` assigns `lastWrittenData = data` **before** `fs.writeFile` at `:647`.
- The `catch` at `:650` only logs; `isWriting` is set but never read.
- **Impact:** if a write fails, the next identical save early-returns at `:641` and the change is permanently lost while reporting success.

### 1.3 localStorage purge silently drops localStorage-only state (NOT settings-backed data)
- `src/renderer/src/main.jsx:44-53` deletes every `localStorage` key except `theme-id` and `theme-colors` at boot.
- **Persistence architecture (verified):** the source of truth is `settings.json` in the main process (`SettingStore.init` hydrates via `api.getSetting`, `:221-232`; every write calls `api.saveSetting`/`api.saveSettings`, `:363-367,415-420`). Chat sessions live in IndexedDB/Dexie (`chatStorage.ts` → `core/db/cache.js`), with localStorage only a legacy migration fallback (`chatStorage.ts:31-46,151`). **localStorage is a cache / FOUC layer only.**
- **Therefore the purge does NOT lose:** chat history (Dexie), AI keys (`deepSeekKey`/`groqKey`/etc. are encrypted in `settings.json` and re-hydrated), email geometry, expanded folders, `lumina_modern_ui`, `lumina_modal_maximized_preview`, `useBorderLeft`. `lumina_graph_display_mode` is even dead — the read path uses `settings.graphDisplayMode` (`MainLayout.tsx:902`).
- **Genuinely affected (localStorage-only, no other backing store):**
  - `lumina_graph_node_positions` (`graphExport.ts:17,43,61`; read `Graph.tsx:243`, written `:549`) → graph node-position persistence (a README claim) is broken across restarts.
  - `lumina_ai_usage_stats` (`lumina.ts:130,326,346`) → AI usage telemetry resets.
  - `lumina-active-session-id` (`chatStorage.ts:80-105`) → active chat resets to most-recent (sessions survive in Dexie).
  - UI toggles `lumina_ai_sessions_sidebar_open` (`Lumina.tsx:43`), `lumina-canvas-studio-expanded` (`ConvasToolBarRight.tsx:83`), `lumina_backup_mode` (`SettingDropdown.tsx:126`) reset.
  - `lumina_active_theme_colors` (`themeDefinitions.ts:165`) is a derived theme cache, regenerated on load.
- **Minor cosmetic side effect:** `useBorderLeft` and `lumina_modern_ui` are read synchronously for immediate paint (`SettingStore.ts:131`, `useFontSettings.ts:146`) but are purged, so there is a one-frame flash until `getSetting()` resolves.
- **Corrected severity: Low–Medium** (not critical data loss). Fix: add the localStorage-only keys to the `allowedKeys` allowlist, or migrate those few keys to `settings.json`/Dexie and drop the purge.

### 1.4 ★ Rules-of-Hooks crash in canvas edges
- `src/renderer/src/features/canvas/components/edges/CanvasEdgeItem.tsx:73` returns `null` before calling `useState`/`useMemo`/`useEffect` (`:75+`).
- **Impact:** an edge that is dangling on one render and resolves on the next flips the hook count → "Rendered fewer hooks than expected" and crashes the canvas layer. Move all hooks above the guard.

### 1.5 ★ `summarizeNotes` used but never imported
- `src/renderer/src/features/Navigation/components/SidebarItem.tsx:69` calls `summarizeNotes(snippet)`; grep confirms exactly one occurrence, no import.
- **Impact:** right-click → Summary throws `ReferenceError` and the action silently dies. Import from `../../AI/services/summarizeNotes`.

### 1.6 ★ Table row/column delete is dead code
- `src/renderer/src/features/table/tableSelection.ts:367` has an unconditional `return`.
- Full-row delete (`:369-383`) and full-column delete (`:385-422`) are unreachable.
- **Impact:** deleting a selected row/column only clears cell contents; the row/column is never removed.

### 1.7 Native Rust core almost never loads on Windows
- `src/main/workspace/nativeEngine.ts:119` selects only the **first** `.node` file in a directory; `readdirSync` order puts `…win32-x64-gnu.node` before `…msvc.node`.
- The `catch` at `:127` moves to the next **directory**, not the next `.node` file.
- **Impact:** Electron (MSVC) fails to load the gnu binary, silently falls back to JS. Iterate every `.node`, prefer ABI match.

### 1.8 Backup zip stream has no error handler
- `src/main/backup/luminaZipBackup.js:15-22` only handles `stream.on('close')` and `archive.on('error')`.
- **Impact:** a write-stream error is unhandled (can crash main or leave the promise pending forever); archive/fd never destroyed.

### 1.9 Concurrent backups share one temp file
- `src/main/backup/luminaZipBackup.js:139` uses a fixed `lumina-backup.zip` in temp.
- `src/main/backup/googleDriveBackup.js:31-48` `cancelBackup()` aborts the signal but does not await the prior run; `zipDirectory` ignores the signal.
- **Impact:** overlapping backups corrupt the shared zip; the first run's `finally` (`:183-191`) unlinks the file the second is reading.

### 1.10 `ai:generateImage` channel has no handler
- `src/preload/index.js:195-196` exposes `generateImage`; no `ipcMain.handle('ai:generateImage')` exists.
- **Impact:** every call rejects with "No handler registered". Dead/broken API.

---

## 2. Security

### 2.1 Full IPC + process env exposed to renderer
- `src/preload/index.js:227` exposes the raw `electronAPI` from `@electron-toolkit/preload`.
- That provides unrestricted `ipcRenderer.send/sendSync/invoke/on/once/removeAllListeners` and `process.env`.
- Leaks `GOOGLE_CLIENT_SECRET` / `VITE_GOOGLE_CLIENT_SECRET`; makes the curated `api` allowlist cosmetic; any renderer XSS can reach every IPC channel.
- `:251/:270` also auto-opens DevTools on the first renderer error in production.

### 2.2 OAuth weaknesses
- `src/main/auth/googleAuth.js:58` builds the auth URL with **no `state`**; callback (`:99`) never validates state → login CSRF.
- `:397` server binds `0.0.0.0` not `127.0.0.1`; no `listen('error')` handler (busy port throws `EADDRINUSE`).
- `:9` `authServer` is a module global; timers at `:324,402` close whatever `authServer` points to → a second login within 120 s gets its server closed by the first attempt's timer.

### 2.3 Refresh token stored in plaintext and exposed
- `src/main/settings/crypto.ts:23-34` `encryptKey` returns non-string values untouched; `googleUser` is an object → written unencrypted in `app_config.json`.
- `settingsManager.ts:668` spreads api keys into `getAll()`; `settingsHandlers.ts:26-32` returns them to the renderer; `googleAuth.js:412-419` returns the full user incl. `refreshToken`.

### 2.4 Gmail injection
- `src/main/email/gmailService.ts:329-335` interpolates `From/To/Cc/Bcc/In-Reply-To/References` with no CRLF stripping → email header injection.
- `:385` interpolates `maxResults` raw; `:417,469,575,603` interpolate message `id` unencoded, all renderer-controlled.

### 2.5 SSRF via renderer-supplied URL
- `src/main/handlers/aiHandlers.ts:31-92` and `src/main/lumina/ollamaChatStream.js:31-33` parse a renderer `url` and `net.fetch` an arbitrary `${proto}//${host}:${port}`.
- **Impact:** main-process requests to arbitrary/internal hosts, bypassing renderer CSP.

### 2.6 Backup path exfiltration
- `src/main/backup/luminaNonZipBackup.js:293-336` `resolveFilePaths` accepts absolute paths and `../` with no workspace containment.
- **Impact:** renderer can upload any local file (e.g. token-bearing `app_config.json`) to the user's Google Drive.

### 2.7 Export HTML/XSS injection
- `src/export/exportUtils.ts:227-232` substitutes raw wikilink text into HTML, then feeds it to `marked` (no sanitization) → `[[<img src=x onerror=...>]]` executes in exported HTML/PDF and in-app preview.
- Unescaped titles in `exportHTML.ts:29-39`, `exportDocs.ts:31`, `exportBundle.ts:60`.

### 2.8 Web security / sandbox defaults
- `src/main/app/windowManager.ts:96-98`: `webSecurity: app.isPackaged` (off in dev) and `sandbox: false`.
- `src/main/app/protocolManager.ts:34-45`: `asset://` registered `bypassCSP: true` + `secure`, serves arbitrary file types without size cap; containment check (`:87`) is case-sensitive and does not resolve symlinks.
- `src/renderer/index.html:16`: CSP allows `'unsafe-inline'` scripts and `https://cdn.jsdelivr.net`.

### 2.9 Secrets / packaging
- `src/main/auth/googleOAuthConstants.ts:17-23` reads `GOOGLE_CLIENT_SECRET` from env, but `electron-builder.yml:14` excludes `.env*` with no `extraResources` → production login/Gmail/Drive break.
- `.env-local` is tracked in git and packaged into `app.asar` (`electron-builder.yml:14` glob doesn't match `.env-local`).
- `src/main/handlers/systemHandlers.ts:98-125`: unsanitized renderer `message/stack` appended to log files with no rotation → log injection + disk-fill DoS.
- `src/main/handlers/systemHandlers.ts:128-148`: `execSync` PowerShell on the main thread (up to 1 s block) callable from renderer.

---

## 3. Resource Leaks & Performance

### Renderer
- **Table listeners leak per widget rebuild**: `tableExtension.ts:497-501` discards the cleanup returns of `setupTableSelection`/`setupTableColResizing`/`setupTableFormattingToolbar`; `TableWidget.destroy` only calls `disposeCellListeners`. Global `document`/`window` handlers accumulate unbounded (`tableSelection.ts:138,201,245,261,272`).
- **Object URLs never revoked**: `CanvasImagePreview.tsx:103`, `useCanvasPaste.ts:79`, `imageExtension.ts:538/547`, `hoverWikilink.js:144`.
- **Unbounded module caches**: `core/mermaid/mermaidExtension.ts:50` `mermaidSvgCache`, `media/hooks/imageExtension.ts:24` `urlCache`, `Explorer/components/FileHoverPreview.tsx:46` `contentCache`.
- **Wikilink decorations rebuilt every keystroke**: `Editor/wikilink/luminaWikiLinks.js:13` `if (tr.docChanged || tr.selection)` is always true (selection is always an object); `deco.map` branch unreachable; `buildDecorations` scans every doc line.
- **`imageLightbox.ts` `attachLightbox`** adds a click listener with no detach.
- **Canvas**: duplicate `pointer*` + `mouse*` handlers double-fire (`useCanvasGestures.ts:580-583`); `useCanvasShortcuts` re-registers window listeners per frame; `CanvasEdgeItem.tsx:87` rAF not cancelled; stale `canUndo/canRedo` refs.
- **SSE per-chunk `setState`** without throttling: `useInlineGeneration.ts:193/238`.
- **Timers never cleared**: notifications, `useInlineGeneration.ts:75`, `useComposerVoice.ts:58`, `CommandPalette` resizer, `workspaceStore.ts:652`, `useOpacity.ts`.
- **Module singletons never released**: `core/hooks/useTypingSound.js:5-6` `audioCtx`, `voice/hooks/Services.ts` global listeners.
- **Whole-store Zustand subscriptions** cause re-render storms on streaming: `CommandPalette.tsx:374,382`, `Composer.tsx:37`, `LuminaWorkbench.tsx:46`, `LuminaAnalyticsDropdown.tsx:34`, `useResizable.js:5`, Settings panels.

### Main process
- **Indexer worker hangs/leaks**: `src/main/workspace/workspaceIndexer.ts:132-167` never rejects `_workerPending` on error/exit, never `terminate()`s, no timeouts; non-atomic index+embeddings writes (`:510-572`); concurrent `indexWorkspace` silently no-ops (`isIndexing` check straddles an `await`).
- **ReDoS / main-thread stall**: `workspaceSearch.ts` compiles renderer regex; embeddings run on main thread.
- **Backup blocking I/O**: `readFileSync` of whole zip (`luminaZipBackup.js:102`), recursive `readdirSync` + per-file `readFileSync` (`luminaNonZipBackup.js:266,470`); resumable session's resume capability unused; `send()` without `isDestroyed()` check.
- **`execSync`** on hot path (`systemHandlers.ts:128`).
- **Non-atomic persistence**: `settingsManager.ts:647`, `appConfig.ts:189`, `workspaceManager.ts:181`, `memoryHandlers.ts` — plain `fs.writeFile` with no temp+rename.
- **Listener leaks**: `windowManager.ts:154` `SettingsManager.onChange` never unsubscribed; `useTrayIcon.js:45-67` registers `app.on('before-quit')` per call; `AppUpdater.js` adds `ipcMain.on`/`autoUpdater` listeners per construction.
- **`FloatingWindowManager.js`** is instantiated/exported but has no importers (dead).
- **Gmail token refresh storm**: `gmailService.ts:230-237` refreshes per 401; `listMessages` fans out ~25 parallel requests → 25 concurrent refreshes with lost-update races; no 403/429 backoff.
- **Duplicate Drive lookups** return `null` for any non-OK response → duplicate file uploads (`luminaNonZipBackup.js:195`).

### AI
- `aiWorkerManager.ts:20-55` registers `onmessage` only inside `if (!worker)`; later callbacks silently dropped; no terminate/HMR; pending tasks never reject on crash.
- `useInlineGeneration.ts` stale `abortController` closure; leaked fetch reader (no `releaseLock` in `finally`).
- Provider keys inlined via `import.meta.env.VITE_*` and used in browser-direct fetches (`providers/index.ts:42-54`, `tools/lumina.ts:727,1063`, `AnthropicProvider.ts:36-52` `anthropic-dangerous-direct-browser-access`); keys also in plaintext `localStorage` (`SettingStore.ts:353-405`).

---

## 4. Build, Packaging & CI

- **Production Google OAuth secret never ships** (see 2.9).
- `@electron/rebuild@^0.0.0` (`package.json:77`) is an empty stub (no bin/main) → `npm run rebuild` cannot run.
- `dotenv` imported by `googleOAuthConstants.ts:1` but undeclared; `@types/node` used by tsconfig but undeclared; `typescript ^7.0.2` unusual for shipping.
- **Native binaries committed** (`crates/…` and `resources/native/…`, ~24 MB); `resources/native/…gnu.node` is a stale 21.8 MB build vs the fresh 726 KB one; `index.d.ts` files are 0 bytes.
- **Package bloat/leak**: `app.asar` includes `crates/**`, `brain/**` (double-shipped via `extraResources`), `docs/**`, `scripts/**`, `test-results/**`, root `renderer/**`, `banner.png`, stale `electron.vite.config.<timestamp>.mjs`, `bugs.md`, `talk.md`; `asarUnpack` for `.node` produced no `app.asar.unpacked`; transformers model (22 MB) bundled despite `allowLocalModels=false`; onnxruntime ships all platforms.
- **CI** (`.github/workflows/ci.yml`) step named "Typecheck & Bundle" runs no typecheck; no e2e, no Rust tests; `test:all` exists but is unused.
- `scripts/ensure-electron.mjs:26` hardcodes an old Electron cache version; `ensure-transformers.mjs` mutates `node_modules` (lost on `npm ci`).
- **Dead/stale**: two `electron.vite.config.<timestamp>.mjs` files reference undeclared `better-sqlite3`/`react-window`; root `renderer/` has only `public/icon.png`; empty dirs `core/convas`, `core/track`, `core/typingsound`; `talk.md` (0 bytes); misspelled `components/screenlaoder.ts`.
- `src/main/handlers/useResizeWindowValue.js:15,20` listens for non-existent Electron events `'resized'`/`'moved'` (dead, tests-only).

---

## 5. Rust Core

- `crates/lumina_core/src/scanner.rs:397` `fs::read_to_string(...).unwrap_or_default()` silently empties non-UTF-8 files. Use `fs::read` + `from_utf8_lossy`.
- `src/search.rs:74-79` computes snippet offsets on `content.to_lowercase()` but slices the original string → shifted/wrong snippets for non-ASCII.
- `lib.rs:18-22` `scan_vault` is synchronous → blocks the Electron main process for the whole walk.
- `Cargo.toml:15-17` unused `regex`, `memchr`, direct `serde_json`; `napi` `async` feature unused.
- `graph.rs:40-44` strips everything after the last dot in titles (`v1.0` → alias `v1`); duplicate titles last-writer-wins; `scanner.rs:413` extracts wikilinks from raw content including frontmatter.
- `scanner.rs:462-470` `md5_hash` is actually FNV-1a (misnamed).
- `build.rs:14-16` conditionally skips `napi_build::setup()` for windows-gnu (source of the suspect gnu binary).

---

## 6. Testing Reality

README claims vs actual:
| README says | Actual |
|---|---|
| 757 tests / 90 suites / 100% pass (`README.md:229,252`) | ~1181 `it` blocks / 300 `describe`; pass unverified |
| 23 e2e tests / 3 files (`README.md:280,290`) | 78 `test(` blocks / 17 files |
| `vault.e2e.test.js` (`README.md:305`) | file doesn't exist (`workspace.e2e.test.js`) |
| badge `1.0.65` (`README.md:6`) | `1.0.69` |
| "21 curated themes" | 64 theme definitions (`themeLists.ts`) |
| `features/mermaid/` | doesn't exist (lives in `core/mermaid/`) |

- **Zero coverage** for high-risk code: `workspaceOperations` path handling, all of `src/main/auth/`, all of `src/main/backup/`, `ollamaChatStream`, `ipcValidation`, `settings/crypto`, `core/db/cache.js`, renderer export feature.
- **Low-value tests**: `Graph.test.jsx` mocks all children; `physics.worker.test.js` mocks d3 and asserts mocks; `UpdateFooter.test.jsx` tests non-functional UI.
- **Tautological test**: `GlobalErrorHandler.test.jsx:69` uses `setTimeout(200)` and asserts text that is unconditionally rendered.
- **Duplicate tests**: `useCodeFence.test.js` + `.ts`; duplicate `it` names in several files.
- **Flaky e2e**: 21+ fixed `waitForTimeout` sleeps; retries mask flake.
- CI runs neither e2e nor Rust tests.

---

## 7. Docs Drift

- `README.md` cites `.js` paths for files that are `.ts` (`settingsManager.ts`, `src/export/*.ts`), non-existent `features/mermaid/`, stale Electron version `39.2.4` (actual `^39.8.10`).
- `README.md:321` calls `bugs.md` a "Life & Work Cockpit roadmap" — it's a 9-line error log.
- `brain/purpose.md:5` says `v1.0.65`; `brain/Introduction.md` says "over 20 themes".
- README "coordinate persistence" contradicted by the localStorage purge removing `lumina_graph_node_positions` (1.3); caret/settings persistence itself is fine (settings.json-backed).

---

## 8. Prioritized Remediation Plan

### Phase 0 — Containment (security, do first)
1. Route every renderer path through `assertSafeWorkspacePath` in `bulkDelete`, `saveSnippet`, `importExternalPaths`, `saveWorkspaceImage`, `saveImageFromPath`, `open-folder`, `shell:openPath`, and backup `resolveFilePaths`.
2. Narrow the preload surface (expose only the curated `api` + `process.platform`), drop raw `electronAPI`, gate auto-DevTools behind `enableDevTools`.
3. Encrypt/store `googleUser` correctly; stop returning tokens/keys to the renderer; add OAuth `state` + bind `127.0.0.1`; strip CRLF from email headers; Zod-validate/clamp Gmail `id`/`maxResults`; validate Ollama `url`.
4. Gitignore `.env*`, untrack `.env-local`, rotate the exposed credential.

### Phase 1 — Critical bugs
5. Either extend the `main.jsx` purge allowlist with the localStorage-only keys (`lumina_graph_node_positions`, `lumina_ai_usage_stats`, `lumina-active-session-id`, `lumina_ai_sessions_sidebar_open`, `lumina-canvas-studio-expanded`, `lumina_backup_mode`) or migrate them to `settings.json`/Dexie and remove the purge.
6. Fix settings save ordering + make all persistence atomic (temp + rename).
7. Fix `CanvasEdgeItem` hook order; fix `tableSelection.ts:367`; import `summarizeNotes`; register or remove `ai:generateImage`.
8. Native loader: try every `.node`, prefer ABI match; remove/gate the windows-gnu build.
9. Fix zip stream error handling, unique temp files, await previous runs.

### Phase 2 — Stability & performance
10. Table/media listener lifecycle + object-URL revoke + bounded caches.
11. Wikilink decoration condition, Find doc-sync, paste bookmark/selection re-read, duplicate key-listeners, mousedown+click double close, Confirm focus check.
12. `aiWorkerManager` lifecycle + stable callback dispatch; `useInlineGeneration` abort/reader cleanup.
13. Replace whole-store Zustand subscriptions with selectors; stabilize memoized props.
14. Move AI provider network calls + key storage to the main process; remove `VITE_*` keys and browser-direct access.

### Phase 3 — Build, tests, docs
15. Fix production OAuth secret delivery; tighten `electron-builder files`; delete stale configs/binaries; declare `dotenv`/`@types/node`; replace `@electron/rebuild@0.0.0`; add a real `typecheck` script and run it + e2e + Rust in CI.
16. Add tests for path handling, auth, backup; delete mock-only/tautological tests.
17. Correct README/brain drift.

### Phase 4 — Cleanup
18. Remove dead code (`FloatingWindowManager.js`, `useResizeWindowValue.js`, empty dirs, `talk.md`, stray `renderer/`, `screenlaoder.ts` alias); split giant files (`MainLayout.tsx`, `tableExtension.ts`, `tableCell.ts`, `ConvasContainer.tsx`).
