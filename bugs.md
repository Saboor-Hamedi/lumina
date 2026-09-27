Here is the thing:

- when i open [Graph.jsx](file;file:///b%3A/electron/lumina/src/renderer/src/features/Graph/Graph.jsx) it opens in the modal which is fine, then i click it becomes tab, great, but it does not remember the state, it must remember if last time we close the it was tab or modal it must open agian on the same state...
  also, i click i takes time to open the graph on the tab or modal, but the rest are blazing fast...
  secont issue, i have openned the graphs and navigate to another tab, i come back to the graph i see they zoom in,they nodes whole nodes zoom in

---

🎯 Prompt for Agent: Refine Backlinks & Outline Panels for Subtlety & Alignment
Context:
The current Backlinks and Outline panels in the right sidebar feel visually heavy and disconnected from the rest of MindForge's sleek, premium UI. They need to be refined to match the app's "borderless, subtle, integrated" design language while maintaining full functionality.
Observed Issues:
Visual Heaviness:
Both panels use hard borders, saturated accent colors (orange/purple), and dense spacing that makes them feel like separate widgets rather than integrated parts of the editor.
The "LINKED MENTIONS" and "UNLINKED MENTIONS" headers are too prominent, competing with the content.
Backlink snippets have excessive background tinting and bold link highlighting that draws attention away from the actual text.
Alignment & Spacing Inconsistencies:
Panel headers ("BACKLINKS", "NOTE OUTLINE") don't align vertically with other right-sidebar elements (e.g., tab bar, search input).
List items in both panels have inconsistent padding/margins compared to the file explorer or editor content.
Line numbers (L5, L27, etc.) in backlinks are misaligned with the snippet text baseline.
Lack of Thematic Integration:
Accent colors used for links/headings don't harmonize with the active theme's palette. They look generic rather than theme-aware.
No subtle hover states or focus indicators that match the rest of the app's interaction patterns.
Required Refinements:
A. Backlinks Panel
Soften Visual Hierarchy:
Reduce header prominence: Use smaller font size (11px), uppercase tracking (0.05em), and muted color (#6B7280) for "LINKED/UNLINKED MENTIONS".
Remove hard borders between sections. Use subtle background shifts or 1px dividers at 10% opacity instead.
Desaturate link highlights: Instead of bright orange/purple, use the theme's accent color at 60-70% opacity for [[wikilinks]].
Refine Snippet Presentation:
Reduce background tinting on snippets to rgba(accent, 0.03) or remove entirely. Let whitespace define separation.
Align line numbers (L5, L27) precisely with the first line of snippet text using flexbox/grid. Use monospace font for numbers, sized to match body text.
Add subtle left-padding (8px) to snippets to create visual breathing room from the edge.
Empty State Polish:
"No unlinked mentions found" should be centered vertically/horizontally in its container with muted italic text (#9CA3AF), not left-aligned plain text.
B. Outline Panel
Streamline Heading Display:
Replace colored badges (H1, H2) with subtle typographic hierarchy:
H1: Bold, slightly larger (14px), accent color
H2: Regular weight, standard size (13px), muted text color
H3+: Indented + smaller (12px), more muted
Remove line number badges (L1, L7) unless hovered. Show them as a tooltip or faint suffix on hover only.
Improve Scannability:
Add consistent vertical spacing (8px) between heading levels.
Use indentation (16px per level) to visually represent hierarchy instead of relying solely on font size/color.
Active heading (based on cursor position) should have a subtle left-border accent (2px, theme color) + background tint (rgba(accent, 0.05)), matching the file explorer's active state.
C. Global Alignment & Integration
Vertical Rhythm:
Ensure panel headers align with the top of the search input below them (if present) or the tab bar above.
Match padding/margins to the file explorer: 16px horizontal padding, 8px vertical spacing between items.
Thematic Consistency:
All interactive elements (links, headings, buttons) must use the current theme's accent color dynamically.
Hover states should mirror the file explorer: subtle background tint (rgba(white, 0.05) dark / rgba(black, 0.03) light) + smooth transition (0.15s ease).
Scrollbars & Overflow:
Apply custom thin scrollbars (6px width, transparent track, rounded thumb) matching the editor/file explorer.
Ensure content doesn't clip awkwardly when scrolling; add bottom padding equal to scrollbar height.
Goal:
Transform both panels from "heavy, disjointed widgets" into "subtle, integrated extensions of the editor." They should feel like natural part of the reading/writing flow—present when needed, invisible when not.
