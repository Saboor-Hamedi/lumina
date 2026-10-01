Here is a precise prompt to refine this context menu. It focuses on **structural elegance, typography, and subtle depth** rather than heavy effects, ensuring it matches the "sleek, non-glowy" aesthetic of your app.

---

### 🎯 Prompt for Agent: Refine Context Menu to "Sleek & Structural" Aesthetic

**Context:**
The current context menu feels a bit generic and "floaty." We need to ground it in the app's design language. The goal is a menu that feels like a **precision instrument**—crisp edges, perfect alignment, and subtle depth without heavy glows or excessive shadows.

**Current Issues:**

1.  **Visual Weight:** The background is a flat dark blue-gray that doesn't quite match the editor's depth.
2.  **Icon Alignment:** Icons and text feel slightly disconnected. The spacing between the icon column and text column is inconsistent.
3.  **Separator Lines:** If present (or needed), they are likely too harsh or missing where logical grouping is needed.
4.  **Hover State:** Needs to be defined precisely—no glowing orbs, just clean geometric feedback.
5.  **Typography:** The font weight and tracking need to match the sidebar/file explorer exactly for visual continuity.

---

### ✨ Required Design Changes

#### 1. Container Styling (The "Card" Feel)

- **Background:** Use a solid, opaque background color that matches the **sidebar or modal background** (e.g., `#1e1e2e` or your specific surface color). Do not use transparency/blur unless it's extremely subtle (5% max).
- **Border:** Add a **1px solid border** using a very low-opacity white/gray (e.g., `rgba(255,255,255,0.08)`). This defines the edge sharply without needing a heavy shadow.
- **Shadow:** Use a **tight, dense shadow** rather than a wide glow.
  - _Example:_ `box-shadow: 0 4px 12px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2);`
  - _Why:_ This makes the menu feel like it's sitting _just above_ the content, not floating in a fog.
- **Radius:** Use a consistent border-radius (e.g., `6px` or `8px`) matching your buttons and cards.

#### 2. Layout & Grid System

- **Three-Column Grid:** Strictly enforce a 3-column layout for every row:
  1.  **Icon Column:** Fixed width (e.g., `20px`), right-aligned or centered within its column.
  2.  **Label Column:** Left-aligned text, flexible width.
  3.  **Shortcut Column:** Right-aligned, fixed width (or min-width), muted color.
- **Padding:**
  - Vertical padding per item: `6px` to `8px`.
  - Horizontal padding (left/right): `12px`.
  - Gap between Icon and Label: `12px`.
  - Gap between Label and Shortcut: `24px` (or auto-push to right).

#### 3. Typography & Iconography

- **Font:** Use the exact same font family and size as the file explorer (likely `Inter` or `Segoe UI`, `13px`).
- **Weight:** Regular (400) for labels, Medium (500) for shortcuts if needed for readability.
- **Colors:**
  - **Label:** `var(--text-primary)` (e.g., `#e2e8f0`).
  - **Shortcut:** `var(--text-muted)` (e.g., `#64748b`). _Crucial: Shortcuts should recede visually._
  - **Destructive Action ("Delete Folder"):** Use a distinct red/orange color (`#ef4444`) for both icon and text to signal danger clearly without needing a glow.
- **Icons:** Ensure all icons are from the same set (Lucide/Phosphor) with consistent stroke weight (`1.5px` or `2px`). Align them vertically center with the text baseline.

#### 4. Interaction States (Hover & Active)

- **Hover Background:** Use a **solid, subtle tint** instead of a gradient or glow.
  - _Example:_ `rgba(255,255,255,0.05)` or `rgba(accent-color, 0.1)`.
- **Hover Text:** Optionally brighten the label color slightly on hover.
- **Active/Pressed:** Darken the background slightly (`rgba(0,0,0,0.1)`) to simulate physical press.
- **Transition:** Add a fast transition (`0.1s ease-out`) for background color changes to prevent flickering.

#### 5. Logical Grouping (Separators)

- Add **1px horizontal dividers** (`rgba(255,255,255,0.06)`) to group related actions:
  - Group 1: `New File`, `New Folder`
  - _(Separator)_
  - Group 2: `Rename`, `Copy`, `Paste`, `Reveal...`
  - _(Separator)_
  - Group 3: `Summary`, `Theme`, `Export`, `Import`
  - _(Separator)_
  - Group 4: `Delete Folder` (isolated at bottom for safety)
- **Padding around separators:** Ensure separators have `8px` margin top/bottom so they don't touch the hover areas of items.

---

### ✅ Goal

A context menu that feels **architectural and precise**. It should look like it was drawn with a ruler—clean lines, perfect alignment, and restrained use of color. No fluff, no glow, just pure functional beauty.

### ️ Constraints

- Maintain keyboard navigation support (arrow keys, Enter, Esc).
- Ensure the menu doesn't overflow the screen viewport (flip position if needed).
- Test with long folder names to ensure text truncation works gracefully (ellipsis).
- Verify the "Delete" action requires confirmation if not already implemented (safety first).
