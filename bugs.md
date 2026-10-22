# Lumina — Complete Command Palette, Settings Discovery, and Zen Mode

## Objective

Upgrade Lumina's existing `CommandPalette.tsx` into a complete, production-grade command and settings discovery system inspired by VS Code.

Implement the following features:

1. Complete `Ctrl + Shift + P` command palette.
2. Search and modify all supported application settings directly from the palette.
3. Add `Ctrl + .` as the default Zen Mode shortcut.
4. Allow individual UI components to be hidden and restored from the command palette.
5. Persist Zen Mode and component visibility preferences in `setting.json`.
6. Support moving the application window using `Alt + Click` in Zen Mode.

**Important:** This is an implementation task, not a mockup. Inspect the existing code, integrate with the current architecture, implement the features, and test them.

## 1. Audit the Existing Architecture

Start by inspecting:

- `src/renderer/src/features/commandpalette/CommandPalette.tsx`
- `src/renderer/src/features/Editor/meta`
- The existing settings UI and settings data model.
- The current `setting.json` storage and persistence mechanism.
- Keyboard shortcut registration and conflict handling.
- The title bar, status bar, activity bar, left sidebar, and right sidebar components.
- Existing editor layout and window-management code.
- Theme management, editor preferences, and component visibility state.

Trace how settings are loaded, updated, persisted, and restored at application startup.

Reuse existing components, stores, commands, and persistence utilities wherever possible. Do not introduce a second settings system or duplicate component visibility state.

## 2. Complete the Command Palette — `Ctrl + Shift + P`

Make the existing command palette a central entry point for discovering and executing application commands.

### Required behavior

- Open with `Ctrl + Shift + P`.
- Close with `Escape`.
- Support keyboard navigation using arrow keys and `Enter`.
- Filter commands as the user types.
- Display clear command names, categories, and keyboard shortcuts where applicable.
- Support mouse selection without breaking keyboard navigation.
- Keep the palette responsive with a large command registry.
- Provide a useful empty state when no results match.
- Prevent keyboard events from triggering editor commands while the palette is active.
- Ensure focus is correctly restored when the palette closes.

Commands must execute their real application actions, not merely display labels.

### Command categories

Include all relevant existing Lumina functionality, such as:

- File and note operations.
- Navigation and tab management.
- Editor actions.
- Search and workspace operations.
- Theme and appearance.
- Layout and panel visibility.
- Zen Mode.
- Settings.
- Supported extensions and application features.

Discover commands from the actual codebase. Do not invent commands for functionality that does not exist.

## 3. Make All Supported Settings Searchable

The command palette must allow users to discover and modify all supported application settings, similar to VS Code.

Do not limit settings search to a small, manually maintained subset.

### Requirements

- Discover settings from the existing settings schema, registry, or authoritative configuration model.
- Include every supported setting, including settings for the editor, appearance, theme, layout, panels, shortcuts, and other implemented features.
- Display readable setting names and descriptions.
- Allow searching by setting name, keyword, and relevant aliases.
- Show the current value where practical.
- Support the appropriate control or interaction for each setting type.
- Allow users to change supported settings directly from the palette.
- Validate values before applying them.
- Persist changes through the existing settings service.
- Apply changes immediately when the setting supports live updates.
- Keep the settings page and command palette synchronized.

For example, a user searching for `sidebar` should be able to discover relevant sidebar settings and visibility commands. Searching for `font size` should reveal the appropriate editor font-size setting if it exists.

Use the existing settings UI to determine the actual supported options and controls.

**Important:** Do not confuse application settings with executable commands. A setting changes a configuration value; a command performs an action. Both should be discoverable, but their execution behavior must remain distinct.

If some settings cannot safely be edited inline, allow the palette to navigate to the relevant settings section instead.

## 4. Add Zen Mode — `Ctrl + .`

Implement a proper Zen Mode inspired by VS Code.

When the user presses `Ctrl + .`, toggle Zen Mode on or off.

