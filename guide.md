# Lumina — Agent Task Templates (v1)

Advanced engineering templates for your coding agent. Pick the template that matches
the task, fill in the `## INPUT` sections, then instruct the agent to **follow the
template exactly** (do the required steps in order, respect the constraints, and report
the outputs listed under "Deliverables").

> Rule for the agent: complete EVERY step. Do not skip "Verify". Do not modify files
> outside the ones listed under "Files touched" unless the template says otherwise.
> After finishing, answer the "Deliverables" section explicitly.

---

## TEMPLATE 1 — New Feature (UI Component)

### INPUT
- Feature name:
- Where it appears (route / modal / sidebar / editor):
- Files to touch:
- Behavior spec (user-visible):

### REQUIRED STEPS
1. Read the 3 most similar existing components (same folder) to match conventions.
2. Create the component + a `.css` file next to it (follow existing naming).
3. Wire it into its parent (`AppShell.jsx` / `MarkdownEditor.jsx` / etc.) with the
   existing event/state pattern (CustomEvent or zustand store).
4. Add plain-language user-facing copy. No jargon (API key, model ID, RAG, etc.).
5. Handle empty state + loading state + error state.
6. Keyboard: Escape closes if it is an overlay; add a shortcut only if the task asks.
7. **Verify:** `npm run test:run` — all pass. Add a unit test if the component has logic.

### DELIVERABLES
- Files changed list
- How to reproduce the feature
- Screenshot/description of the UI
- Test results

---

## TEMPLATE 2 — Bug Fix

### INPUT
- Bug description (what happens / what should happen):
- Steps to reproduce:
- Suspected file/area:

### REQUIRED STEPS
1. Reproduce the bug first (run the app or the relevant test).
2. Read the surrounding code to find root cause — do not patch blindly.
3. Fix the minimal surface; do not refactor unrelated code.
4. Add a regression test that fails before the fix and passes after.
5. **Verify:** run the affected test file, then the full `npm run test:run`.

### DELIVERABLES
- Root cause (1–3 sentences)
- The fix (what changed and why)
- Regression test name + result

---

## TEMPLATE 3 — Refactor (No Behavior Change)

### INPUT
- Target file(s):
- Goal (e.g., extract helper, unify state, reduce duplication):
- Success criteria (what must stay identical):

### REQUIRED STEPS
1. Read the full target file + its callers before touching anything.
2. Make the refactor in small, reviewable steps (rename → extract → unify).
3. Keep public exports/API identical unless the task explicitly allows breaking them.
4. **Verify:** full test suite + manual smoke of the affected feature.

### DELIVERABLES
- Before/after structure summary
- Confirmation no behavior changed
- Test results

---

## TEMPLATE 4 — Performance Optimization

### INPUT
- Slow area (measured symptom):
- Performance target:
- Suspected bottleneck:

### REQUIRED STEPS
1. Measure before (console timing / workbench / profiler) and record the number.
2. Identify the hotspot (re-renders, heavy imports, sync IO, DOM rebuilds).
3. Apply the cheapest effective fix (memo, debounce, lazy import, cache, virtualization).
4. Measure after and compare against the before number.
5. **Verify:** full test suite still green.

### DELIVERABLES
- Before vs after numbers
- What was changed
- Risk notes (anything that could regress)

---

## TEMPLATE 5 — CSS / Theme / Visual Polish

### INPUT
- Element/class to style:
- Desired look (reference another styled element):
- Theme vars to use (from `themeDefinitions` / `variables.css`):

### REQUIRED STEPS
1. Find the current CSS (component `.css` file or `MarkdownEditor.css`).
2. Use existing CSS variables (`var(--text-accent)`, `var(--bg-*)`, `var(--border-*)`)
   — never hardcode hex colors for theming.
3. Check dark + light theme; check the "mirror mode" glassmorphism state if relevant.
4. Keep responsive (below ~900px) behavior intact.
5. **Verify:** build + visual check; no test regression.

### DELIVERABLES
- CSS diff summary
- Which variables/classes were used
- Notes on theme coverage

---

## TEMPLATE 6 — New Shortcut

### INPUT
- Action name:
- Shortcut key:
- Where bound (global / editor / modal):

### REQUIRED STEPS
1. Add the binding in `src/renderer/src/core/hooks/useKeyboardShortcuts.js` (global)
   or the component's own keydown (scoped).
2. Avoid conflicts: search existing bindings for the same combo.
3. Add it to `SHORTCUT_DISPLAY_GROUPS` so Settings → Advanced → Shortcuts shows it.
4. Update `brain/Shortcuts.md` (the in-app docs) and README if it is a headline action.
5. **Verify:** unit test for the hook if global; e2e not required for new shortcuts.

