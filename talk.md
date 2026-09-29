# Export System — Improvement Suggestions

## Current State

| Format | File | Features |
|--------|------|----------|
| Clean HTML | `exportBundle.js` | Self-contained, base64 images, syntax highlighting, wikilinks |
| Markdown Bundle | `exportBundle.js` | Copies assets to subfolder, rewrites links |
| Word (.doc) | `exportDocs.js` | Mermaid→PNG, base64 images, MS Word compatible |
| HTML | `exportHTML.js` | Basic, no image handling |
| Markdown | `exportMarkdown.js` | Plain dump, no processing |
| PDF | `exportPDF.js` | Mermaid→SVG, A4, print-optimized CSS |
| Plain Text | `exportText.js` | HTML→text conversion |

---

## Critical Gaps

### 1. No Batch Export

**What:** Can't export multiple notes or an entire vault at once.

**Why it matters:** Users with 100+ notes need to export one-by-one. This is tedious and error-prone.

**Suggestion:** Add a "Export Vault" or "Export Selected Notes" option that processes multiple notes with a progress bar. Users select notes in the sidebar, right-click, and choose "Export Selected". The system exports each note to the chosen format, showing progress (e.g., "Exporting 5 of 23...").

---

### 2. No Export Preview

**What:** Users can't see what the export will look like before committing to a file.

**Why it matters:** Users waste time exporting, opening the file, realizing it looks wrong, and re-exporting with different settings.

**Suggestion:** Add a preview pane in the export dialog. After choosing format and options, show a rendered preview of the first page (for PDF) or a scrollable HTML preview. Include "Export" and "Cancel" buttons.

---

### 3. No Metadata Preservation

**What:** Frontmatter (tags, aliases, custom properties) is lost in all exports.

**Why it matters:** Users rely on tags and custom properties for organization. Losing them in exports makes the exported files less useful.

**Suggestion:** For Markdown exports, prepend frontmatter as YAML. For HTML/PDF, include metadata as a collapsible section at the top. For Word, use document properties.

---

### 4. No Table of Contents

**What:** Long documents export without a TOC.

**Why it matters:** PDF and HTML exports of long notes are hard to navigate without a TOC.

**Suggestion:** Auto-generate a clickable TOC from headings (h1–h3). For PDF, use PDF bookmarks. For HTML, use anchor links. Place the TOC after the title/metadata section.

---

### 5. No Image Optimization

**What:** Images are embedded as-is (base64). Large images bloat exports.

**Why it matters:** A note with 10 images at 5MB each becomes a 50MB+ export. This is slow to generate and hard to share.

**Suggestion:** Add image optimization options:
- Resize to max width (e.g., 1200px)
- Compress (quality slider: 60–90%)
- Format conversion (PNG→JPEG for photos)
- Skip images above a size threshold

---

### 6. No Password Protection for PDFs

**What:** PDF exports have no option for password protection or encryption.

**Why it matters:** Users may want to share sensitive notes securely. Without password protection, anyone with the file can read it.

**Suggestion:** Add an optional password field in the PDF export dialog. Use a PDF library that supports encryption (e.g., pdf-lib). Prompt for password if the user checks "Protect with password".

---

### 7. No Export Templates/Presets

**What:** Users can't save export settings (theme, font, margins, etc.) as reusable presets.

**Why it matters:** Users who export regularly want consistent output. Without presets, they must reconfigure settings every time.

**Suggestion:** Add a "Save as Preset" option in the export dialog. Store presets in settings. Allow users to select a preset from a dropdown. Include default presets: "Minimal", "Academic", "Presentation".

---

### 8. No Cloud Integration

**What:** No export to Google Drive, Dropbox, OneDrive, or other cloud storage.

**Why it matters:** Users want to export directly to their cloud storage without manually uploading.

**Suggestion:** Add cloud export options using OAuth. Start with Google Drive and Dropbox. Show a "Save to Cloud" button alongside "Save Locally". Handle token refresh and error recovery.

---

## Nice-to-Have Gaps

### 9. No Export History

**What:** Users can't see what they exported before or re-export with the same settings.

**Why it matters:** Users often forget what they exported and want to re-export with the same settings.

**Suggestion:** Store export history in a local database (SQLite or JSON). Show a "Recent Exports" section in the export dialog. Allow one-click re-export with the same settings.

---

### 10. No Custom Filename Patterns

**What:** Can't use `{{date}}`, `{{title}}`, `{{tag}}` patterns in export filenames.

**Why it matters:** Users want organized exports with meaningful filenames (e.g., `2024-01-15_MyNote.md`).

**Suggestion:** Add a filename pattern input in the export dialog. Support placeholders: `{{date}}`, `{{time}}`, `{{title}}`, `{{tag}}`, `{{folder}}`. Show a live preview of the generated filename.

---

### 11. No Export of Linked Notes

**What:** Can't export a note and all notes it links to (transitive closure).

**Why it matters:** Users want to export a note with its context. Without linked notes, the exported file is incomplete.

**Suggestion:** Add an "Include linked notes" checkbox. When checked, traverse the link graph (wikilinks) and export all reachable notes. Show a count of how many notes will be exported.

---

### 12. No ZIP Compression for Bundles

**What:** Markdown Bundle creates a folder but doesn't offer a ZIP option for easy sharing.

**Why it matters:** Folders are hard to share via email or chat. ZIP is the standard for sharing multiple files.

**Suggestion:** Add a "Compress as ZIP" checkbox in the Markdown Bundle export. Use a library like `jszip` to create the ZIP in-memory. Offer both folder and ZIP options.

