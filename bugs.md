TASK: Redesign ModernUI.css from its current "glassy/layered" look to a clean,
minimal aesthetic — closer to Simplenote or a plain native app, not a
glossy/glowy design system.

CONTEXT
This is the theming layer for a knowledge-hub app (Obsidian-style: activity
bar, resizable sidebars, tabbed editor, status bar, inspector panel with a
chat composer). The current file uses layered box-shadows, gradient glows on
active tabs, and hover "lift" transforms. That direction was wrong — it reads
as decorative rather than clean. Redesign it with restraint.

DESIGN PRINCIPLES (in priority order)
1. Flat over dimensional. No box-shadow glows, no gradients, no colored
   shadows, no drop shadows that intensify on hover, no translateY lift
   effects on hover.
2. Borders do the separating, not shadows. Panels are told apart by a single
   faint 1px border (existing var(--border-dim)), not by shadow depth.
3. Whitespace and alignment carry the "premium" feeling, not embellishment.
   If a component looks unfinished, first try more padding/spacing before
   adding any visual effect.
4. One accent color, used sparingly and flatly — e.g. a solid background
   change or a plain 1-2px solid border/indicator. Never a gradient, glow,
   or animated highlight.
5. Motion should be minimal and purely functional: width transitions when
   resizing panels, and quick (120-150ms) color/background fades on
   hover/focus. No scale, no lift, no shadow growth.

CONCRETE CHANGES TO MAKE

Remove entirely:
- The two-layer "ambient + contact" box-shadow tokens (--mu-shadow-panel,
  --mu-shadow-panel-hover, --mu-shadow-accent-soft) and every place they're
  applied (activity bar, sidebar header/content/footer, inspector panels,
  status bar, workspace container, welcome card, session sidebar).
- The .workspace-tab.active::before gradient/glow block and its box-shadow
  glow — delete this rule completely.
- All hover transform: translateY(...) rules on buttons, cards, and tabs.
- The focus-within glow on the chat composer
  (var(--mu-shadow-panel-hover), var(--mu-shadow-accent-soft)) — replace
  with a plain border-color change to var(--text-accent), no shadow.

Replace with:
- A single flat shadow token, used only where a panel truly floats above
  content (if anywhere) — max value: 0 1px 2px rgba(0,0,0,0.12). Most
  panels should have NO shadow at all, relying only on the 1px border.
- Active tab state: flat background-color (keep the existing subtle
  rgba(255,255,255,0.07)) plus a plain solid 2px border-top in
  var(--text-accent). No pseudo-element, no gradient, no glow.
- Hover states: background-color transition only, ~120-150ms ease.
  No shadow, no transform.
- Scrollbar thumb: keep as-is (already minimal), no changes needed.

Keep unchanged:
- All layout/structural rules (flex, sizing, overflow, height/width
  constraints, border-radius values, transition timing for sidebar
  width changes).
- Border-radius scale (5-8px) — this is fine and reads clean already.

SPACING PASS
While removing the shadow layers, check that padding/gaps still feel
intentional without the shadows providing visual separation — if any area
now feels cramped or ambiguous, increase padding/gap by 2-4px rather than
reintroducing a shadow or border emphasis.

ACCEPTANCE CHECK
Before finalizing, verify against this test for every rule you touch:
"Does this add a shadow, glow, gradient, or movement/scale effect?"
If yes, remove it or replace with a flat equivalent. The end result should
look calm and quiet — closer to a plain text editor's chrome than a modern
SaaS dashboard.

DELIVERABLE
Output the full updated ModernUI.css file, preserving all existing
selectors and structural rules, with only the visual treatment (shadows,
glows, gradients, hover motion) simplified per the rules above.