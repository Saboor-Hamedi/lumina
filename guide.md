Here is the clean, high-level brief for your agent. It focuses purely on the visual behavior and UX requirements without dictating implementation details.

### 📋 Agent Brief: Fix Table Handle Alignment & Visual Noise

**Objective:** The table editing handles (selection boxes, drag icons, delete buttons) are currently visually broken. They appear misaligned with the content, float outside the table boundaries, and create visual noise that distracts from the reading experience. Fix the styling and positioning so they feel like a native part of the Lumina UI.

#### 1. The "Purple Box" Selection Issue
-   **Problem:** Clicking or hovering near the "Note" header triggers a full-column selection highlight (the purple box). This is too aggressive for a read-only roadmap view and looks like a debug artifact.
-   **Fix:** 
    -   Make the column selection handle **subtle and contextual**. It should only appear when the user explicitly intends to select (e.g., click-and-hold), not on accidental hover.
    -   Style the selection border to match the table's existing border color (`rgba(255,255,255,0.1)`) instead of the bright purple accent, unless actively dragging.
    -   Ensure the selection box respects the cell padding—it should frame the *text*, not cut through it.

#### 2. Misaligned Drag/Delete Icons
-   **Problem:** The row/column handles (drag grip, delete icon) are floating absolutely and are not aligned with the table's content grid. They appear to the left of the `#` column or overlap text, breaking the visual rhythm.
-   **Fix:** 
    -   Constrain all handles to the **exact vertical center** of their respective rows/columns.
    -   Position them *inside* the cell boundaries (with consistent padding), not outside. They should feel "attached" to the content, not floating above it.
    -   Use the same horizontal alignment as the cell content (e.g., if `#` is left-aligned, the handle should be left-aligned within its reserved space).

#### 3. Visual Hierarchy & Opacity
-   **Problem:** The handles are always visible or too opaque, competing with the actual content (links, time estimates, descriptions).
-   **Fix:** 
    -   **Default State:** Handles should be **invisible** (opacity 0) until the user hovers over the specific row/column.
    -   **Hover State:** Fade in smoothly (200ms transition) to opacity 0.6.
    -   **Active/Drag State:** Full opacity (1.0) with a subtle glow or border to indicate interactivity.
    -   **Delete Icon:** Use a distinct color (muted red) only on hover to prevent accidental clicks.

#### 4. Z-Index & Layering
-   **Problem:** Handles sometimes render *behind* table borders or text, making them unclickable or partially obscured.
-   **Fix:** Ensure handles always have a higher z-index than table content but lower than modals/tooltips. They must never clip or obscure text.

---

### ✅ Verification Checklist
- [ ] Column selection box is subtle and only appears on intentional interaction  
- [ ] Drag/delete icons are perfectly vertically centered within rows  
- [ ] Handles respect cell padding and never overlap text  
- [ ] Handles are invisible by default, fade in on hover  
- [ ] Delete icon uses distinct color only on hover  
- [ ] No visual clipping or z-index issues  
- [ ] Table content remains fully readable at all times  

This will make the table feel like a polished, intentional UI component—not a raw editor widget.