### DELIVERABLES
- Where the binding lives
- Confirmation it appears in Settings shortcuts list + docs
- Conflict check result

---

## TEMPLATE 7 — AI / LLM Integration

### INPUT
- Provider / model:
- Where invoked (chat / inline / palette):
- API key source (Settings key name):

### REQUIRED STEPS
1. Read `features/AI/providers/*.js` and `features/AI/tools/LuminaChat.js` to match the
   provider pattern (BaseProvider + factory registration).
2. Add the provider class + register in `providers/index.js`.
3. Add its key field in `useSettingsStore.js` defaults + `SettingsManager.js` defaults.
4. Wire the friendly error mapping (see guide §2.1 pattern): never surface raw status/bodies.
5. Add a "Where do I find this?" link in the Settings Assistant tab.
6. **Verify:** unit test the provider with mocked fetch; run full suite.

### DELIVERABLES
- Provider file + registration
- Settings wiring
- Error-copy handled?
- Test result

---

## TEMPLATE 8 — New IPC Channel (Main ⇄ Renderer)

### INPUT
- Channel name:
- Direction (main→renderer / renderer→main / both):
- Payload shape:

### REQUIRED STEPS
1. Add the `ipcMain.handle` / `ipcMain.on` in `src/main/index.js` (or a handler file in
   `src/main/handlers/`).
2. Expose it on `window.api` in `src/preload/index.js`.
3. Guard: check the API exists in the renderer before calling (`window.api?.method`).
4. Handle errors in main and return friendly results; log details to console.
5. **Verify:** add a unit test (main handler) + e2e test if it hits the real app.

### DELIVERABLES
- Channel name + both sides wired
- Error handling approach
- Test result

---

## TEMPLATE 9 — Data / Storage Change (Settings or Notes)

### INPUT
- What data to add/change:
- Persistence location (settings.json / note frontmatter / IndexedDB):
- Migration needed for existing data?

### REQUIRED STEPS
1. Add defaults in `src/main/SettingsManager.js` (settings) — never break existing keys.
2. Add the store default in `useSettingsStore.js` + merge logic.
3. If the change is to note frontmatter, update `VaultManager.js` read/write + `gray-matter`.
4. If migration is needed, add a one-time migration that is idempotent.
5. **Verify:** unit tests for the store/handler; e2e only if it changes on-disk format.

### DELIVERABLES
- Where the value lives (main + renderer)
- Migration steps (if any)
- Backward-compat notes
- Test result

---

## TEMPLATE 10 — New Test (Unit)

### INPUT
- File/function under test:
- Behavior to cover:

### REQUIRED STEPS
1. Match an existing test in `test/` (mirror the path under `test/main` or `test/renderer`).
2. Mock `window.api` / `electron` / storage exactly like neighboring tests.
3. Cover: happy path, edge/empty case, error case.
4. No real disk/network in unit tests (mocked). Use temp dirs only for real-fs logic.
5. **Verify:** run the new file, then the full suite.

### DELIVERABLES
- Test file path + count of tests
- Full-suite result

---

## TEMPLATE 11 — New Test (E2E, Playwright)

### INPUT
- User flow to cover:
- Vault setup needed:

### REQUIRED STEPS
1. Place in `test/e2e/*.e2e.test.js` using `helpers/launch.js`.
2. Use isolated temp vault (launcher handles it). Never parallel (workers: 1).
3. Scope selectors to the relevant container to avoid ambiguity (e.g. `.settings-container`).
4. Verify the real DOM + real filesystem where relevant.
5. **Verify:** `npm run build` then run the single file, then the full e2e suite.

### DELIVERABLES
- Test file + scenario list
- Full e2e result

---

## TEMPLATE 12 — Documentation Update

