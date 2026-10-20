# Lumina Integrated Terminal — Architecture & Agent Knowledge

> **Agent Context & Reference Document**  
> This document serves as the ground-truth guide for AI coding agents and developers working on Lumina's integrated terminal subsystem. It details the architecture, IPC transport layer, multi-shell lifecycle, dock UI/UX paradigms, and cross-shell synchronization rules.

---

## 1. Architectural Overview

Lumina features a built-in terminal dock embedded inside `.shell-center-workspace`, sitting directly beneath the active editor and the top `TabBar`.

The terminal engine is designed with a strict separation of concerns across three layers:

```
┌─────────────────────────────────────────────────────────────┐
│                       Renderer Layer                        │
│  [Terminal.tsx] ◄──► [useTerminalSessions] ◄──► [TerminalPane]
│          │                                           │      │
│     (Sidebar UI)                                  (xterm.js)│
└──────────┼───────────────────────────────────────────┼──────┘
           │ IPC Bridge (preload/index.js)             │
┌──────────▼───────────────────────────────────────────▼──────┐
│                    Main Process Layer                       │
│                 [terminalHandlers.ts]                       │
│   activeSessions Map ◄──► child_process.spawn ◄──► stdout/in│
└─────────────────────────────────────────────────────────────┘
```

1. **State Management (`useTerminalSessions.ts`)**:
   - Manages an array of session models (`TerminalSession[]`), active session pointer (`activeId`), and local storage persistence (`lumina_terminal_sessions`).
   - Pure state logic: handles create, duplicate, rename, reorder, close, and status lifecycle without direct DOM or xterm bindings.

2. **Terminal Viewport & Instance (`TerminalPane.tsx` + `useTerminalInstance.ts`)**:
   - Manages individual xterm.js instances mapped to DOM container nodes.
   - Handles font metrics, `@xterm/addon-fit`, `@xterm/addon-web-links`, and key-event bypassing (e.g. passing `Ctrl+P`, `Ctrl+J`, `Ctrl+B` through to the app shell).
   - Provides responsive `fit()`, `refresh()`, and `focus()` handlers on tab visibility changes.

3. **Backend PTY / IPC Bridge (`terminalHandlers.ts` + `preload/index.js`)**:
   - Main process handles `terminal:spawn`, `terminal:write`, `terminal:resize`, `terminal:kill`, `terminal:attach`, and `terminal:getAvailableShells`.
   - Manages child process lifecycle, stream sanitization, and graceful recursive process tree teardown.

---

## 2. Key UX & UI Guidelines

When modifying or styling the terminal components, always preserve the following design rules:

### A. Layout & Placement
- **Under the TabBar**: The terminal dock lives inside `.shell-center-workspace`. When maximized, it must **never** obscure the top `TabBar`. It sets `height: 'auto'`, `flex: 1`, `minHeight: 0`, and hides the editor (`.workspace-container`), keeping tabs pinned at the top.
- **5px Resizers with 3 Micro-Dots**:
  - Horizontal resizer (`.terminal-resizer.top`): 5px thickness, centered 1px guide line, and a knob containing 3 horizontal micro-dots (`.knob-dot`).
  - Vertical resizer (`.terminal-resizer.left`): 5px thickness, centered 1px guide line, and a knob containing 3 vertical micro-dots (`.knob-dot`).
  - Hover / active state accents with `var(--text-accent, #8b5cf6)`.
- **Sessions Sidebar**:
  - Default width is 170px (resizable between 120px and 350px, double-click resizer to reset to 170px).
  - Background: `var(--bg-sidebar, #0e0e11)`.
  - Right viewport background: `var(--bg-editor, #0c0c0e)`.

### B. Header Actions & Icons
- **Shell Selector & Dropdown**: Displays `>_ <Shell Name> v` and a `+` button on the left session header.
- **Session List Items**: Shows status dot (green for running, red for exited), terminal icon, editable session name, inline rename button (`Edit2`), and delete button (`Trash2`).
- **Viewport Controls**: Viewport header has Kill Terminal (`Trash2`), Maximize/Minimize toggle (`Maximize2` / `Minimize2`), and Close Terminal (`X`, shortcut `Ctrl+J`).

---

## 3. Supported Shells & Discovery

Lumina safely detects and supports native shell profiles across platforms without launching heavy persistent processes:

