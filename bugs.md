

**Fix Lumina Sidebar Scrollbar Clipping**

In Lumina's file explorer sidebar, the vertical scrollbar is partially hidden because the sidebar is resizable, similar to VS Code. The resize boundary or drag handle appears to overlap the scrollbar area.

**Requirements:**

1. Keep the sidebar resizable, with the existing VS Code-like drag-to-resize behavior.
2. Ensure the vertical scrollbar is fully visible and accessible when scrolling the file and folder tree.
3. Separate the scrollbar's layout area from the sidebar resize handle/hitbox. They must not overlap.
4. Preserve the current UI design, spacing, colors, and folder-tree layout.
5. Ensure the fix works at different sidebar widths and window sizes.
6. Inspect `overflow`, `width`, `padding`, `position`, `z-index`, and resize-handle positioning before making changes.

**Important:** Do not remove the resize functionality or simply hide the scrollbar. Identify the actual cause of the overlap and fix it at the layout/CSS level.

Verify that the scrollbar remains visible and usable while dragging the sidebar to resize it, and test both narrow and wide sidebar configurations.