Use the project's existing keyboard shortcut system. Resolve conflicts explicitly and ensure the shortcut works reliably when the editor has focus.

### When Zen Mode is enabled

Hide the following components by default:

- Title bar.
- Status bar.
- Activity bar.
- Left sidebar / File Explorer.
- Right sidebar.
- Other nonessential interface elements that interfere with focused editing, where appropriate.

Preserve the editor content, active document, editing capabilities, and essential keyboard interactions.

Do not destroy or unmount state unnecessarily. Components should return to their previous state when Zen Mode is disabled.

### When Zen Mode is disabled

Restore the component visibility configuration that existed before entering Zen Mode.

For example, if the right sidebar was already hidden before entering Zen Mode, exiting Zen Mode must not unexpectedly show it.

If the user changes Zen Mode preferences, handle those changes predictably and consistently.

## 5. Add Individual Component Visibility Commands

Users must be able to hide and show individual UI components through the command palette, including when Zen Mode is disabled.

Provide commands such as:

- `View: Toggle Title Bar`
- `View: Toggle Status Bar`
- `View: Toggle Activity Bar`
- `View: Toggle Primary Sidebar`
- `View: Toggle Secondary Sidebar`
- `View: Enter Zen Mode`
- `View: Exit Zen Mode`
- `View: Toggle Zen Mode`

Use naming consistent with Lumina's existing terminology.

### Component requirements

**Title bar**
- Hide or restore the application title bar.
- Preserve essential window controls and provide a reliable way to restore the title bar.

**Status bar**
- Hide or restore the bottom status bar.
- Ensure editor status information and layout do not break.

**Activity bar**
- Hide or restore the activity bar.
- Ensure panel navigation remains accessible through available commands.

**Primary sidebar**
- Hide or restore the left sidebar.
- Preserve its current contents, expanded folders, scroll position, and state.

**Secondary sidebar**
- Hide or restore the right sidebar.
- Preserve its content and state.

**Editor meta directory**

Inspect `src/renderer/src/features/Editor/meta` to identify the actual components, responsibilities, and dependencies there.

Determine which components represent independent, user-controllable UI elements and integrate them into the same visibility system where appropriate.

Do not indiscriminately hide internal editor infrastructure or components that are required for correct editing.

### State requirements

- Use a centralized visibility model or extend the existing layout store.
- Avoid conflicting visibility state between individual panels and Zen Mode.
- Ensure every toggle command reflects the actual current state.
- Preserve existing component state when hidden.
- Update the layout without unnecessary full application re-renders.

## 6. Persist Settings in `setting.json`

Persist user preferences using Lumina's existing settings persistence mechanism and the existing `setting.json` file.

Do not create a second configuration file if one already serves this purpose.

Persist the relevant values, including:

- Zen Mode preferences.
- Default Zen Mode state, if configurable.
- Individual component visibility preferences.
- Other settings changed through the command palette.

Use the project's established naming conventions and schema. For example, the conceptual configuration could represent:

- `zenMode.enabled`
- `zenMode.hideTitleBar`
- `zenMode.hideStatusBar`
- `zenMode.hideActivityBar`
- `zenMode.hidePrimarySidebar`
- `zenMode.hideSecondarySidebar`

These are illustrative names. Adapt them to the existing configuration schema.

### Persistence requirements

- Load settings during application initialization.
- Apply persisted preferences before the interface reaches its final visible state where practical.
- Save changes through the existing settings service.
- Handle missing, malformed, and older configuration files gracefully.
- Provide sensible defaults for existing users.
- Preserve unrelated settings when updating individual values.
- Avoid excessive disk writes during rapid UI interactions.
- Ensure settings survive application restarts.

Do not write directly to `setting.json` from multiple unrelated components. Use the existing centralized persistence mechanism.

## 7. Implement `Alt + Click` Window Movement in Zen Mode

When Zen Mode is enabled, users should be able to move the application window by holding `Alt` and dragging with the mouse.

### Required behavior

