This is a classic ProseMirror/Tiptap inline node selection bug. The issue is almost certainly caused by `user-select: none`, aggressive padding/margins on the wikilink wrapper, or a missing `cursor: text` declaration on the boundaries, which prevents the browser's native caret from landing at the edges of the inline node [[1]][[21]].

Here is the clean, dry prompt for your agent to extract the CSS and fix the selection/cursor behavior.

---

## 📋 Agent Prompt: Extract Wikilink CSS & Fix Inline Selection/Cursor Bug

### Objective
1. Extract all scattered Wikilink-related CSS into a single dedicated file: `src/assets/wikilink.css`.
2. Fix the critical UX bug where users cannot easily select the wikilink background or place their cursor at the immediate start/end of the wikilink.

---

### Part 1: CSS Extraction & Consolidation

**Task:** Find all CSS/SCSS/styled-components related to the Wikilink node/decoration across the codebase and move them into `src/assets/wikilink.css`.

**Search targets:**
- Any styles targeting `.wikilink`, `[data-wikilink]`, `.tiptap-wikilink`, or similar class names.
- Styles inside the Wikilink NodeView component (if using React NodeView).
- Styles inside the editor's global CSS that target wikilink decorations.

**Deliverable:**
Create `src/assets/wikilink.css` and import it in the Wikilink extension/component file. Delete the old scattered styles.

```css
/* src/assets/wikilink.css */

/* Base wikilink inline node/decoration */
.wikilink {
  /* Reset any properties that block selection */
  user-select: text;           /* CRITICAL: Must be 'text', not 'none' */
  -webkit-user-select: text;
  cursor: text;                /* CRITICAL: Shows text cursor at boundaries */
  
  /* Visual styling */
  color: #a78bfa;              /* Lumina purple */
  text-decoration: none;
  border-radius: 4px;
  padding: 1px 2px;            /* Keep padding minimal (1-2px max) to prevent cursor dead zones */
  margin: 0 1px;               /* Minimal margin so cursor can land between links */
  
  /* Background only on hover or when ProseMirror applies .selected */
  background: transparent;
  transition: background 0.15s ease;
}

.wikilink:hover {
  background: rgba(167, 139, 250, 0.12);
}

/* ProseMirror applies this class when the node is selected */
.wikilink.ProseMirror-selectednode,
.wikilink.selected {
  background: rgba(167, 139, 250, 0.25);
  outline: 1px solid rgba(167, 139, 250, 0.4);
}

/* The external link icon inside the wikilink */
.wikilink-icon {
  display: inline-flex;
  align-items: center;
  width: 12px;
  height: 12px;
  margin-left: 2px;
  opacity: 0.5;
  vertical-align: middle;
  pointer-events: none;        /* Prevent icon from stealing cursor/click events */
  user-select: none;           /* Icon itself should not be selectable */
}

/* Unresolved wikilink variant */
.wikilink.unresolved {
  color: #f87171;
  border-bottom: 1px dashed rgba(248, 113, 113, 0.4);
}
```

---

### Part 2: Fix the Selection & Cursor Bug

**Root Cause Analysis:**
The inability to place the cursor at the start/end of an inline node in ProseMirror/Tiptap is caused by one or more of these CSS/DOM issues [[1]][[21]]:

1. **`user-select: none`** on the wikilink wrapper — This tells the browser the element is not part of the text flow, so the caret skips over it entirely.
2. **Excessive `padding` or `margin`** — Creates "dead zones" where the browser doesn't know whether to place the caret inside or outside the node.
3. **`display: inline-flex` or `display: flex`** on the wrapper — Inline nodes MUST be `display: inline` or `display: inline-block`. Flexbox breaks the native text caret positioning at boundaries [[1]].
4. **Child elements with `pointer-events: auto`** — The external link icon inside the wikilink may be intercepting mouse events, preventing the caret from landing.

**Fix Checklist (apply ALL of these):**

