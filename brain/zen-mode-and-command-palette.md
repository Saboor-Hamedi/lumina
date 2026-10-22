# 🧘 Zen Mode & Universal Command Palette Architecture Guide

Lumina provides a distraction-free writing environment coupled with keyboard-centric workspace navigation. This document explains the architecture, interactions, and design patterns behind **Zen Mode**, **The Universal Command Palette**, and **Customizable Chrome**.

---

## 1. 🧘 Instant Zen Mode (`Ctrl + .`)

Zen Mode allows writers and researchers to eliminate all interface noise with a single keypress.

### How it Works
1. **Instantaneous DOM Transition Suppression**:
   - When entering or exiting Zen Mode, `.zen-instant-transition` is synchronously injected onto `<html>` and `document.documentElement.setAttribute('data-zen-mode', 'true')` is set.
   - CSS override rules turn off all transitions on `.shell-sidebar-left`, `.shell-sidebar-right`, `.sidebar-resizer`, and `.shell-main`:
     ```css
     html.zen-instant-transition,
     html.zen-instant-transition *,
     [data-zen-mode='true'] .shell-sidebar-left,
     [data-zen-mode='true'] .shell-sidebar-right,
     [data-zen-mode='true'] .sidebar-resizer,
     [data-zen-mode='true'] .shell-main {
       transition: none !important;
       animation: none !important;
     }
     ```
   - All surrounding chrome (Title Bar, Activity Bar, Tabs, Status Bar, Breadcrumbs, and Sidebars) vanishes **simultaneously in 0ms**, without any visual sidebar pushing or delayed animations.

2. **Full State Capture & Restoration**:
   - Before entering Zen Mode, `SettingStore` preserves a snapshot of your layout (`ZenPreState`) recording the exact visibility states of:
     - `titleBarVisible`
     - `statusBarVisible`
     - `activityBarVisible`
     - `tabsVisible`
     - `breadcrumbsVisible`
     - `sidebar.isLeftOpen`
     - `rightSidebar.isRightOpen`
   - When toggling out of Zen Mode (`Ctrl + .`), the exact prior state is faithfully restored, and two animation frames later, smooth CSS transitions are safely re-enabled for normal interactions (e.g. `Ctrl + B`).

3. **Top Edge Window Dragging**:
   - In Zen Mode, when the title bar is hidden, the `useZenWindowDrag` hook captures mouse drag events along the top 28px edge of the viewport. This allows repositioning the frameless window without interfering with writing surfaces.

---

## 2. ⚡ Universal Command Palette (`Ctrl + Shift + P` / `>`)

The Command Palette is the central hub for executing commands and configuring settings without navigating nested menus.

### Key Capabilities
- **Command Mode (`>`)**:
  - Filter all application commands with fuzzy matching, category badges, and keyboard shortcuts.
- **Inline Settings Configuration**:
  - **Booleans**: Instant toggle on Enter/Click.
  - **Enums**: Opens an inline sub-picker with detailed option descriptions and checkmark indicators.
  - **Numerics (e.g. Window Opacity, Font Size, Caret Width)**:
    - Provides instant preset quick-picks (e.g. 100%, 90%, 80%, etc.).
    - Allows typing any custom number directly in the palette search box.
    - Live range validation prevents out-of-bounds values with visual cues.
    - Zero dependency on `window.prompt()`, ensuring 100% native Electron stability.
- **Chrome Visibility Toggles**:
  - `View: Toggle Zen Mode`
  - `View: Toggle Title Bar`
  - `View: Toggle Status Bar`
  - `View: Toggle Activity Bar`
  - `View: Toggle Tabs`
  - `View: Toggle Breadcrumbs`
  - `View: Toggle Primary Sidebar` (`Ctrl + B`)
  - `View: Toggle Secondary Sidebar`

---

## 3. 🕸️ Knowledge Graph Tab (`Ctrl + G`)

The Knowledge Graph is integrated as a dedicated tab (`GRAPH_TAB_ID`), replacing modal popups. It supports:
- Interactive physics simulation with spring relaxation.
- Real-time tag and title search.
- Quick node navigation directly into the active editor.
- PNG and SVG vector export.

---

## 4. 🎨 Liquid Sidebar Transitions (`Ctrl + B`)

When outside of Zen Mode, toggling the primary sidebar (`Ctrl + B`) provides a unified, fluid motion:
- Synchronized `0.25s cubic-bezier(0.16, 1, 0.3, 1)` easing across the sidebar curtain, curtain separator, and workspace editor.
- Hardware-accelerated GPU layer rendering (`transform: translateZ(0); backface-visibility: hidden; contain: layout paint;`) prevents visual lag between the container and nested file lists.
