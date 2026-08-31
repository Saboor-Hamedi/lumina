OBJECTIVE:
Redesign ONLY two UI surfaces in the Lumina app to feel subtle, premium, 
and minimal. Do NOT touch the editor canvas, table widgets, note body, 
sidebar, or any functional logic. Pure visual/CSS refinement only.

SCOPE (strictly limited to these two components):
1. The Note Header / Action Bar (the row containing the note title, 
   "Ask AI", "Local Graph", "Learned" button, and "Track: 10%" indicator)
2. The Lumina AI Chat Modal/Panel (the floating chat window with the 
   message list and the "Ask AI... or type '/' for commands" input)

OUT OF SCOPE — DO NOT MODIFY:
- The markdown editor body or CodeMirror instance
- Any table widget, table CSS, or table rendering logic
- The left sidebar / note list
- Any state management, hooks, or business logic
- Color tokens already defined in the theme (reuse existing CSS variables)

============================================================
PART 1 — NOTE HEADER / ACTION BAR REDESIGN
============================================================

Current problems: buttons look heavy, the "Learned" pill is too loud, 
the "Track: 10%" badge feels disconnected, spacing is inconsistent.

Design direction: quiet, editorial, breathable. Think Linear / Notion / 
Raycast level of restraint.

Requirements:
- Reduce overall header height slightly; increase horizontal breathing room
- Action buttons ("Ask AI", "Local Graph") should be GHOST style by default:
    * transparent background, muted text color (var(--text-muted))
    * small icon + label, 13px font, medium weight
    * on hover: very subtle background rgba(255,255,255,0.04), 
      text brightens to var(--text-normal)
    * NO borders, NO shadows in default state
    * border-radius: 6px, padding: 5px 10px, gap: 6px between icon and label
- "Learned" button states:
    * INACTIVE: same ghost style as other buttons, neutral icon
    * ACTIVE: soft filled pill using accent at LOW opacity 
      (background: color-mix(in srgb, var(--text-accent) 12%, transparent)),
      text in var(--text-accent), subtle 1px border in 
      color-mix(in srgb, var(--text-accent) 25%, transparent)
      checkmark icon, NO glow, NO shadow
- "Track: 10%" indicator:
    * make it quieter — smaller (12px), muted text
    * format as "10% learned" with a tiny 2px-tall, 40px-wide progress 
      sliver to its left (track bg at 8% opacity, fill in accent)
    * align it cleanly to the far right, vertically centered
- The note title:
    * slightly larger, semibold, var(--text-main)
    * remove any heavy underline; if a divider is needed use a 1px line 
      at 6% opacity spanning full width with generous margin below
- Transitions: all hover/active states use 120ms ease, nothing bouncy
- Dark mode: ensure ghost buttons remain legible but never glaring

============================================================
PART 2 — LUMINA AI CHAT MODAL REDESIGN
============================================================

Current problems: modal feels boxy and generic, message bubbles are 
undefined, the input bar looks like an afterthought, the header 
("Lumina AI" + icons) is cramped, @mention chips are too saturated.

Design direction: calm, focused, conversational. Like a premium 
assistant that doesn't shout. Floating glass panel aesthetic.

Requirements:

MODAL CONTAINER:
- background: var(--bg-panel) with backdrop-filter: blur(20px) saturate(140%)
- border: 1px solid rgba(255,255,255,0.06)
- border-radius: 14px
- box-shadow: 0 24px 60px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.2)
- subtle inner top highlight: inset 0 1px 0 rgba(255,255,255,0.04)
- max-width ~480px, comfortable padding

MODAL HEADER ("Lumina AI" + control icons):
- reduce visual weight — title at 13px, medium weight, var(--text-muted) 
  NOT bold white
- control icons (copy/expand/close) ghost style, 28x28px hit area, 
  muted color, hover → rgba(255,255,255,0.06) background
- thin 1px divider below header at 6% opacity
- generous padding (14px 18px)

MESSAGE LIST:
- USER messages (right aligned):
    * soft accent-tinted bubble: 
      background color-mix(in srgb, var(--text-accent) 10%, transparent)
    * border: 1px solid color-mix(in srgb, var(--text-accent) 18%, transparent)
    * border-radius: 14px 14px 4px 14px (tail points bottom-right)
    * text in var(--text-main), 14px, line-height 1.55
    * @mention chips inside user msg: SMALLER and QUIETER than now —
      background color-mix(in srgb, var(--text-accent) 14%, transparent),
      text in var(--text-accent), 12px, padding 1px 7px, radius 5px,
      NO heavy purple block — make it feel inline and subtle
- ASSISTANT messages (left aligned):
    * NO bubble background — just clean text on the panel surface 
      (this is the premium move; bubbles for bot = cheap)
    * text in var(--text-normal), 14px, line-height 1.6
    * a tiny 2px accent dot or thin vertical accent bar (2px wide, 
      rounded, 60% height of the message, at 40% opacity) on the left 
      edge to mark assistant turns subtly
    * code snippets inside assistant msg: slightly inset, 
      background rgba(255,255,255,0.03), radius 6px, mono font
- message action icons (copy / thumbs up / down) under each msg:
    * hidden by default, fade in on message hover (opacity 0 → 1, 120ms)
    * ghost style, 12px icons, muted, hover brightens
- spacing between messages: 16px, between user+assistant pair: 20px

INPUT BAR (bottom):
- container: background rgba(255,255,255,0.025), 
  border 1px solid rgba(255,255,255,0.07), border-radius 12px
- on focus-within: border brightens to 
  color-mix(in srgb, var(--text-accent) 35%, transparent),
  add faint outer ring box-shadow 0 0 0 3px color-mix(in srgb, var(--text-accent) 8%, transparent)
  NO harsh full-purple border like current
- placeholder text: var(--text-muted) at 70% opacity, 14px
- the "DeepSeek" model selector pill (bottom-left):
    * quiet chip — background rgba(255,255,255,0.04), 12px, muted text,
      small chevron, radius 6px, hover brightens subtly
- send button (bottom-right):
    * ghost/disabled state when empty: muted icon only
    * active state (text present): soft accent fill at low opacity, 
      accent-colored icon, radius 8px, 30x30px
    * NO solid bright purple block
- padding inside input: 12px 14px

SCROLLBAR (inside modal):
- 6px wide, transparent track, thumb at rgba(255,255,255,0.08),
  hover rgba(255,255,255,0.16), rounded — match the table scrollbar style

============================================================
GLOBAL RULES FOR BOTH REDESIGNS
============================================================
- Reuse existing CSS variables (--text-accent, --bg-panel, --text-muted, 
  --text-main, --border-subtle). Do NOT hardcode new hex colors except 
  rgba overlays.
- ZERO animations on layout/size. Only opacity/color/background 
  transitions at 120ms ease.
- Respect dark mode fully — test every state against the dark background.
- Keep everything SUBTLE. If a element draws the eye more than the note 
  content itself, it is too loud — tone it down.
- Maintain all existing functionality, click handlers, and props. 
  This is CSS/markup-class changes ONLY.

DELIVERABLE:
Output the updated CSS (and minimal JSX class changes if needed) for 
the header component and the AI modal component. Show before/after 
reasoning briefly. Do not modify any other file.