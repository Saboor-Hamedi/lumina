# Lumina UI Refinement — Implement the Approved Premium Knowledge Workspace Layout

## Objective

Refine Lumina's existing UI to match the approved visual reference: `lumina_knowledge_workspace_ui.png`.

The goal is to make Lumina feel like a **premium, lightweight, modern AI knowledge workspace**, rather than a traditional code editor.

Use the reference image as the visual target. Preserve Lumina's existing identity, themes, accent-color customization, functionality, and performance.

This is a UI refinement, not a redesign of the application's architecture or feature set.

## 1. Title Bar

Preserve Lumina's existing title bar and refine its visual proportions to match the reference.

- Keep the Lumina logo and application name on the left.
- Keep the existing search or command entry point near the center.
- Keep the existing profile and native window controls on the right.
- Use a clean, compact layout with subtle separators.
- Preserve existing window dragging, minimizing, maximizing, and closing behavior.

Do not remove the profile or replace existing functionality.

## 2. Activity Bar

Preserve the existing vertical activity bar on the far left.

- Keep all existing navigation items and their functionality.
- Use consistent icon sizes, alignment, and spacing.
- Keep the active item clearly identifiable with a restrained accent indicator.
- Avoid heavy backgrounds, oversized icons, and unnecessary borders.

Do not remove, rename, or reorder existing navigation features without a functional reason.

## 3. File Explorer Sidebar

Preserve the existing file explorer and its ability to handle thousands of files efficiently.

Match the reference's clean, compact hierarchy:

- Keep the file search field at the top.
- Preserve folder expansion and collapse behavior.
- Use consistent indentation and compact row heights.
- Keep folder and file icons aligned.
- Use subtle hover states and a clear selected-item indicator.
- Keep secondary actions visually restrained.
- Preserve existing sorting, filtering, selection, drag-and-drop, and context-menu functionality.

Do not reduce the application's file-handling capabilities or compromise its performance to achieve the visual result.

## 4. Editor Tabs — Remove the Persistent Toolbar Row

This is a key requirement.

The approved reference has a clean tab strip without a permanently visible formatting toolbar directly underneath it.

- Preserve the existing editor tab strip and tab-management functionality.
- Remove the persistent full-width toolbar row immediately below the tabs, as shown in the approved reference.
- Do not remove the functionality provided by that toolbar.
- Move appropriate formatting actions into contextual controls, existing menus, keyboard shortcuts, or another suitable on-demand interface.
- Where useful, reveal formatting controls when the user selects content or enters the relevant editing context.
- Ensure all existing editor operations remain accessible.

Do not replace the removed toolbar with another permanent row of buttons.

## 5. Main Editor and Content Canvas

Make the editor the visual focus of the application.

- Use the space freed by the toolbar to give the document more room.
- Preserve existing Markdown editing, rendering, preview, and document interaction behavior.
- Refine the spacing and typography hierarchy between document titles, headings, paragraphs, lists, and metadata.
- Keep content readable and visually structured.
- Use subtle separators only where they improve hierarchy.
- Avoid unnecessary containers and excessive visual decoration.
- Preserve all existing editing capabilities and keyboard shortcuts.

The objective is a clean, comfortable knowledge-writing experience, not a conventional code-editor appearance.

## 6. Right Sidebar

Preserve the existing right sidebar and its functionality.

The reference shows a compact panel with three main sections:

- Backlinks
- Outline
- Details

Map these to Lumina's actual existing tabs and functionality. Do not invent replacements for existing features.

Requirements:

- Keep the tab strip compact and clearly readable.
- Use a subtle indicator for the active tab.
- Preserve the existing content and interactions within each tab.
- Avoid heavy borders and unnecessary visual separation.
- Keep the panel width adjustable if the existing layout supports resizing.
- Preserve the existing AI Agent experience.

## 7. AI Agent and Empty Workspace

Lumina is an AI agent, not merely a Markdown editor.

When all document tabs are closed, preserve the existing behavior in which the Lumina Agent is presented to the user.

The welcome experience should feel like a natural part of the workspace.

- Keep the AI entry point immediately accessible.
- Present a clean welcome message and a clear input area.
- Make relevant AI actions easy to discover without displaying excessive controls.
- Preserve existing conversation history, file mentions, context selection, and agent capabilities.
- Ensure the empty-workspace state feels intentional rather than like an empty editor.

When a document is open, preserve the existing right-sidebar AI functionality and context-aware interactions.

## 8. Remove the Status Bar

The approved reference does not display a bottom status bar.

Remove the visible status bar from the layout if it is part of the current UI.

Before doing so, inspect its existing functionality. Preserve important information and operations through appropriate existing interfaces or contextual displays rather than deleting functionality.

Ensure the editor and other panels correctly occupy the space previously used by the status bar.

## 9. Visual Design Principles

Follow the approved reference closely:

- Lightweight, refined visual proportions.
- Compact but readable controls.
- Clear visual hierarchy.
- Subtle separators rather than unnecessary borders.
- Consistent icon alignment and sizing.
- Restrained use of backgrounds and selected states.
- Content-focused layout.
- Professional typography.
- Smooth, unobtrusive interaction states.

Do not change Lumina's theme system, its existing 69 themes, or its accent-color customization system. The reference is about layout and visual weight, not imposing a new color scheme.

Do not add gradients, excessive rounded cards, decorative effects, or additional panels that are absent from the approved design.

## 10. Implementation Requirements

Before making changes:

1. Inspect the current application layout and component hierarchy.
2. Identify the title bar, activity bar, file explorer, editor tabs, toolbar, editor content, right sidebar, and status bar.
3. Identify which existing components and styles already match the reference.
4. Reuse existing components and design tokens wherever possible.
5. Modify only the components and styles necessary to achieve the approved layout.

Avoid rewriting working systems, duplicating components, introducing unnecessary dependencies, or making broad CSS changes that affect unrelated interfaces.

Preserve the existing architecture and performance characteristics.

## 11. Verification

Verify the implementation at different window sizes and with:

- Multiple open editor tabs.
- All tabs closed and the AI Agent welcome experience visible.
- Large file trees and deeply nested folders.
- The right sidebar's existing tabs.
- Editor writing, selection, formatting, and preview functionality.
- Theme and accent-color switching.
- Window resizing, maximizing, and restoring.

Ensure there are no layout gaps, overlapping controls, broken scrolling regions, or inaccessible editor actions.

## Definition of Done

The result should closely resemble the approved reference while retaining Lumina's existing capabilities.

The title bar, activity bar, file explorer, editor tabs, main content canvas, right sidebar, and AI Agent must remain functional.

The persistent toolbar row beneath the editor tabs must be removed without losing its functionality, and the bottom status bar must no longer be visible.

Implement the actual changes, run relevant tests, and report the files changed and any remaining limitations.

**Scope restriction:** Do not redesign unrelated screens, change the theme system, modify the application's core architecture, or introduce additional features beyond what is required to implement this approved UI layout.