### Windows:
1. **Git Bash** (`bash.exe`): Discovered via candidate locations (`C:\Program Files\Git\bin\bash.exe`, local app data). Spawns with `['--login', '-i']`.
2. **PowerShell** (`powershell.exe`): System built-in. Spawns with `['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass']`.
3. **PowerShell 7** (`pwsh.exe`): Discovered in `Program Files\PowerShell\7` or local app data. Spawns with `['-NoLogo', '-NoExit']`.
4. **Command Prompt** (`cmd.exe`): System built-in. Spawns with `['/k']` to start in interactive console mode cleanly at row 0 without the OS copyright banner or input buffering stalls.
5. **WSL** (`wsl.exe`): Validated conditionally when available.

### Linux / macOS:
- Discovers installed Unix shells: `/bin/zsh`, `/bin/bash`, `/usr/bin/fish`, `/bin/sh`.

---

## 4. Input & Stream Synchronization Rules

Different shells behave differently under piped stdin/stdout streams on Windows. Keep the following invariants in mind:

### Enter Key / Newline Normalization
- In [terminalHandlers.ts](file:///b:/electron/lumina/src/main/handlers/terminalHandlers.ts):
  - **Windows CMD & PowerShell**: Enter must be normalized to `\r\n`. Writing bare `\r` will not trigger command execution in cmd.exe.
  - **Git Bash (POSIX)**: Enter must be normalized to `\n`. Sending `\r\n` causes duplicate prompts or stray newlines in Git Bash.

### CMD Initial Prompt Sanitization
- CMD output includes a multi-line copyright header and leading CRLFs when spawned over pipes.
- [terminalHandlers.ts](file:///b:/electron/lumina/src/main/handlers/terminalHandlers.ts) extracts the prompt baseline on initial launch by isolating `initialCmdBuffer.slice(lastNl + 1, promptIdx + 1)` and appending any remainder so CMD starts on row 0 without extra blank lines and without dropping command input.

### Caret & Buffer Repaint on Tab Switching
- When switching between terminal sessions, [TerminalPane.tsx](file:///b:/electron/lumina/src/renderer/src/features/terminal/TerminalPane.tsx) uses `requestAnimationFrame` to trigger:
  ```ts
  fit()      // Computes geometry to container
  refresh()  // term.refresh(0, term.rows - 1) forces re-render of glyphs
  focus()    // Re-focuses terminal input
  ```
- This guarantees the cursor never appears misplaced on top of prompt text when navigating between sessions.

---

## 5. Process Lifecycle & Teardown

- **Single Session Destruction**: When a tab is deleted or `terminal:kill` is called, [terminalHandlers.ts](file:///b:/electron/lumina/src/main/handlers/terminalHandlers.ts) executes `terminateProcessTree(proc)`:
  - On Windows: Uses `taskkill /F /T /PID ${proc.pid}` to terminate the process and all child processes spawned inside the shell session.
  - On Unix: Sends `SIGTERM` followed by `SIGKILL` fallback.
- **Application Teardown**: `terminateAllTerminalSessions()` cleans up all active session processes on window close or app exit to prevent orphaned background processes.

---

## 6. Relevant Source Files

- **UI & Layout**:
  - [Terminal.tsx](file:///b:/electron/lumina/src/renderer/src/features/terminal/Terminal.tsx) — Main dock component with sidebar and viewport header.
  - [TerminalPane.tsx](file:///b:/electron/lumina/src/renderer/src/features/terminal/TerminalPane.tsx) — Individual terminal pane wrapper.
  - [MainLayout.tsx](file:///b:/electron/lumina/src/renderer/src/features/Layout/MainLayout.tsx) — Dock integration, resizing logic, and maximize handlers.
  - [terminal.css](file:///b:/electron/lumina/src/renderer/src/assets/modernUI/terminal.css) — Resizer knob styling, micro-dots, and xterm viewport styling.
- **Core State & Engine**:
  - [useTerminalSessions.ts](file:///b:/electron/lumina/src/renderer/src/core/terminal/useTerminalSessions.ts) — Session CRUD and local persistence.
  - [useTerminalInstance.ts](file:///b:/electron/lumina/src/renderer/src/core/terminal/useTerminalInstance.ts) — xterm instance binding, shortcuts bypass, fit/refresh.
  - [constants.ts](file:///b:/electron/lumina/src/renderer/src/core/terminal/constants.ts) — Theme, fonts, and platform shell defaults.
- **Main Process & IPC**:
  - [terminalHandlers.ts](file:///b:/electron/lumina/src/main/handlers/terminalHandlers.ts) — Native spawn, write, stream sanitization, and tree kill.
  - [preload/index.js](file:///b:/electron/lumina/src/preload/index.js) — IPC bridge channels for terminal actions.