### INPUT
- What changed (feature/shortcut/setting):
- Which docs (README / brain/*.md / both):

### REQUIRED STEPS
1. Update `README.md` feature + usage sections with the same wording style.
2. Update the matching `brain/*.md` (renders in the in-app Documentation modal).
3. Keep the shortcut list in `brain/Shortcuts.md` the single source of truth.
4. Never touch `src/renderer/src/features/Docs/Documentation.jsx` (it reads brain/*.md).
5. **Verify:** build so the docs glob picks up new/edited files.

### DELIVERABLES
- Files changed
- Confirmation Documentation.jsx untouched
- Any copy that was made plainer

---

## TEMPLATE 13 — Onboarding / First-Run Flow

### INPUT
- Trigger (first launch / first note):
- Steps the user sees:

### REQUIRED STEPS
1. Detect first-run via a persisted setting (`SettingsManager` default + store).
2. Never block the app on the flow — always dismissible / skippable.
3. Use plain language; no jargon; every button labeled with text + icon.
4. Provide empty states that teach (e.g., "Create your first note" + button).
5. **Verify:** unit test the first-run flag logic; manual e2e of the flow.

### DELIVERABLES
- Where the flag lives + default
- Flow steps
- Test result

---

## TEMPLATE 14 — Error-Handling Pass

### INPUT
- Area to harden (AI / IPC / editor):
- Current raw errors (file:line):

### REQUIRED STEPS
1. Find every place a raw error/status could reach the user (search `Error:`, `API Error`,
   `error.message`, `.status`).
2. Map each to a friendly message (see guide §2.1 mapping table).
3. Log the technical detail to `console.error` only — never render it.
4. **Verify:** full test suite; confirm no raw error strings render.

### DELIVERABLES
- List of mapped errors (raw → friendly)
- Console-only logging confirmed
- Test result

---

## TEMPLATE 15 — Accessibility / Keyboard-First Pass

### INPUT
- Component/area:
- Required a11y level (labels / focus / roles):

### REQUIRED STEPS
1. Ensure every interactive element has an accessible name (aria-label / text / title).
2. Verify keyboard reachability (Tab order, Escape closes overlays, Enter activates).
3. Use semantic roles (`button`, `option`, `listbox`) where the component already does.
4. Preserve existing shortcuts; add `SHORTCUT_DISPLAY_GROUPS` entries if new.
5. **Verify:** existing keyboard tests (useKeyboardShortcuts) still pass.

### DELIVERABLES
- Elements fixed + how
- Keyboard flow description
- Test result

---

## TEMPLATE 16 — Multi-Theme / Dark-Light Consistency

### INPUT
- Component/area:
- Themes to verify (default list in `themeDefinitions.js`):

### REQUIRED STEPS
1. Replace any hardcoded colors with theme CSS variables.
2. Check the component under 2–3 themes (one dark, one light, one accent-heavy).
3. Verify high-contrast and mirror-mode variants if affected.
4. **Verify:** build + visual check across themes.

### DELIVERABLES
- Colors replaced
- Themes checked
- Notes on contrast

---

## TEMPLATE 17 — Build / Packaging Fix

### INPUT
- Symptom (app won't start / uninstall broken / installer issue):
- Target platform:

### REQUIRED STEPS
1. Confirm native modules are rebuilt for Electron BEFORE packaging:
   `npm run rebuild` (better-sqlite3) — `npmRebuild: false` is set, so this is required.
2. Verify `npm run build` output is complete: `dist/win-unpacked/Lumina.exe` +
   `dist/win-unpacked/resources/app.asar` must both exist before packaging.
3. Confirm `appId`/`productName` are stable (uninstall registry is keyed on appId —
   changing it orphans the old uninstall entry).
4. Run `npm run build:win` and confirm the installer + `latest.yml` are produced.
5. **Verify:** install the fresh build, launch it, and uninstall it cleanly.

### DELIVERABLES
- Rebuild + build commands run
- Installer artifact names
- Clean install/launch/uninstall confirmed

---

## TEMPLATE 18 — Table Editor Feature (Obsidian-style)

### INPUT
- Table capability to add (select whole table / column / row / reorder / context menu):
- Files (default): `features/table/tableWidgetExtension.js`, `tableGridSelection.js`,
  `tableContextMenu.js`, `features/Editor/MarkdownEditor.css`

### REQUIRED STEPS
1. Read the full `tableWidgetExtension.js` first — cell DOM is rebuilt on each keystroke
   (`renderCellSourceDecorated`), so position-based re-resolution is required for anything
   that survives a rebuild.
2. Selection must be cursor/mouse-driven (drag to select cells; corner/arrow/handle to
   select table/column/row). Do NOT rely on Ctrl+A.
3. Use theme-accent highlight, not hardcoded `#2196F3`; avoid the
   `background: transparent !important` conflict on `td`/`th`.
4. Persist structural edits through `dispatchModel(view, wrap, model)`.
5. **Verify:** full unit suite + manual interaction checklist (drag, single-cell, whole-table).

### DELIVERABLES
- What was added + files changed
- Interaction checklist results
- Test result

---

## TEMPLATE 19 — Cleanup / Repo Hygiene

### INPUT
- Items to clean (duplicate dirs / committed artifacts / stray files):

### REQUIRED STEPS
1. Identify generated artifacts (`test-results/`, `test/e2e/report/`, `coverage/`) and add
   to `.gitignore` (do not delete test source files).
2. For junk already committed: `git rm -r --cached <path>` (keep on disk) unless asked to
   delete.
3. Do NOT touch `test/e2e/*.test.js` or `test/main/*`/`test/renderer/*` source files.
4. Report anything sensitive (e.g., committed `.env*`) — do not silently leave secrets.
5. **Verify:** `git status` clean of generated files; tests still pass.

### DELIVERABLES
- `.gitignore` diff
- Files untracked (kept on disk)
- Secrets/risk report

---

## TEMPLATE 20 — Release Preparation

### INPUT
- Version bump target:
- Changelog entries:

### REQUIRED STEPS
1. Bump `version` in `package.json` (match the tag you will create).
2. Update README badges/tests counts if they changed (verify actual counts first).
3. Confirm `npm run build` + full test suite pass.
4. Rebuild native deps for Electron before packaging (see Template 17).
5. Confirm the GitHub release assets: `latest.yml` + `*-setup.exe` + `.blockmap` are published.
6. Smoke-test the packaged app from a clean install (launch → update path → uninstall).

### DELIVERABLES
- New version + tag
- Build/test results
- Release asset list
- Clean-install smoke result

---

## TEMPLATE 21 — Daily Note Templates (Content Spec)

> Implement the FULL template list below in
> `src/renderer/src/features/Navigation/components/defaultTemplates.js`.
> Each entry is `{ title: '...md', code: '...' }`. Replace the current tech-only set
> with the broader set here. Do NOT modify `DailyNotes.jsx`, `TemplateModal.jsx`, or any
> other file.

### SPEC — the 16 default templates

1. **Daily Log.md** — `# 📅 Daily Log` with sections: Notes & Thoughts, Tasks, Wins.
2. **Learning Notes.md** — `# 🎓 Learning Notes` with: What I Want to Understand, Key
   Concepts, Aha Moments, How This Connects to What I Already Know, Open Questions,
   Test My Understanding.
3. **Research Notes.md** — `# 🔬 Research Notes` with: Problem Statement, Sources/Evidence,
   Findings, Arguments For, Arguments Against, Conclusion/Next Steps.
4. **Book Notes.md** — `# 📚 Book Notes` with: Title/Author/Dates, Why I'm Reading This,
   Key Ideas, Favorite Quotes, My Reflections, Actions I'll Take From This Book.
5. **Article Summary.md** — `# 📰 Article Summary` with: Title/Author/URL, Main Argument
   in my own words, Key Points, What I Agree/Disagree With, How This Applies to Me.
6. **Writing Draft.md** — `# ✍️ Writing Draft` with: Working Title, Goal/Audience,
   Hook/Opening, Outline, Draft, To Fix Later.
7. **Meeting Notes.md** — `# 👥 Meeting Notes` with: Date/Attendees, Agenda, Discussion,
   Action Items.
8. **Project Planning.md** — `# 🚀 Project Planning` with: Project Outline, Milestones,
   Risks & Blockers, Resources & Links.
9. **Deep Work Session.md** — `# 🧠 Deep Work Session` with: Primary Goal, Tasks to
   Complete, Distractions Log, Session Review.
10. **Weekly Review.md** — `# 📅 Weekly Review` with: Wins This Week, What Didn't Go Well,
    What I Learned, Focus for Next Week.
11. **Journal.md** — `# 📓 Personal Journal` with: How Am I Feeling Today, What Did I Learn,
    Highlights, Grateful For.
12. **Brainstorming.md** — `# 🌪️ Brainstorming` with: The Problem/Prompt, Ideas, Discarded
    Ideas, Best Ideas to Explore.
13. **Decision Log.md** — `# ⚖️ Decision Log` with: Decision to Make, What Am I Trying to
    Achieve, Options, Trade-offs, Decision, Review Date.
14. **Idea Capture.md** — `# 💡 Idea Capture` with: Date, The Idea, Why Now, Who Is This
    For, First Tiny Step, Who Could Help.
15. **Morning Pages.md** — `# ☕ Morning Pages` with: Stream of Consciousness, Gratitude.
16. **Habit Tracker.md** — `# 🔄 Habit Tracker` with: Morning Routine, Afternoon, Evening
    Routine.

### REQUIRED STEPS
1. Read the current `defaultTemplates.js` — keep the same `{ title, code }` shape and
   emoji-led markdown style.
2. Replace the existing entries with all 16 above (no leftover standup/tech-only templates
   unless they map to one of the 16).
3. Keep each template short (under ~20 lines), using `##` sections, `- ` bullets, `- [ ]`
   checkboxes, and `>` quotes — matching what `TemplateModal`'s wireframe preview can render.
4. Do not touch `DailyNotes.jsx`, `TemplateModal.jsx`, `TemplateModal.css`, or anything else.
5. **Verify:** `npm run build` succeeds.

### DELIVERABLES
- Full list of template titles written
- Confirmation no other files changed
- Build result
