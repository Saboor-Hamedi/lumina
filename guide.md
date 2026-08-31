# Lumina — Wikilink "Invalid child in posBefore" — Fix Guide

## Symptom
Clicking at the very end of a wikilink (`[[note]]`) throws:
`Uncaught RangeError: Invalid child in posBefore` at `_LineTile.posBefore` (in `@codemirror/view`).

## Root cause (verified against the built bundle)

A label-less wikilink (`[[test]]`) is rendered by `@atomic-editor/editor`'s `wikiLinks` extension as two decorations:

1. `Decoration.mark({ class: 'cm-atomic-wiki-link-hidden-syntax' })` over the whole `[[test]]` (positions 0..8).
2. A **zero-width point widget** (`WikiLinkWidget`, `side: -1`) at `link.to` (position 8) — the visible `cm-atomic-wiki-link` span.

The package CSS (`node_modules/@atomic-editor/editor/dist/styles/inline-preview.css`) hides the raw text with:
```css
.cm-atomic-wiki-link-hidden-syntax {
  color: transparent;
  font-size: 0;      /* collapses the raw text to ZERO measurable width */
  letter-spacing: 0;
  user-select: none;
}
```

### Crash sequence
When you click near/after `]]`, CodeMirror's built-in `basicMouseSelection` runs `posAtCoords` → `posAtCoordsInline`. Inside `posAtCoordsInline`:

- the line tile children are the **hidden TextTile** (`font-size: 0` → zero client rects) and the **point WidgetTile** (skipped: `if (child.flags & 48 /* PointWidget */) continue`),
- no child yields a measurable rect → `closest` stays `-1`,
- `tile.children[-1]` → `undefined` → `tile.posBefore(undefined)` → **throws `Invalid child in posBefore`**.

This is a CodeMirror 6 limitation: `posAtCoordsInline` has no guard for `closest === -1`, so it throws instead of returning a safe fallback.

### Why the previous attempts didn't fully fix it
- **`ignoreEvent` prototype patch** (`useEditorExtensions.js`): works (single bundle copy, shared prototype), but only guards clicks **directly on the widget span**. Clicks in line space that land elsewhere (end-of-line gutter, empty area past the widget, drag-selection, dblclick) still reach `basicMouseSelection` / coordinate mapping.
- **`requestAnimationFrame` deferral** in `wikilinkCaret.js`: the crash happens in CodeMirror's coordinate→position mapping **before** any dispatch, so deferring does not help.
- **Widened mousedown selector** (`wikilinkCaret.js`): only covers clicks whose target is inside `.cm-atomic-wiki-link*`. It does not cover clicks that land in line space that maps to no measurable tile.

## Fix (primary — fix the root cause)

Make the hidden raw text **measurable** so `posAtCoordsInline` always finds a child with a valid client rect and never reaches `closest === -1`.

In the app's own `src/renderer/src/assets/wikilink.css`, override the package's `font-size: 0`:

```css
.cm-atomic-wiki-link-hidden-syntax {
  color: transparent;
  font-size: 1em;      /* keep measurable width so posAtCoordsInline has a rect */
  letter-spacing: 0;
  user-select: none;
  pointer-events: none;
}
```

This is robust against every coordinate-mapping path (mousedown, drag-select, dblclick, end-of-line clicks), because the line always has a measurable child.

**Visual trade-off:** `font-size: 1em` keeps the invisible raw text occupying its natural width, which can leave a small gap before the visible label. To avoid the gap while keeping the text measurable, prefer this variant:

```css
.cm-atomic-wiki-link-hidden-syntax {
  color: transparent;
  font-size: 1em;
  letter-spacing: -100em;   /* collapse horizontal space to ~0 while keeping a measurable box */
  user-select: none;
  pointer-events: none;
}
```

Verify visually which variant looks correct; either one fixes the crash.

## Fix (secondary — keep, already applied)

Keep the widened selector in `src/renderer/src/features/Editor/wikilinkCaret.js` so clicks on the hidden text are intercepted and the caret is placed correctly (prevents navigation/caret jumps):

```js
const wikilink =
  target.closest('.cm-atomic-wiki-link') ||
  target.closest('.cm-atomic-wikilink-wrap') ||
  target.closest('.cm-atomic-wiki-link-hidden-syntax')
```

## Fix (only if it still crashes — async re-render race)

If the error persists after the CSS fix, the remaining cause is likely the async `resolve` flow: `WikiLinkResolverPlugin.resolve()` dispatches `wikiLinkResolved`, which rebuilds decorations and recreates the widget (status `loading` → `resolved`), firing a `MutationObserver` → `readMutation` → `tile.posBefore(childAfter)` on a stale tile.

Mitigations (pick one):
- Ensure the widget's `eq()` avoids recreation when only layout-independent state changes, OR
- Make the widget `isHidden`/`ignoreEvent` such that CodeMirror skips the mutation mapping, OR
- Gate `resolveVisibleLinks()` so it does not dispatch while the user is interacting (e.g. during a mouse selection).

This is secondary; apply only if Fix 1 + Fix 2 don't fully stop the crash.

## Verification
1. Rebuild and run: `npm run build` (or confirm the dev server is serving the edited files).
2. Click the very end of a wikilink (last item on a line) → no console error, caret lands after `]]`.
3. Click the middle / left of the link → note still opens (or caret places at front) without throwing.
4. Drag-select across a wikilink and double-click its boundary → no error.
5. Regression: `[[target|label]]` links, multiple links on one line, wikilink autocomplete, and the hover card all still work.
6. Run `npx vitest run test/renderer/src/features/Editor/wikilinkCaret.test.js` (update it to cover the `cm-atomic-wiki-link-hidden-syntax` target).