- Holding `Alt` and dragging with the left mouse button moves the application window.
- Normal clicks and text selection continue to work when `Alt` is not pressed.
- Dragging text, selecting editor content, and interacting with controls must not accidentally move the window.
- Restrict window dragging to appropriate surfaces and prevent conflicts with editor input, text selection, buttons, and other interactive elements.
- Ensure the behavior works with Lumina's actual Electron window configuration.

Inspect the existing Electron main-process and renderer-process architecture.

Use the appropriate supported window-movement mechanism for the project's Electron version and platform. If a native window API or IPC bridge is required, implement it through the existing secure preload and IPC architecture.

Do not expose unrestricted Node.js or Electron APIs to the renderer.

If the platform requires a draggable CSS region, make it conditional on the `Alt` modifier and ensure interactive regions remain non-draggable.

Test the behavior on Windows and check for platform-specific limitations where relevant.

## 8. Keyboard Shortcut Management

Integrate the new shortcuts with Lumina's existing shortcut infrastructure.

- `Ctrl + Shift + P`: Open the command palette.
- `Ctrl + .`: Toggle Zen Mode.
- `Escape`: Close the palette and dismiss applicable transient UI.
- `Alt + Left Mouse Drag`: Move the window while Zen Mode is enabled.

Requirements:

- Prevent duplicate global and component-level shortcut handlers.
- Respect text inputs and modal interactions.
- Avoid interfering with existing editor shortcuts and Vim/Neovim modes, if applicable.
- Ensure shortcuts are not triggered twice because of event propagation.
- Document the shortcuts in the existing shortcut reference UI.

If an existing shortcut conflicts with a requested shortcut, inspect the conflict and implement a deliberate resolution rather than silently breaking existing functionality.

## 9. Performance, Accessibility, and Reliability

The implementation must be robust and production-ready.

- Preserve editor responsiveness.
- Avoid unnecessary component remounting.
- Maintain focus management and keyboard accessibility.
- Use appropriate ARIA roles and accessible labels.
- Ensure the command palette works with both mouse and keyboard.
- Prevent hidden panels from continuing to intercept pointer events.
- Ensure hidden panels do not leave empty layout gaps.
- Handle window resizing and maximization correctly.
- Keep persisted configuration consistent with the actual interface state.
- Preserve theme support and existing visual design.

## 10. Testing and Acceptance Criteria

Add or update tests for:

1. Opening and closing the command palette.
2. Searching and executing existing commands.
3. Discovering and changing every supported setting.
4. Synchronization between the settings page and palette.
5. Entering and exiting Zen Mode.
6. Restoring the exact previous panel visibility configuration.
7. Hiding and restoring each individual component.
8. Persisting and restoring visibility settings across application restarts.
9. Loading older or malformed settings safely.
10. `Ctrl + .` behavior with editor focus.
11. Shortcut conflicts and event propagation.
12. `Alt + Drag` window movement in Zen Mode.
13. Ensuring editor typing and text selection do not move the window.
14. Preserving editor state, tabs, scroll position, and expanded folders.
15. Ensuring no layout gaps or invisible click-blocking regions remain.

Run relevant unit tests, integration tests, type checks, and production builds. Manually verify Electron window movement and layout behavior where automated tests are insufficient.

## Definition of Done

The work is complete when:

- The command palette is a complete discovery and execution interface for Lumina's actual commands and supported settings.
- Settings can be searched and modified without manually navigating through every settings section.
- Zen Mode hides the configured UI components and restores them correctly.
- Individual UI components can be hidden or restored from the command palette.
- User preferences persist in `setting.json` through the existing settings infrastructure.
- `Alt + Click + Drag` moves the window in Zen Mode without breaking normal editor interactions.
- Existing Lumina functionality remains intact.

After implementation, provide a concise report of the architecture changes, files modified, tests executed, test results, and any remaining limitations.

Do not stop after adding the commands to the palette. Implement the actual behavior, persistence, and verification end to end.
