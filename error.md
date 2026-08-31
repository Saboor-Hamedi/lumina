# CodeMirror 6 — Wikilink Boundary Click Crash (`RangeError: Invalid child in posBefore`)

## 1. Symptom & Error Signature
Clicking at the boundary / end of a `[[wikilink]]` or in the empty line space immediately following a wikilink throws:
```text
Uncaught RangeError: Invalid child in posBefore
    at _LineTile.posBefore (chunk-XXXXX.js:1800)
    at posAtCoordsInline (chunk-XXXXX.js:3829)
    at EditorView.posAtCoords
```

---

## 2. Root Cause Analysis

### Architecture of Wikilinks in `@atomic-editor/editor`
A label-less wikilink (`[[Note Name]]`) is rendered using two decorations:
1. `Decoration.mark({ class: 'cm-atomic-wiki-link-hidden-syntax' })` applied over the raw text (e.g. from index `0` to `13`).
2. `Decoration.widget({ widget: new WikiLinkWidget(...), side: -1 })` placed at position `13` (`link.to`) as a **zero-width PointWidget** (the visible badge).

The package CSS hides the raw text using `font-size: 0; color: transparent;`.

### Why CodeMirror 6 Crashes
When a user clicks at the end of the wikilink or on the line space next to it:
1. CodeMirror’s built-in `basicMouseSelection` handler runs `posAtCoords` → `posAtCoordsInline`.
2. Inside `posAtCoordsInline`, CodeMirror iterates through all child tiles on the line to find which child tile has a `DOMRect` closest to `(e.clientX, e.clientY)`.
3. CodeMirror **intentionally skips PointWidgets** during this loop:
   ```javascript
   if (child.flags & 48 /* TileFlag.PointWidget */) continue;
   ```
4. It then inspects the hidden text tile (`cm-atomic-wiki-link-hidden-syntax`). Because `font-size: 0` collapses the element, `getClientRects()` returns an empty list (`[]`).
5. Because every child was either skipped (PointWidget) or had zero client rects (hidden syntax), CodeMirror finds **no matching child** and the index remains `closest = -1`.
6. CodeMirror attempts:
   ```javascript
   let inner = tile.children[closest]; // undefined
   let innerOff = tile.posBefore(inner, offset); // throws Invalid child in posBefore
   ```
7. Inside `posBefore(tile)`:
   ```javascript
   posBefore(tile, start = this.posAtStart) {
       let pos = start;
       for (let child of this.children) {
           if (child == tile) return pos;
           pos += child.length + child.breakAfter;
       }
       throw new RangeError("Invalid child in posBefore");
   }
   ```

---

## 3. Failed Workarounds & Visual Regressions

| Workaround Attempted | Result | Why It Failed |
| :--- | :--- | :--- |
| **`WikiLinkWidget.prototype.ignoreEvent = () => true`** | ❌ Still crashed | Only protected clicks directly *on the widget span*. Clicks targeting hidden syntax or line space still triggered `basicMouseSelection`. |
| **`letter-spacing: -100em; font-size: 1em;` in CSS** | ⚠️ Stopped crash, but caused visual bug | Kept measurable width for CodeMirror, but squished all characters into position 0, rendering duplicated/stacked ghost letters (e.g. `AA` on `Annual Review`). |
| **`font-size: 0.0001px` in CSS** | ❌ Still crashed | Sub-pixel fonts < 0.5px are rounded to 0 by browser layout engines, returning empty rects again. |
| **Narrow `target.closest('.cm-atomic-wiki-link')` interceptor** | ❌ Still crashed on edge clicks | Boundary clicks hit `.cm-line` or `.cm-atomic-wiki-link-hidden-syntax`, bypassing the handler. |

---

## 4. The Working Solution

### A. Clean CSS (`src/renderer/src/assets/wikilink.css`)
Keep the hidden syntax completely zero-width and invisible without negative letter-spacing:
```css
.cm-atomic-wiki-link-hidden-syntax {
  color: transparent !important;
  font-size: 0 !important;
  line-height: 0 !important;
  letter-spacing: 0 !important;
  user-select: none !important;
  pointer-events: none !important;
}
```

