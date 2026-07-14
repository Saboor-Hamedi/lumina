# Color Modal

## Overview

The **ColorModal** is a general-purpose color picker used in the Settings modal for customizing accent colors, caret colors, and other theme-related CSS custom properties. It provides a curated palette, manual hex input, and live preview via CSS variables.

**Path:** `src/renderer/src/features/Overlays/ColorModal.jsx` (150 lines)

---

## Component API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | boolean | — | Controls visibility |
| `onClose` | function | — | Called when modal closes |
| `initialColor` | string | `'#40bafa'` | Starting hex color |
| `defaultColor` | string | `'#40bafa'` | Fallback if no initial color |
| `onSelect` | function | — | Called with selected hex on Done |
| `previewProperty` | string | `null` | CSS custom property for live preview (e.g. `--caret-color`) |
| `title` | string | `'Select Color'` | Modal header title |

---

## UI Layout

1. **Modal Header** — Draggable header with title and close button (via `ModalHeader` component)
2. **Curated Palette** — 12-color preset grid (6 columns, 2 rows), selected color shows a checkmark overlay
3. **Hex Input** — Prefixed `#` input field with validation (strips non-hex chars), max 6 characters, placeholder `40BAFA`
4. **Done Button** — Primary action button, calls `onSelect` with the current color and closes

---

## Key Behaviors

- **Live Preview**: When `previewProperty` is set (e.g. `--caret-color`), selecting a color immediately updates the CSS custom property on `document.documentElement`, giving instant visual feedback
- **Draggable**: Uses `useDraggableModal` hook for repositioning
- **Hex Validation**: Input strips all non-hex characters; only valid hex values (3 or 6 chars) trigger the live preview
- **Click-Outside-to-Close**: Clicking the overlay backdrop calls `onClose`
- **Escape Key**: Closes via `useKeyboardShortcuts`
- **Cancellation**: On cancel/close, if a `previewProperty` was being modified, the original color is restored

---

## Preset Palette

The 12 preset colors defined in `PRESET_PALETTE`:

```
#40bafa  #3b82f6  #6366f1  #8b5cf6  #ec4899  #f43f5e
#f97316  #f59e0b  #10b981  #14b8a6  #06b6d4  #ffffff
```

---

## Integration

Called from `SettingsModal.jsx:55` for caret color and accent color customization:

```jsx
<ColorModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  initialColor={displayColor}
  defaultColor={defaultColor}
  onSelect={onColorChange}
  previewProperty={previewProperty}
  title={title}
/>
```

The parent component manages the color display swatch and passes relevant props down.

---

## Dependencies

- `react` / `react-dom` (portal rendering)
- `lucide-react` — `Check` icon
- `useKeyboardShortcuts` — Escape key handling
- `useDraggableModal` — Drag-to-reposition behavior
- `ModalHeader` — Reusable modal header
- `ColorModal.css` — Component styles
