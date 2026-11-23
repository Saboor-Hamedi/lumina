Prompt for your agent:

"In our CodeMirror 6 Live Preview editor (src/renderer/src/core/ or features/Editor/), math blocks ($$ ... $$ and $ ... $) are still being corrupted by Markdown Live Preview decorations, as seen in the screenshot:

1. Stop Markdown Live Preview Decorations Inside Math Ranges ($$ ... $$ and $ ... $):

The issue: Inside a $$ ... $$ block (e.g., \begin{matrix} & 9.999999\dots \\ - & 0.999999\dots \\ \hline & 9.000000\dots \end{matrix}):

The Markdown escape-hiding decorator is hiding the first backslash of \\, making valid LaTeX line breaks (\\) visually appear as single \ in the editor.

The Markdown bullet-list decorator is turning -  at the start of - & 0.999999\dots \\ into a bullet dot (•).

The fix:

Compute all inline $ ... $ and block $$ ... $$ math ranges in the document (or via the Lezer/CodeMirror syntax tree) before building Live Preview decorations.

Skip/exclude all Markdown inline/block formatting decorations (escape-character hiding \, bullet list replacement - → •, bold/italic/strikethrough/heading decorations) whenever a match overlaps with any math range. Raw LaTeX inside $ ... $ and $$ ... $$ must remain completely untouched (\\ stays \\, - stays -).

2. Add Live KaTeX Preview Below Active $$ ... $$ Blocks (Obsidian-style) & Rendered Widget When Blurred:

The issue: In Live Preview mode, editing a $$ ... $$ block shows only raw unrendered text with no rendered math preview.

The fix:

When the cursor is outside a $$ ... $$ block in Live Preview mode, replace/render the block cleanly with KaTeX.

When the cursor is inside a $$ ... $$ block (active editing), keep the syntax-highlighted LaTeX source visible AND render a live KaTeX preview widget immediately below the closing $$ line so the user sees the rendered math update in real time as they type."
