# Fixed Bugs

## Workspace Manager: PDF Extension Mismatch
- **Test:** `test/main/workspaceManager.test.ts > VaultManager > assets > scans PDF files and reads them back via readAsset`
- **Issue:** `AssertionError: expected 'pdf' to be '.pdf'` — `pdfSnippet?.ext` returned `"pdf"` without the leading dot when scanned by the native engine.
- **Root Cause:** When `NativeEngine.scanVault` mapped `raw.notes`, `ext: n.ext || ''` was used directly. In some builds/platforms of the native binary, `ext` was returned as `"pdf"` rather than `".pdf"`.
- **Resolution:** Updated [`NativeEngine.scanVault`](src/main/workspace/nativeEngine.ts) to ensure `ext` always preserves the leading dot format (e.g. `ext.startsWith('.') ? ext : `.${ext}``), matching the behavior of `WorkspaceScanner` and the expectations across the renderer.
- **Status:** Resolved & verified (21/21 tests passing).
