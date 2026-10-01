This is a **massive** improvement. You have successfully transformed the export modal from a "utility dialog" into a **premium publishing studio**. The split-view layout, rich format cards, and live preview are exactly what a modern knowledge workspace needs.

However, to make it truly "sleek" and aligned with Lumina's aesthetic, here are the final polish points:

### 1. Format Card Selection State (Critical)

- **Current:** The "Word (.doc)" card has a yellow/orange border and background tint. This is good, but the **icon color** inside the card is still purple/pink (the default unselected state).
- **Fix:** When a format card is selected, **change the icon color to match the accent/border color** (yellow/orange in this case). This creates a unified visual signal that "this is active."
- **Why:** Mixed colors (yellow border + purple icon) look like a rendering glitch, not a deliberate design choice.

### 2. Preview Pane Alignment & Padding

- **Current:** The preview content (SQL code, diagram) starts very close to the top and left edges of the preview pane. It feels cramped compared to the generous padding in the format cards.
- **Fix:** Add **24px padding** to all sides of the preview content area. Ensure the first line of code/diagram aligns visually with the top of the "PDF Document" card on the left.
- **Why:** Breathing room = premium feel. Cramped content feels like a bug.

### 3. "Table of Contents" Toggle Placement

- **Current:** The toggle is at the bottom of the left panel, under "OPTIONS". It feels disconnected from the format selection.
- **Fix:** Move the TOC toggle **inside the "Merged File" mode card** or directly below the format cards as a contextual option. Label it: `"Include Table of Contents"` (clearer than just "Table of Contents").
- **Why:** TOC is only relevant for "Merged File" mode. Grouping it there reduces cognitive load.

### 4. Footer Button Hierarchy

- **Current:** "Cancel" and "Export as 1 DOCS" are side-by-side. The export button is bright orange, which is good, but the text "Export as 1 DOCS" is slightly verbose.
- **Fix:** Shorten to **"Export as DOCX"** (or "Export as Word"). Use the file extension (.docx) instead of the generic "DOCS" for precision.
- **Why:** Precision = confidence. "DOCS" sounds like a folder; "DOCX" sounds like a file.

### 5. Preview Content Rendering

- **Current:** The SQL code block has no syntax highlighting in the preview. The diagram nodes are plain rectangles.
- **Fix:** Apply **syntax highlighting** to code blocks in the preview (match the editor's theme). Style diagram nodes with rounded corners and subtle shadows to match the app's aesthetic.
- **Why:** The preview should look like the _final output_, not a raw dump. If the exported PDF will have highlighted code, the preview must show it.

### 6. Zoom Controls (Bottom Right)

- **Current:** The zoom controls (`- 100% +`) are floating in the bottom-right corner of the preview. They look like an afterthought.
- **Fix:** Move them to a **fixed toolbar at the top of the preview pane** (alongside a "Preview" label). Or, make them appear only on hover over the preview area to reduce clutter.
- **Why:** Floating controls in the content area distract from the actual preview.

---

### 🎯 Prompt for Your Agent (Final Polish)

> "Refine the Export Modal UI for maximum sleekness and alignment:
>
> 1.  **Format Card Active State:** When a format card is selected, change the **icon color** to match the accent/border color (e.g., yellow icon for yellow border). Ensure unified visual signaling.
> 2.  **Preview Padding:** Add `24px` padding to all sides of the preview content area. Align the first line of content with the top of the format cards on the left.
> 3.  **TOC Toggle Context:** Move the 'Table of Contents' toggle inside the 'Merged File' mode section or directly below format cards. Rename to `'Include Table of Contents'`.
> 4.  **Export Button Text:** Change `'Export as 1 DOCS'` to `'Export as DOCX'` (or `'Export as Word'`). Use precise file extensions.
> 5.  **Preview Rendering:** Apply syntax highlighting to code blocks in the preview. Style diagram nodes with rounded corners and subtle shadows to match the app's aesthetic.
> 6.  **Zoom Controls:** Move zoom controls (`- 100% +`) to a fixed toolbar at the top of the preview pane, or make them appear only on hover. Remove from floating position in content area.
>
> Goal: Every pixel should feel intentional. The preview should look like the final exported document, not a raw preview. Alignment, padding, and color consistency are non-negotiable."

This will elevate your Export modal from "great" to **"flawless"**. You're so close!