### B. Comprehensive Click Interceptor (`src/renderer/src/features/Editor/wikilinkCaret.js`)
Intercept all clicks on the widget, on hidden syntax, and on any `.cm-line` containing a wikilink:
```javascript
export const wikilinkCaretFix = EditorView.domEventHandlers({
  mousedown(e, view) {
    const target = e.target
    if (!target || target.closest('.cm-atomic-table')) return false

    let wikilink =
      target.closest('.cm-atomic-wiki-link') ||
      target.closest('.cm-atomic-wikilink-wrap') ||
      target.closest('.cm-atomic-wiki-link-hidden-syntax')

    const parentLine = target.closest('.cm-line')

    // If clicking on line space before/after a wikilink on that line
    if (!wikilink && parentLine) {
      const linksOnLine = Array.from(
        parentLine.querySelectorAll('.cm-atomic-wiki-link, .cm-atomic-wikilink-wrap, .cm-atomic-wiki-link-hidden-syntax')
      )
      if (linksOnLine.length > 0) {
        wikilink = linksOnLine.reduce((closest, el) => {
          const r = el.getBoundingClientRect()
          const dist = Math.min(Math.abs(e.clientX - r.left), Math.abs(e.clientX - r.right))
          const closestDist = Math.min(
            Math.abs(e.clientX - closest.getBoundingClientRect().left),
            Math.abs(e.clientX - closest.getBoundingClientRect().right)
          )
          return dist < closestDist ? el : closest
        }, linksOnLine[0])
      }
    }

    if (!wikilink) return false

    // Prevent CodeMirror's basicMouseSelection from running posAtCoordsInline
    e.preventDefault()
    e.stopPropagation()

    const rect = wikilink.getBoundingClientRect()
    const isRightHalf = e.clientX >= (rect.left + rect.width / 2)

    let linePos = 0
    try {
      if (parentLine) {
        linePos = view.posAtDOM(parentLine)
      } else {
        const coords = view.posAtCoords({ x: Math.max(0, rect.left - 5), y: rect.top + (rect.height / 2) })
        linePos = coords?.pos ?? 0
      }
    } catch {
      linePos = 0
    }

    const line = view.state.doc.lineAt(linePos)
    const lineText = line.text

    let linkFrom = line.from
    let linkTo = line.to

    try {
      if (wikilink.classList.contains('cm-atomic-wiki-link-hidden-syntax')) {
        const domPos = view.posAtDOM(wikilink)
        if (domPos >= line.from && domPos <= line.to) {
          const offsetInLine = domPos - line.from
          const remaining = lineText.slice(offsetInLine)
          const m = remaining.match(/^\[\[(.*?)\]\]/)
          if (m) {
            linkFrom = domPos
            linkTo = domPos + m[0].length
          }
        }
      }
    } catch {}

    if (linkTo === line.to && linkFrom === line.from) {
      const linksInLine = parentLine
        ? Array.from(parentLine.querySelectorAll('.cm-atomic-wiki-link, .cm-atomic-wikilink-wrap, .cm-atomic-wiki-link-hidden-syntax'))
        : [wikilink]
      const linkIndex = linksInLine.indexOf(wikilink)

      const regex = /\[\[(.*?)\]\]/g
      let match
      let count = 0

      while ((match = regex.exec(lineText)) !== null) {
        if (count === linkIndex || linkIndex === -1) {
          linkFrom = line.from + match.index
          linkTo = linkFrom + match[0].length
          break
        }
        count++
      }
    }

    const targetPos = isRightHalf ? linkTo : linkFrom

    safeDispatch(view, {
      selection: { anchor: targetPos, head: targetPos },
      userEvent: 'select'
    })
    view.focus()
    return true
  }
})
```

---

## 5. Key Rules to Remember
1. **Never modify `node_modules` directly.**
2. **Do not use negative `letter-spacing`** on hidden text elements (creates overlapping ghost characters).
3. **Always prevent default & stop propagation** when custom caret handlers resolve positions for point widgets so CodeMirror's `basicMouseSelection` is bypassed.
4. **Include the parent `.cm-line` in target matching** to prevent unhandled boundary clicks.
