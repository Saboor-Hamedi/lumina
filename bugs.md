Here is the complete package to transform your MindForge settings into that sleek, premium VS Code/Lumina aesthetic.

### 1. The Prompt for Your Agent
*Copy and paste this directly to your agent. It focuses purely on UI/UX architecture and styling logic.*

***

**Prompt: Refactor Settings UI to "Sleek Modal" Aesthetic**

**Context:**
Our current settings UI feels too much like a traditional desktop application window. We need to refactor it to match the "Sleek Modal" aesthetic seen in modern tools like VS Code or Lumina. The goal is a floating, borderless, highly organized interface that feels like a native extension of the editor, not a separate system dialog.

**Visual & Architectural Requirements:**

1.  **The "Floating Modal" Container:**
    *   **No OS Title Bar:** Remove the native Windows/macOS title bar completely. Implement a custom, sleek header strip (approx. 40-48px height) inside the modal content area.
    *   **Window Controls:** Place Minimize, Maximize, and Close icons in the top-right corner of this custom header. They should be minimal, monochrome icons that turn white/accent color on hover.
    *   **Borders & Shadows:** Remove all hard borders around the main window. Use a deep, soft drop shadow (`box-shadow: 0 20px 50px rgba(0,0,0,0.5)`) to create depth against the dimmed background.
    *   **Rounded Corners:** Apply a generous border-radius (8px–12px) to the entire modal container.

2.  **Sidebar Navigation (Left Pane):**
    *   **Layout:** Fixed width (approx. 220px), full height of the modal minus header.
    *   **Typography:** Use uppercase, tracked-out labels for section headers ("GENERAL", "FEATURES") in a muted gray (`#8b949e`).
    *   **Active State:** The active item ("Look & Feel") should have a distinct left-border accent (2px–3px wide) and a subtle background tint (e.g., `rgba(accent, 0.1)`). Text should be bright white/accent color.
    *   **Hover State:** Items should have a subtle background highlight on hover, but NO layout shift.
    *   **Icons:** Add small, consistent icons to the left of each menu item for faster visual scanning.

3.  **Content Area (Right Pane):**
    *   **Header:** Large, bold title ("APPEARANCE") at the top, followed by a subtle divider line.
    *   **Setting Rows:** Each setting (e.g., "Base Theme", "Font Size") should be a distinct block with generous vertical padding (16px–24px).
    *   **Controls Alignment:** All interactive elements (dropdowns, sliders, color pickers) must be right-aligned or consistently spaced from the description text.
    *   **Input Styling:**
        *   **Dropdowns:** Dark background, subtle border, rounded corners (4px–6px). No default browser arrow—use a custom SVG chevron.
        *   **Sliders:** Custom track (thin, dark gray) and thumb (accent color circle, slightly larger than track). Show current value in a small badge next to the slider.
        *   **Color Pickers:** Display as a rounded square swatch. Clicking it opens a popover picker.
    *   **Descriptions:** Helper text below titles should be muted gray and slightly smaller than the title.

4.  **Global Polish:**
    *   **Scrollbars:** Custom thin scrollbars (6px width) with transparent tracks and rounded thumbs. Hide scrollbars when not scrolling if possible.
    *   **Transitions:** All hover states and focus rings should have smooth transitions (`0.2s ease`).
    *   **Focus Rings:** Use a subtle accent-colored glow (`box-shadow: 0 0 0 2px rgba(accent, 0.3)`) instead of default browser outlines.

**Goal:**
Transform the settings from a "system dialog" into a "premium control panel." It should feel lightweight, fast, and visually integrated with the rest of the app's dark theme.

**Constraints:**
*   Do not change the underlying settings logic or data structure—only the rendering/UI layer.
*   Ensure the modal is draggable via the custom header bar.
*   Maintain accessibility: sufficient contrast for text, visible focus states for keyboard navigation.
*   Test with both light and dark themes to ensure the modal adapts correctly.

***

### 2. The CSS Blueprint (For Reference/Implementation)
*While you are using Egui (which uses Rust code for styling, not CSS), this CSS blueprint serves as the exact visual specification your agent needs to translate into Egui `Style` structs and painting logic.*

```css
/* === MODAL CONTAINER === */
.settings-modal {
  background: #1e1e2e; /* Deep slate background */
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.05);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 900px;
  height: 600px;
}

/* === CUSTOM HEADER === */
.modal-header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  -webkit-app-region: drag; /* Makes header draggable */
}

.window-controls {
  display: flex;
  gap: 12px;
  -webkit-app-region: no-drag;
}

.control-icon {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  opacity: 0.7;
  transition: opacity 0.2s;
}
.control-icon:hover { opacity: 1; }
.control-close { background: #ff5f56; }
.control-minimize { background: #ffbd2e; }
.control-maximize { background: #27c93f; }

/* === LAYOUT === */
.modal-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* === SIDEBAR === */
.sidebar {
  width: 220px;
  background: rgba(0, 0, 0, 0.1);
  padding: 20px 0;
  overflow-y: auto;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #8b949e;
  padding: 8px 20px;
  text-transform: uppercase;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 20px;
  color: #c9d1d9;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.nav-item.active {
  background: rgba(99, 102, 241, 0.1); /* Accent tint */
  color: #818cf8; /* Accent color */
  border-left-color: #818cf8;
  font-weight: 500;
}

/* === CONTENT AREA === */
.content {
  flex: 1;
  padding: 30px 40px;
  overflow-y: auto;
}

.content-title {
  font-size: 24px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 24px;
  letter-spacing: -0.02em;
}

.setting-block {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.setting-label {
  font-size: 14px;
  font-weight: 500;
  color: #e6edf3;
  margin-bottom: 6px;
}

.setting-desc {
  font-size: 12px;
  color: #8b949e;
  margin-bottom: 12px;
  line-height: 1.5;
}

/* === CONTROLS === */
.dropdown {
  background: #2d2d3f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 8px 12px;
  color: #fff;
  font-size: 13px;
  min-width: 200px;
  cursor: pointer;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-track {
  flex: 1;
  height: 4px;
  background: #3d3d50;
  border-radius: 2px;
  position: relative;
}

.slider-thumb {
  width: 16px;
  height: 16px;
  background: #f97316; /* Accent orange */
  border-radius: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  cursor: grab;
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.4);
}

.value-badge {
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
  color: #fff;
  min-width: 40px;
  text-align: center;
}

/* === SCROLLBARS === */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
```

### Key Implementation Notes for Egui
Since you are using Egui, your agent will need to translate these CSS concepts into Egui primitives:

1.  **Custom Header:** Use `egui::TopBottomPanel::top("header")` with `frame.inner_margin` set to create the 48px height. Draw window controls manually using `ui.add(Button::new(...))` with custom icons.
2.  **Sidebar Active State:** Use `ui.visuals().selection.bg_fill` with low alpha for the active background tint. Draw the left border accent using `ui.painter().line_segment()`.
3.  **Slider Thumb:** Egui's default slider is basic. You'll need to use `egui::Slider::new(...).custom_formatter(...)` and potentially override the painting logic to get the glowing thumb effect. Alternatively, use a third-party crate like `egui_extras` or custom paint callbacks.
4.  **Rounded Corners:** Set `visuals.window_rounding` to `12.0` globally for the modal window.
5.  **Drop Shadow:** Egui doesn't have native drop shadows for windows. You'll need to draw a semi-transparent black rectangle behind the modal window with a blur effect (if supported) or use a pre-rendered shadow texture.

This combination of prompt and CSS blueprint gives your agent everything needed to replicate that sleek, modern settings UI while respecting Egui's immediate-mode constraints.