# dev-snippet

dev-snippet is a compact Electron + React app for creating, editing and managing small code or text snippets. It ships a lightweight editor with autosave, markdown preview, keyboard shortcuts, and an approachable packaging setup so you can build native installers for Windows / macOS / Linux.

This README explains how the project is organized, how to run and build it, how icons and packaging work, useful keyboard shortcuts, and quick troubleshooting tips.

**Friendly note:** this README is written to be published on a website. If you'd like shorter or localized versions, tell me which sections to trim or translate.

**Table of contents**
- **Getting started** (dev & build)
- **Icons & Packaging**
- **Development workflow & tooling**
- **How the app works (architecture)**
- **Keyboard shortcuts & focus behavior**
- **Where to make common changes**
- **Troubleshooting**
- **Contributing**

---

**Getting started**

Prerequisites
- Node.js 18+ (LTS recommended)
- npm (or your package manager of choice)
- On macOS: Xcode command line tools (for packaging)

Install dependencies:

```bash
npm install
```

Run in development (live reload via electron-vite):

```bash
npm run dev
```

Build packaged artifacts
- Windows:

```bash
npm run build:win
```

- macOS (run on macOS):

```bash
npm run build:mac
```

- Linux:

```bash
npm run build:linux
```

Build notes: the build scripts run the Vite build for the renderer and then run `electron-builder` to produce platform installers. See `package.json` scripts.

---

**Icons & Packaging**

- During development the window attempts to use a platform-appropriate icon (`resources/icon.ico` on Windows and `renderer/public/icon.png` on other platforms). However, OS-level icons (Start menu, pinned shortcuts, installer exe, .app bundle) are embedded at packaging time.
- `electron-builder` is configured to use resources from the `build/` folder (see `electron-builder.yml`). Place `build/icon.ico` and `build/icon.icns` there prior to packaging.

Quick helper: if you have a high-resolution source PNG (recommended 1024×1024), generate icons with the included npm script:

```bash
# requires internet for `npx` or install electron-icon-maker globally
npm run make:icons
```

This runs `npx electron-icon-maker --input renderer/public/icon.png --output build` and produces `build/icon.ico` and `build/icon.icns` (when possible). After packaging, the produced installers will show your custom icon instead of Electron's default.

If you want the dev BrowserWindow to display the custom Windows icon immediately, copy `build/icon.ico` to `resources/icon.ico` and restart `npm run dev`.

---

**Development workflow & tooling**

- Linting & formatting: Prettier and ESLint are recommended in your editor.
- Native modules: `better-sqlite3` is used in the main process. After `npm install`, we run `electron-rebuild` in `postinstall` (see `package.json`). If you encounter native build issues, run:

```bash
npm run rebuild
```

---

**How the app works (architecture)**

- Main process: `src/main/index.js` — creates BrowserWindow, registers IPC handlers for file dialogs and database access, and initializes a small SQLite DB (`snippets.db`) stored in the user's appData (`app.getPath('userData')`). The window icon is chosen per-platform in `createWindow()`.
- Preload: `src/preload/index.js` — exposes a small safe API to the renderer for IPC operations (open file, read/write, DB RPC).
- Renderer: `src/renderer/src` — React app built with Vite. Key folders:
	- `components/` — UI components (Workbench, SnippetEditor, SnippetLibrary, StatusBar, SettingsPanel, modal dialogs, etc.)
	- `hook/` — custom hooks (`useSnippetData`, `useToast`, `useKeyboardShortcuts`, etc.)
	- `utils/` — small utilities such as `ToastNotification`

Data flow summary:
- `SnippetLibrary` is the top-level view manager: it holds active view state (`snippets`, `editor`, `settings`, `welcome`) and orchestrates opening the editor, creating drafts, and showing modals.
- `SnippetEditor` renders the editor and live preview. It contains an autosave timer, a `textareaRef` and focuses the editor reliably when a snippet is opened or created.
- Database access (CRUD for snippets and settings) is performed in the main process via better-sqlite3 and exposed to the renderer by IPC handlers.

---

**Keyboard shortcuts & focus behavior**

The app provides global keyboard shortcuts that are intentionally conservative (they avoid interfering when typing in inputs):

- Escape — close modals (rename/delete/command palette) or cancel editor
- Ctrl/Cmd + N — Create a new snippet (opens editor in create mode). The editor `textarea` is focused by `SnippetEditor`'s `textareaRef` effects.
- Ctrl/Cmd + R — Open Rename modal for the selected snippet
- Ctrl/Cmd + Delete — Open Delete confirmation for selected snippet
- Ctrl/Cmd + S — Save (opens save/name prompt when needed)
- Ctrl/Cmd + P — Toggle Command Palette
- Ctrl/Cmd + Shift + W — Go to Welcome page
- Ctrl/Cmd + Shift + C — Copy selected snippet's code to clipboard
