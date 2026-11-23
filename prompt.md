# Lumina Tauri 2.0 — Post-Migration Roadmap

Tackle items **one by one** in strict order: complete **1 → 2 → 3** first, then **4 → 5**.

---

## 1. Security & Path Safety in the Rust Backend
- [x] Harden `safe_join_workspace` in `crates/lumina_core/src/security.rs` to block `..` traversal, arbitrary external absolute/drive paths, null bytes, and symlink escapes; accept valid in-workspace relative & absolute paths (handling Windows `\\?\` verbatim prefixes and case-insensitive drive letters).
- [x] Enforce workspace path confinement on every filesystem command in `src-tauri/src/commands.rs`: `read_snippet`, `save_snippet` (old-file cleanup), `resolve_snippet_target`, `delete_snippet`, `create_folder`, `rename_folder`, `move_file`, `move_files`, `delete_folder`, `bulk_delete`, `open_path_in_os`, `read_file_string`, `write_file_string`, and `delete_file`, and block deleting/renaming the workspace root itself.
- [x] Encrypt sensitive settings at rest (`crates/lumina_core/src/secrets.rs`): authenticated Encrypt-then-MAC (`enc:v1:...`) using a per-machine CSPRNG key in `<app_data_dir>/.lumina_secret.key` for API keys (`deepSeekKey`, `huggingFaceKey`, `openaiKey`, `anthropicKey`, `groqKey`, `geminiKey`, `openrouterKey`, `apiKey`) and `googleUser.token.{access_token, refresh_token}`, with transparent backwards-compatible plaintext read & automatic upgrade on save.
- [x] Enforce CSP natively in `src-tauri/tauri.conf.json` (`app.security.csp`) matching `src/renderer/index.html`.
- [x] Add Rust unit tests in `crates/lumina_core/src/security.rs` and `crates/lumina_core/src/secrets.rs` covering path confinement, root-delete protection, URL validation, and secret encryption/decryption/tamper detection.

---

## 2. Missing / Stubbed Features from the Electron Migration
- [x] **2a. Export pipeline**: Restore `exportPreview`, `exportHTML`, `exportMarkdown`, `exportMarkdownBundle`, `exportText`, `exportPDF`, `exportDocs`, `exportZip`, `exportBatch`, `exportCombined`, and `onBatchExportProgress` (`src/renderer/src/features/export/exportEngine.ts`, `src-tauri/src/export.rs`, `crates/lumina_core/src/zip_util.rs`), fix the infinite preview spinner, stabilize & polish the export sidebar (including Plain Text options, copy action, and flicker-free pinch zoom), and wire native Chromium/WebView2 PDF printing.
- [ ] **2b. Backup pipeline**: Restore `backupWorkspace`, `backupFile`, `cancelBackup`, and progress events (Google Drive upload + local ZIP backup).
- [ ] **2c. Live workspace file watcher**: Watch the active workspace directory in Rust and emit Tauri events to drive `onWorkspaceUpdated` on external file changes.
- [ ] **2d. Clipboard & remaining bridge stubs**: Implement native clipboard image read/write (`readClipboardImageBuffer`, `writeImageToClipboard` via `arboard`), `getVersion()` via `@tauri-apps/api/app`, `getNotes`/`deleteNote` aliases, `importExternalPaths`, `saveImageFromPath`, `cleanOrphans`, `openFile`, `openDevTools`, `setWindowOpacity`, and `terminalAttach` history replay.
- [ ] **2e. Auto-updater**: Wire `checkForUpdates`, `downloadUpdate`, and `quitAndInstall` (GitHub Releases check / Tauri updater).

---

## 3. Replace Shell-Outs with Native Rust Crates
- [ ] Replace `powershell` / `osascript` / `zenity` shell-outs in `select_workspace` and `pick_email_attachments` with native `rfd` dialogs (enabling cross-platform file picking on Windows, macOS, and Linux with no console flash).
- [ ] Replace `Command::new("curl")` shell-outs in `login_with_google` and `get_google_access_token` with native Rust HTTP (`ureq`).
- [ ] Replace `rundll32` / `explorer` / `open` / `xdg-open` shell-outs in `open_path_in_os` with native `open` crate.

---

## 4. Sleek Editor Image Widget & Side-by-Side Text Wrapping
- [ ] Redesign the Editor image widget (`src/renderer/src/features/media/hooks/imageExtension.ts` & `imageExtension.css`) to match the sleek minimal aesthetic of `codeWrapper.css`: remove the bulky always-visible header bar and heavy card borders, replacing them with minimal hover-reveal floating pill controls (Image/Source toggle, alignment/wrap controls, Copy, Delete).
- [ ] Replace the large corner triangle resize knob with a subtle, slim hover-reveal resize handle.
- [ ] Support **side-by-side writing / text wrapping** around left- or right-aligned images so users can move an image left or right and type/edit text freely beside it on either side.

---

## 5. CI, Build & Housekeeping
- [ ] Add `cargo check --manifest-path src-tauri/Cargo.toml` to `.github/workflows/ci.yml` across Windows, macOS, and Linux.
- [ ] Optimize Vite production bundle chunking (`manualChunks` in `vite.config.mjs`) to reduce main chunk size.
- [ ] Run a full local `npm run build` (`tauri build`) verification and prepare a clean migration checkpoint commit.
