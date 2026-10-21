# Status of Reported Issues

## 1. FileExplorer.tsx Babel Pre-Transform Parse Error (RESOLVED)
- **Error:** `Unexpected token (741:37)` in `FileExplorer.tsx` where an accidental ternary expression was present in JSX prop attributes:
  ```tsx
  batchExportNotes && batchExportNotes.length === 1
    ? batchExportNotes[0].title || 'Note Export'
    : lastClickedFolder={lastClickedFolder || ''}
  ```
- **Fix:** Restored the clean prop assignment:
  ```tsx
  lastClickedFolder={lastClickedFolder || ''}
  ```
- **Verification:** All 57 tests in `test/renderer/src/features/Explorer/` compile and pass without any syntax or runtime errors.

## 2. Root File Export Modal
- **Issue:** Clicking export on a root-level file in File Explorer did not open the export modal because `open-export-dialog` had no listener in the Explorer.
- **Fix:** Added `open-export-dialog` listener in `FileExplorer.tsx` to open `BatchExportDialog` with the selected note, sanitized filenames in exporters, and ensured multi-selection context menu exports root files seamlessly.
- **Verification:** Verified via `openExportDialogEvent.test.tsx` and full export test suite (87/87 tests passing).

## 3. Editor Title Input Race Condition & Deprecation (RESOLVED)
- **Issue:** Renaming notes via the top title input field in the editor caused race conditions: newly created files or notes would revert back to original/default names while typing due to store/disk sync cycles overriding local input state.
- **Fix:** Totally eliminated `EditorTitleBar` and associated dead code across the codebase. Preserved note renaming through the sidebar and file explorer (which performs atomic filesystem renames). Kept the editor action bar, progress tracker, and `EditorMenu` dropdown intact at the top.
- **Verification:** Unit tests updated and verified in `test/renderer/src/features/Editor/components/EditorMetadata.test.tsx` (7/7 passing). Zero stale CSS or component references remain.
