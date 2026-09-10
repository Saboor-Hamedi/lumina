/**
 * bidiExtension.ts
 *
 * CodeMirror 6 extension that assigns a per-line `dir` attribute based on
 * the first STRONG character of each visible line (Unicode bidi algorithm,
 * "first strong" heuristic — same approach browsers use for dir="auto").
 *
 * Scoped strictly to the current viewport: recomputed on viewport/doc
 * changes only, never by walking the whole document. This matters for
 * large Persian/Arabic notes — an unscoped version will visibly stutter.
 */

import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from '@codemirror/state'
import { getFirstStrongDirection } from './textNormalization'

function buildViewportDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const direction = getFirstStrongDirection(line.text);

      // Only attach a decoration when we have a definite direction; for
      // "weak" lines (e.g. blank lines, pure punctuation) leave the
      // browser's default LTR behavior alone rather than forcing dir="ltr"
      // on every single line, which would be wasted decoration churn.
      if (direction === "rtl") {
        builder.add(
          line.from,
          line.from,
          Decoration.line({
            attributes: { dir: "rtl", class: "cm-rtl-line" },
          })
        );
      } else if (direction === "ltr") {
        builder.add(
          line.from,
          line.from,
          Decoration.line({
            attributes: { dir: "ltr", class: "cm-ltr-line" },
          })
        );
      }

      pos = line.to + 1;
    }
  }

  return builder.finish();
}

export const bidiExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildViewportDecorations(view);
    }

    update(update: ViewUpdate) {
      // Recompute only when the visible viewport, the document, or
      // viewport geometry changed — not on every cursor blink/selection
      // change.
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.geometryChanged
      ) {
        this.decorations = buildViewportDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  }
);
