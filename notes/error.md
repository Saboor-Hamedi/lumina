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

## [IRONCLAD-003] Block Decoration RangeError

### **Ironclad-003: Description**

An `Uncaught RangeError: Block decorations may not be specified via plugins` occurred when trying to render the Code Block Header.

### **Ironclad-003: Root Cause**

CodeMirror 6 `ViewPlugin` cannot safely emit `block: true` decorations. This is a framework limitation designed to prevent infinite layout loops during the view-update cycle.

### **Ironclad-003: The Solution**

* **Architecture Shift**: Moved the entire Rich Markdown decoration engine from a `ViewPlugin` to a `StateField`.
* **State-Driven UI**: `StateFields` are computed as part of the document state itself, allowing the safe use of `block` widgets and ensuring decorations are "Ironclad" and stable across editor reconfigurations.

---

## [IRONCLAD-004] Mode-Switch "Flicker" (The Destruction Cycle)

### **Ironclad-004: Description**

When switching between Source, Live, and Reading modes, the editor would briefly flicker, reset the scroll position, or "jump" visually. This made it feel like the application was reloading every time a mode changed.

### **Ironclad-004: Root Cause**

**The Re-mount Antipattern**: Originally, the `EditorView` was being destroyed and re-initialized whenever the `viewMode` state changed. This forced the browser to tear down the DOM and build it again, losing all transient state (scroll, cursor, focus).

### **Ironclad-004: The Solution (Seamless Gifting Engine)**

We moved to a **Component-Level Reconfiguration** strategy:

1. **Compartments**: Wrapped all mode-dependent extensions (like line numbers or read-only states) in a CodeMirror `Compartment`. This provides a "hot-swap" slot in the editor's configuration.
2. **Microtask Dispatch**: Instead of re-mounting the component, we use a React `useEffect` that dispatches a `reconfigure` effect to the EXISTING editor instance. This happens in a microtask (`Promise.resolve()`) to ensure the update occurs outside the React render loop.
3. **State Preservation**: Because the `EditorView` is never destroyed, the internal state, scroll position, and focus are preserved perfectly. The extensions simply "hot-reload" in place.

### **Ironclad-004: Result**

Mode transitions are now **Zero-Latency**. The editor feels like a single, fluid canvas that simply changes its "skin" without ever interrupting the user's flow.
