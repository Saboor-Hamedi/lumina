Prompt for your agent (Noen 4):

"I want to refactor Lumina's outer workspace shell (src/renderer/src/features/Layout/ and src/renderer/src/assets/tokens.css) to adopt a floating-card 'Islands' layout architecture (like Zed / JetBrains New UI / OpenIdea), replacing our current edge-to-edge 1px hairline grid layout while keeping all Lumina features intact.

CRITICAL RULE — ZERO HARDCODED COLORS (100% Theme Engine Driven):

Never hardcode any hex, rgb(), or rgba() colors in layout CSS or components.

Every surface, recessed shell canvas, card rim, hover pill, and active indicator MUST be driven by our existing theme tokens (tokens.css and our 50-theme engine) so switching between any Light or Dark theme updates the entire Islands shell automatically.

1. Root Shell Canvas & Floating Card Architecture (#root / App Shell):

Outer Shell (app-shell): Use our recessed/secondary background token (e.g., var(--bg-shell, var(--bg-secondary)) or color-mix(in srgb, var(--bg-primary) 92%, var(--text-primary) 8%) derived purely from existing theme variables if a dedicated shell token isn't defined yet in all 50 themes) with display: flex; flex-direction: column; height: 100vh; overflow: hidden;.

Workspace Body Gaps: Inside the middle workspace row (Left Activity Bar + Left Sidebar + Center Split Area + Right Sidebar + Right Activity Bar), replace flush 1px border-right/border-left dividers with 6px–8px flex/grid gaps (gap: 6px; padding: 0 6px;).

Floating Surface Cards: Style each major docked panel—Left Sidebar (Explorer/Themes/Search), Center Editor Group(s), Right Sidebar (Note Details/Outline/Graph), and Bottom Terminal Drawer—as elevated rounded cards driven purely by theme tokens:

background: var(--bg-primary) (or var(--bg-surface) from our theme token set)

border-radius: 10px

border: 1px solid var(--border-color) (using our existing subtle border token, no hardcoded shadows/colors)

overflow: hidden so internal tab bars, editors, and scrollbars clip cleanly to the rounded corners.

Split Panes & Terminal Gap: When the center area is split horizontally/vertically or when the bottom ConPTY terminal (Ctrl + J) is open, separate each split card and the bottom terminal card with the same 6px gap and 10px border-radius instead of flush divider lines.

2. Frameless Titlebar Sitting Directly on the Shell (height: 36px–38px):

Remove the bottom border line under the top titlebar so it sits flush on the outer shell token background.

Keep data-tauri-drag-region across empty space, with compact pill/dropdown controls on the left (sidebar toggle, workspace/vault switcher, active note/breadcrumb), centered/clean command search pill (Ask anything or Search...), and utility icons + window controls on the right (preserving native macOS traffic lights when on macOS).

3. Slim Borderless Left & Right Activity Bars (width: 36px–40px):

Both the Left Activity Bar and Right Activity Bar sit directly on the outer shell background token with no inner side borders.

Center vertical icon stacks (16px–18px icons) with rounded pill hover/active states (border-radius: 7px) styled via existing --bg-hover / --accent-color theme tokens.

4. Slim Borderless Bottom Status Bar (height: 26px–28px):

Sit directly on the outer shell background token beneath the floating cards with no top hairline border.

Keep left context items (active vault/workspace indicator, active note path/breadcrumb) and right telemetry items (cursor Ln, Col, word/char count, encoding, theme/status indicators) aligned cleanly with 11px–12px typography using --text-muted / --text-secondary.

5. All 50 Themes & Zen Mode (Ctrl + .) Verification:

Audit our theme generator/tokens (tokens.css and theme definitions) so the contrast between the outer shell canvas and the inner floating cards works automatically across all 50 themes without per-theme manual hacks or hardcoded colors.

In Zen Mode (Ctrl + .), hide the titlebar, activity bars, sidebars, and status bar, expanding the main editor card cleanly with comfortable outer padding."
