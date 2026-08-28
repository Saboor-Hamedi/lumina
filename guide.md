
# Only handle the table no the below:

**Objective:** Add non-intrusive visual progress indicators to the Learning Roadmap tracks and notes. This should feel like a natural extension of the current UI, not a gamified overlay.

#### 1. Track-Level Progress (Header)
Add a subtle progress bar directly below each Track header (e.g., `Track 1: NLP / LLM`).

-   **Visual Style:** A thin (2px), rounded bar using the Lumina purple accent at 30% opacity for the background, and 100% opacity for the fill.
-   **Placement:** Immediately below the track title, spanning the full width of the content area.
-   **Data Source:** Calculate based on how many notes in that track have been opened/visited (stored in `settings.json` or a local progress store).
-   **Text Label (Optional):** Show percentage only on hover to keep the default view clean.  
    *Example:* `▓▓▓░░░░░░░` (hover reveals "3/10 notes read")

#### 2. Note-Level Progress (Table Rows)
In the roadmap table (`# | Note | Time | Why`), add a subtle status indicator in the `#` column.

-   **Unread:** Empty circle (`○`) in muted gray.
-   **In Progress:** Half-filled circle (`◐`) in Lumina purple.
-   **Completed:** Checkmark (`✓`) or filled circle (`●`) in green or purple.
-   **Interaction:** Clicking the indicator toggles the state manually (for users who want to mark things done without opening the note).

#### 3. Persistence & Privacy
-   Store progress locally in `settings.json` under `"roadmap.progress": { "track-1-nlp": [note-id-1, note-id-2] }`.
-   **Do NOT sync to cloud** unless the user explicitly enables it. This is personal learning data.
-   Add a "Reset Progress" button at the bottom of each track (hidden behind a ⚙️ icon) for users who want to restart.

#### 4. Visual Constraints (Critical)
-   **NO animations** on the progress bars (they should update instantly, not tween).
-   **NO bright colors** — use muted tones that don’t compete with the note links.
-   **NO extra columns** — integrate indicators into existing columns (`#` for note status, below header for track progress).
-   **Respect dark mode** — ensure indicators are visible but not glaring against the dark background.

---

### ✅ Verification Checklist
- [ ] Track progress bars appear below headers, update when notes are opened  
- [ ] Note status indicators show in `#` column (empty/half/full)  
- [ ] Clicking indicator toggles state manually  
- [ ] Progress persists across app restarts via `settings.json`  
- [ ] No visual clutter — indicators are subtle and scannable  
- [ ] "Reset Progress" option available per track  

This will make the Roadmap feel *alive* and responsive to the user’s journey, without adding any visual noise to your already-clean design.