---

### 13. No Progress Indication

**What:** Large exports (PDF with many images) have no progress bar.

**Why it matters:** Users don't know if the export is stuck or just slow. They may cancel prematurely or wait unnecessarily.

**Suggestion:** Show a progress bar during export. Update it as each image is processed or each page is rendered. Include a "Cancel" button.

---

### 14. No Export of Non-Image Attachments

**What:** PDFs, audio, video files referenced in notes aren't included in bundles.

**Why it matters:** Notes with attached files become incomplete exports without them.

**Suggestion:** Extend the Markdown Bundle to copy all referenced files (not just images). Detect file links in markdown and copy them to the assets folder. Show a count of copied files.

---

### 15. No Export Scheduling

**What:** Can't schedule recurring exports (e.g., weekly vault backup).

**Why it matters:** Users want automated backups without manual intervention.

**Suggestion:** Add a "Schedule Export" option. Let users choose frequency (daily, weekly, monthly) and time. Run exports in the background using Electron's powerMonitor to prevent sleep.

---

### 16. No Export of Search Results

**What:** Can't export the current search/filtered view.

**Why it matters:** Users want to export only the notes matching their current search.

**Suggestion:** Add an "Export Search Results" option in the search palette. Export all notes matching the current query. Show a count of matching notes before exporting.

---

### 17. No Custom CSS for HTML/PDF

**What:** Users can't provide their own CSS to override export styling.

**Why it matters:** Users may want branded exports (company colors, fonts) or specific layouts.

**Suggestion:** Add a "Custom CSS" textarea in the export dialog. Allow users to paste CSS that overrides the default styles. Include a "Load from file" button to load CSS from a file.

---

### 18. No Export of Comments/Annotations

**What:** If the app has comments/annotations, they're not preserved.

**Why it matters:** Users want to export notes with their comments for review or archival.

**Suggestion:** Include comments as footnotes or a separate section at the end. For PDF, use PDF annotations. For HTML, use collapsible comment sections.

---

### 19. No Export of Version History

**What:** Can't export a note's version history as a changelog.

**Why it matters:** Users want to see how a note evolved over time.

**Suggestion:** Add an "Export Version History" option. Generate a changelog from the version history (if stored). Include timestamps, author, and change summaries.

---

### 20. No Export of Graph View

**What:** Can't export the graph visualization as an image.

**Why it matters:** Users want to share their knowledge graph as an image.

**Suggestion:** Add an "Export Graph" option in the graph view. Render the graph to a canvas and export as PNG or SVG. Include options for layout, labels, and depth.

---

## Code Quality Issues

### 21. Duplicated Image-to-Base64 Logic

**What:** The same image conversion code is copy-pasted in `exportBundle.js`, `exportDocs.js`, and `exportPDF.js`.

**Why it matters:** Bug fixes or improvements must be applied in three places. Easy to miss one.

**Suggestion:** Extract to a shared utility: `exportUtils.convertImageToBase64(url)`. All export handlers call this function.

---

### 22. Duplicated Mermaid Rendering

**What:** The Mermaid→SVG/PNG conversion is duplicated in `exportDocs.js` and `exportPDF.js`.

**Why it matters:** Same as above. Changes to Mermaid rendering must be applied twice.

**Suggestion:** Extract to `exportUtils.renderMermaid(html)`. Returns the HTML with Mermaid diagrams rendered.

---

### 23. No Error Recovery

**What:** If one image fails to convert, the entire export fails.

**Why it matters:** A single corrupted image blocks the entire export. Users can't export at all.

**Suggestion:** Wrap each image conversion in try-catch. Log the error and continue with the next image. At the end, show a warning: "3 images failed to export."

---

### 24. Memory Usage

**What:** All images are loaded into memory as base64. Large vaults could OOM.

**Why it matters:** Exporting a vault with 1000 images could crash the app.

**Suggestion:** Process images in batches. Stream large files instead of loading entirely into memory. Use `createReadStream` for file operations.

---

### 25. No Cancellation

**What:** Users can't cancel an in-progress export.

**Why it matters:** Users may realize they selected the wrong format or options after the export starts.

**Suggestion:** Add a "Cancel" button in the progress dialog. Use an AbortController or flag to stop the export process. Clean up partial files on cancel.

---

## Summary

| Category | Count |
|----------|-------|
| Critical Gaps | 8 |
| Nice-to-Have Gaps | 12 |
| Code Quality Issues | 5 |
| **Total** | **25** |

---

## bugs.md Status Check

| # | Suggestion | Status |
|---|------------|--------|
| 1 | Break Up the Monolithic Keydown Handler | **Not Done** — still ~400 lines |
| 2 | Eliminate the Circular Dependency | **Done** — `tableShared.js` created |
| 3 | Replace `ignoreEvent()` with Granular Event Handling | **Not Done** — still returns `true` |
| 4 | Add TypeScript Types | **Not Done** — all `.js` |
| 5 | Extract Hardcoded Constants to a Config Object | **Done** — `tableConfig.js` created |
| 6 | Fix Memory Leaks from Uncleaned Event Listeners | **Not Done** |
| 7 | Simplify Focus Management | **Partially Done** — uses `view.requestMeasure` |
| 8 | Make `findCurrentTableRange` More Robust | **Partially Done** — removed 500-char fallback |
| 9 | Debounce `dispatchModelFromDom` More Aggressively | **Partially Done** — uses `requestAnimationFrame` |
| 10 | Add Error Boundaries and Defensive Checks | **Not Done** |

**Score: 2/10 done, 3/10 partial, 5/10 not started**