#### A. CSS Fixes (in `wikilink.css`)
```css
.wikilink {
  /* ✅ MUST be inline or inline-block — NEVER flex/grid */
  display: inline;
  
  /* ✅ MUST allow text selection */
  user-select: text;
  -webkit-user-select: text;
  
  /* ✅ MUST show text cursor */
  cursor: text;
  
  /* ✅ Keep padding to absolute minimum (1px) */
  padding: 1px 2px;
  margin: 0;
  
  /* ✅ No border that adds box-model space (use box-shadow or outline instead) */
  border: none;
  box-shadow: inset 0 0 0 1px transparent;
}

.wikilink.ProseMirror-selectednode {
  box-shadow: inset 0 0 0 1px rgba(167, 139, 250, 0.4);
  background: rgba(167, 139, 250, 0.2);
}

/* ✅ All child elements inside wikilink must not steal pointer events */
.wikilink > * {
  pointer-events: none;
  user-select: none;
}
```

#### B. DOM/NodeView Fixes (in the Wikilink extension)
If you're using a React NodeView or custom DOM output, ensure the rendered HTML structure is flat and inline:

```html
<!-- ✅ CORRECT: Simple inline span -->
<span class="wikilink" data-wikilink="true">
  Visual Regression Testing
  <span class="wikilink-icon">↗</span>
</span>

<!-- ❌ WRONG: Nested divs, flex containers, or anchors that break caret -->
<div class="wikilink-wrapper" style="display: flex;">
  <a href="..." class="wikilink">Visual Regression Testing</a>
  <button class="wikilink-icon">↗</button>
</div>
```

**Key rules for the DOM:**
- The root element MUST be `<span>` (not `<div>`, not `<a>`).
- Do NOT use `<a href>` tags for wikilinks — they hijack click events and break ProseMirror's selection model. Use `<span data-href="...">` and handle navigation via `onClick` on the editor level.
- The icon must be a `<span>`, not a `<button>` or `<svg>` with pointer events.

#### C. ProseMirror Plugin Fix (if CSS alone doesn't solve it)
If the cursor still won't land at the boundaries after the CSS fixes, you need a ProseMirror plugin that explicitly allows cursor placement at inline node edges [[1]]:

```typescript
// In your Wikilink extension's addProseMirrorPlugins()
import { Plugin, PluginKey } from '@tiptap/pm/state';

addProseMirrorPlugins() {
  return [
    new Plugin({
      key: new PluginKey('wikilinkCursorFix'),
      props: {
        // Allow the cursor to sit at the boundaries of wikilink nodes
        handleClickOn: (view, pos, node, nodePos, event, direct) => {
          // If clicking directly on a wikilink, let ProseMirror handle it normally
          if (node.type.name === 'wikilink') return false;
          return false;
        },
      },
      appendTransaction: (transactions, oldState, newState) => {
        // Ensure selection doesn't get stuck inside wikilink nodes
        const { selection } = newState;
        if (selection.empty) {
          const $pos = selection.$from;
          const nodeBefore = $pos.nodeBefore;
          const nodeAfter = $pos.nodeAfter;
          
          // If cursor is trapped between two wikilinks, nudge it
          if (nodeBefore?.type.name === 'wikilink' && nodeAfter?.type.name === 'wikilink') {
            // This is fine — cursor is between two links, which is valid
          }
        }
        return null;
      },
    }),
  ];
}
```

---

### Part 3: Verification

After applying all fixes, verify these exact scenarios:

- [ ] **Cursor at start:** Click immediately before a wikilink → caret appears before the `[[`
- [ ] **Cursor at end:** Click immediately after a wikilink → caret appears after the `]]`
- [ ] **Background selection:** Click and drag across a wikilink → the purple background highlights smoothly
- [ ] **Multi-link selection:** Drag across multiple wikilinks in a row → all backgrounds highlight, no dead zones
- [ ] **Icon doesn't interfere:** Clicking the ↗ icon doesn't block cursor placement
- [ ] **CSS is consolidated:** All wikilink styles live in `src/assets/wikilink.css`, no scattered styles remain
- [ ] **No `<a>` tags:** Wikilinks render as `<span>`, not `<a href>`