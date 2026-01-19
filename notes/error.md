# Lumina Error & Stability Logs

## [IRONCLAD-001] The "Header Split" (Layout Jump) Issue

### **Ironclad-001: Description**

When clicking on a header (e.g., `# Heading`) in Live Preview mode, the Markdown syntax markers would appear and push the main text to the right. If the heading was long or near the edge of the container, this sudden shift would force the text to wrap, causing the title to "split" into two lines and then snap back. This created a jarring "bouncing" or "glitching" visual effect.

### **Ironclad-001: Root Cause**

The issue stemmed from the **Dynamic Box Model Shift**. Because the Markdown markers (`#`, `**`, `[[`) were part of the standard text flow, toggling their visibility between `display: none` and `inline` changed the width of the line content instantly, forcing the browser to re-calculate the layout (Reflow).

### **Ironclad-001: The Solution (Zero-Shift Ironclad Engine)**

We solved this by decoupling the syntax markers from the text flow using a **Gutter-Parking Architecture**:

1. **Safety Buffer**: Implemented a fixed `40px` left-padding on the editor's main content area (`.cm-content`). This creates a dedicated "Parking Zone" for metadata.
2. **Absolute Syntax Positioning**: Instead of letting markers push the text, we use `position: absolute` on the `.cm-hidden-mark` class.
3. **Lateral Parking**: The markers are shifted into the negative space of the gutter (`left: -32px`).
4. **Zero-Jump Reveal**: When the cursor enters the line, we toggle `opacity: 0.4` (Ghosting) instead of changing the `display` or `width` properties.

### **Ironclad-001: Result**

The title text remains **pixel-perfectly stationary**. The syntax appears discreetly in the left margin without affecting the layout of the document. This is the gold standard for high-performance Markdown editors.

---

## [IRONCLAD-002] Babel "Unexpected Token" Corruption

### **Ironclad-002: Description**

The application would fail to hot-reload with a `[plugin:vite:react-babel]` error pointing to `MarkdownEditor.jsx`.

### **Ironclad-002: Root Cause**

**Syntax Residue**: During rapid structural changes to the CodeMirror extensions array, stray characters (semicolons `;(` and extra parentheses `)))`) were accidentally left in the code. Because `EditorView.domEventHandlers` is an object used within an array literal, these characters broke the JavaScript AST (Abstract Syntax Tree).

### **Ironclad-002: The Solution**

* **Structural Purge**: Re-implemented the extensions array with strict comma-first verification.
* **AST Validation**: Cleaned all wrapper parentheses to ensure the `extensions` array is a flat, valid list of CodeMirror facets and plugins.

---

## [IRONCLAD-003] Viewport Decoration RangeError

### **Ironclad-003: Description**

An `Uncaught RangeError: Block decorations may not be specified via plugins` occurred when trying to render high-performance viewport decorations.

### **Ironclad-003: Root Cause**

**Layout Conflict**: CodeMirror 6 prohibits **Block Decorations** (layout-shifting widgets like Code Block Headers) from being emitted inside a `ViewPlugin`. This is because `ViewPlugins` run during the layout/scroll phase, and changing the height of a line at that moment could cause infinite layout recalculation loops.

### **Ironclad-003: The Solution (Hybrid Decoration Architecture)**

We implemented a two-tier decoration system to satisfy CM6's layout engine:

1. **The Layout Tier (`StateField`)**: Code block headers (which change line height) are moved to a `StateField`. These are computed *before* the view update, making them "Layout Safe."
2. **The Performance Tier (`ViewPlugin`)**: All inline styles (Wikilinks, Bold, Hiding syntax) are moved to a `ViewPlugin` that only targets the **Visible Viewport**.
3. **Coordinate Clamping**: Added safety checks to ensure `from` and `to` coordinates never exceed the document bounds during rapid note switching.

---

## [IRONCLAD-004] Note-Switch "Heaviness" (The Mount/Unmount Lag)

### **Ironclad-004: Description**

Switching between notes felt "sluggish" or "heavy," often accompanied by a flash of unstyled content or a sudden scroll jump. It lacked the instantaneous feel of Obsidian.

### **Ironclad-004: Root Cause**

**Lifecycle Exhaustion**: The `MarkdownEditor` component was being completely unmounted and remounted on every note switch. This forced a full tear-down of the CodeMirror instance, re-loading of all extensions, and a complete DOM rebuild—an expensive operation that blocked the main thread.

### **Ironclad-004: The Solution (Instant State-Swap Logic)**

1. **Persistent Mounting**: The Editor component now stays mounted in the `AppShell`.
2. **Atomic State Swapping**: Instead of recreating the editor, we use `view.setState()`. This swaps the document and selection instantly within the *same* instance.
3. **Internal Scroll Mapping**: Created a `scrollPosMap` (Ref-based) that caches the vertical offset for every file ID, restoring it synchronously before the browser paints the new note.
4. **Layout Stabilization**: Assigned `min-height` defaults and a matching `bg-app` to the TabBar to create a seamless visual canvas that never collapses.

---

## [IRONCLAD-005] The "Ghost Unpin" Persistence Bug

### **Ironclad-005: Description**

Pinned tabs would work during a session but would disappear (unpin) whenever the application was reloaded.

### **Ironclad-005: Root Cause**

**Restoration Race Condition**: Upon startup, the `AppStore` would initialize with an empty `pinnedTabIds` array. A `useEffect` in the UI would see this empty array and immediately "persist" it to `settings.json`, effectively overwriting the user's saved pins before the `restoreSession` function had a chance to load the real data.

### **Ironclad-005: The Solution (The Restoration Gate)**

* **State Locking**: Introduced an `isRestoring` boolean in the global state.
* **Persistence Guard**: All `updateSetting` calls for tabs and pins are now wrapped in a guard: `if (isRestoring) return`.
* **Sequential Boot**: The persistence engine only "wakes up" and begins watching for changes *after* the initial settings and vault data have been successfully restored and verified.

---

## [IRONCLAD-006] Flex-Scroll "Invisible Bottom" Bug

### **Ironclad-006: Description**

After moving the TabBar to the AppShell, the editor became unscrollable, or the bottom content was cut off.

### **Ironclad-006: Root Cause**

**Height Calculation Failure**: Using `height: 100%` on a flex child (the Editor) inside a container that already has a TabBar caused the editor to exceed the viewport height by exactly 36px. The scrollbars were technically there, but they were pushed off-screen.

### **Ironclad-006: The Solution**

* **Flex-Basis Correction**: Switched from `height: 100%` to `flex: 1` combined with `min-height: 0`. This allows the browser to correctly calculate the editor's height as "Remaining Viewport Space."
* **Centering Logic**: Removed `justify-content: center` from the scroll container, as it interferes with scroll-anchoring. Replaced it with `margin: 0 auto` on the inner canvas for a more robust "centered writing" experience.
