# Lumina Tauri 2.0 — Clean Architecture, Performance & UI Roadmap

Tackle items **one by one** in strict order (**1 → 2 → 3 → 4**) with zero regressions to Markdown, Mermaid, Images, Canvas, or Export.

---

## 1. Eliminate Windows `(Not Responding)` UI Freezes (Async Rust IPC & Raw Binary Transfer)
- [x] Convert all blocking `#[tauri::command]` handlers in `src-tauri/src/commands.rs` and `src-tauri/src/export.rs` to `pub async fn` backed by `tauri::async_runtime::spawn_blocking`, keeping the Win32 main UI thread free of disk I/O, vault scans, search, ConPTY spawn/locks, settings encryption, and ZIP/export writes.
- [x] Guard concurrent async settings and memory read-modify-write operations with non-reentrant mutexes and atomic temp-file writes (`write_string_atomic`) so parallel saves never race or corrupt JSON.
- [x] Switch `read_asset_bytes` to Tauri v2 raw binary IPC (`tauri::ipc::Response::new(bytes)`) and normalize `ArrayBuffer | Uint8Array | ArrayBufferView | number[]` in `src/renderer/src/core/tauriBridge.ts` and `src/renderer/src/features/export/exportEngine.ts` to eliminate JSON byte-array serialization spikes on images and PDFs.

---

## 2. Eliminate Remaining Bundle Bloat (Curated Icon Registry & Non-Boot Lazy Loading)
- [x] Replace `import * as LucideIcons from 'lucide-react'` in `src/renderer/src/features/Icons/FileIcon.jsx` and `src/renderer/src/features/Icons/IconPicker.jsx` (~581 KB `vendor-icons` chunk → 83.23 kB) with a curated icon registry (`iconRegistry.ts`), switch full `highlight.js` imports to shared curated `hljsCore.ts` (~980 KB `vendor-highlight` → 162.92 kB), and lazy-load `IconPicker`.
- [x] Lazy-load non-boot surfaces (`EmailContainer`, `CalendarDropdown`, `TerminalPanel`, `InlineGraph`, `CommandPalette`, `Theme`, `Template`, `LuminaChatContent` on Welcome, and dynamic AI provider import in `summarizeNotes`) so initial boot JavaScript (`index-*.js`) stays fast and lean (target under 800 KB → 623.50 kB / 188.54 kB gzip).

---

## 3. Lumina Signature UI System & 6 DRY Primitives ("Precision Paper & Ink")
- [x] Introduce cohesive design tokens (`tokens.css`: 4 tonal surface levels, 3 ink tiers, `1px` hairline borders, `4px` spacing grid, 3 radius stops, 3 unified motion timings) that work cleanly across all 50 themes.
- [x] Progressively remove stacked `backdrop-filter` blur layers (117), excessive `box-shadow` declarations (385), redundant `@keyframes` (125), and `!important` overrides (3,097) for 120 FPS compositing without visual bloat.
- [x] Build 6 DRY primitives under `src/renderer/src/ui/` (`Button`/`IconButton`, `Popover`/`Menu`, `Dialog`, `Field`/`SearchInput`, single `Tooltip`, existing `PulseLoader`) and consolidate the 3 tooltip implementations, 3 modal-drag hooks, and 10+ custom dropdowns/menus.

---

## 4. Native Polish & Release Readiness
- [ ] Replace remaining `curl` (`login_with_google`, `get_google_access_token`) and OS launcher (`open_path_in_os` / `reveal_path_in_os`) shell-outs with native Rust crates (`ureq`, `open`) once crate dependencies are cached/online.
- [ ] Add `cargo check --manifest-path src-tauri/Cargo.toml` to `.github/workflows/ci.yml` across Windows, macOS, and Linux, and verify full production `npm run build` (`tauri build`).
