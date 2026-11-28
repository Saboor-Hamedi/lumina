Analyzed defaultShortcuts.ts:L1-120
Analyzed commandsRegistry.ts:L1-120
Analyzed changelog.md:L1-120
Analyzed SettingStore.ts:L1-120
Analyzed SettingStore.ts:L420-490
Created workspaceProfile.ts
Created workspaceProfile.test.ts
Edited defaultShortcuts.ts
Edited commandsRegistry.ts
Edited WorkspaceSwitcher.tsx
Edited SettingStore.ts
Edited SettingStore.ts
Edited useWorkspace.ts
Edited useWorkspace.ts
Analyzed useWorkspace.ts:L215-266
Edited changelog.md
Edited useWorkspace.ts
Ran run typecheck and test suites

Implemented the Workspace Switcher shortcut (`Ctrl + Alt + W` / Command Palette), per-workspace theme & AI profiles, and updated [changelog.md](file:///b:/electron/lumina/brain/changelog.md). Running TypeScript compilation and the test suites now.

Both features are implemented, [changelog.md](file:///b:/electron/lumina/brain/changelog.md) is updated, and all **126/126** tests passed (`0` TypeScript errors):

### Implemented
1. **Quick Workspace Switcher Shortcut & Command Palette**
   - [defaultShortcuts.ts](file:///b:/electron/lumina/src/renderer/src/core/shortcuts/defaultShortcuts.ts): Added `switchWorkspace` bound to **`Ctrl + Alt + W`** (`Cmd + Alt + W` on macOS — avoiding `Ctrl + Shift + W`, which is already bound to `Close Window`).
   - [commandsRegistry.ts](file:///b:/electron/lumina/src/renderer/src/features/commandpalette/utils/commandsRegistry.ts) & [WorkspaceSwitcher.tsx](file:///b:/electron/lumina/src/renderer/src/features/Layout/WorkspaceSwitcher.tsx): Registered **`Workspace: Switch Workspace`** in the Command Palette (`>Switch Workspace`) and wired `Ctrl + Alt + W` directly to toggle the TitleBar Workspace Switcher.

2. **Per-Workspace Theme & AI Profiles**
   - [workspaceProfile.ts](file:///b:/electron/lumina/src/renderer/src/features/Settings/hook/workspaceProfile.ts): Added lightweight per-workspace profile persistence (`theme`, `accentColor`, `activeAIMode`) keyed by normalized workspace path.
   - [SettingStore.ts](file:///b:/electron/lumina/src/renderer/src/core/store/SettingStore.ts) & [useWorkspace.ts](file:///b:/electron/lumina/src/renderer/src/features/Settings/hook/useWorkspace.ts): Automatically saves theme, accent color, and AI mode changes to the active workspace's profile and restores them seamlessly when switching workspaces (and cleans up profiles when removing a recent workspace).
   - Added unit tests in [workspaceProfile.test.ts](file:///b:/electron/lumina/test/renderer/src/features/Settings/workspaceProfile.test.ts).

3. **Changelog Updated**
   - [changelog.md](file:///b:/electron/lumina/brain/changelog.md): Updated the `v2.4.0` section cleanly with only the changes, improvements, and fixes from this release.

**Verification:** `npm run typecheck` (0 errors) and **18/18 test files (126/126 tests)** passed across `Settings/`, `voice/`, `commandpalette/`, and `SettingStore.test.ts`.

---

### 🎨 UI Designer Review — What Will Make Users Fall in Love on First Launch

Lumina's Islands shell already has strong JetBrains/Linear bones. The difference between *"nice IDE"* and *"I never want to leave this app"* comes down to **first-5-seconds impression, typography, and micro-craft**:

1. **Curate 4–5 Signature "Hero" Themes (Instead of Many Similar Ones)**
   - Users judge an app in the first 3 seconds by its default theme contrast. Make sure your default **Dark** and **Light** themes have:
     - **3 unmistakable surface tiers**: `--bg-shell` (recessed canvas) → `--bg-surface` (island cards) → `--bg-panel` / `--bg-hover` (elevated popovers & inputs), with crisp WCAG AA+ contrast on muted text (`--text-muted`).
     - A signature warm light theme (like **Paper / Alabaster** with warm `#f7f6f3` shell + pure white islands) — most desktop apps neglect Light Mode, so a gorgeous Light Mode immediately stands out.
2. **Typography & Reading Rhythm in the Editor**
   - Give the Markdown editor a subtle **optimal reading measure** (`max-width: 720–780px` centered in wide panes, toggleable as "Readable Line Length"), slightly tighter heading tracking (`-0.025em`), and generous vertical breathing room above `H1`/`H2` — this single change makes notes feel like Notion/Craft/Bear instead of a raw code editor.
3. **Delightful Empty States & First-Run Welcome**
   - When a user opens an empty tab, empty folder, or fresh vault, replace plain text with a calm, crisp empty state: 3 keyboard-hinted quick actions (`New Note Ctrl+N`, `Open Vault Ctrl+Alt+W`, `Ask Lumina`), subtle monochrome iconography, and zero clutter.
4. **Unified Control Density & Focus Rings**
   - Standardize every interactive control across Settings, Modals, and Dropdowns to one shared scale:
     - `26px` compact inputs/pills, `30px` primary buttons, `6px` control radius, `10px` card/popover radius, and a consistent `2px` soft `--accent-color` focus ring on `:focus-visible`.
5. **Tactile Micro-Feedback (Without Over-Animating)**
   - Subtle `active: scale(0.98)` press feedback on primary buttons, smooth `120ms` opacity/slide on popovers, and crisp skeleton shimmers for async panes — fast enough to feel instant, refined enough to feel native.

If you want to start with one of these (e.g. **Readable Line Length + Editor Typography**, **Signature Theme Contrast Audit**, or **Empty States & Control Unification**), tell me which one and we'll craft it cleanly!
