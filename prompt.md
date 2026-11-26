Prompt for your agent:

"Please refine the sidebar file explorer (src/renderer/src/features/Sidebar/ or equivalent) to transform its cramped, uneven layout into a beautifully aligned, professional, and readable IDE-style file tree. Implement the following structural and style polish:

1. Proper Indentation & Hierarchical Alignment:

Standardize nested alignment. Every nested note (like the top 4 Markdown files) and every sub-item under folders must indent precisely: folders should have a consistent horizontal gap, and expand/collapse icons (> / v) must align perfectly.

Render subtle vertical "hierarchy lines" connecting nested items back to their parent folders to make multi-level navigation readable at a glance.

Treat loose, root-level non-folder files (like the loose files currently at the bottom) with the exact same margins and alignment as high-level folder text, ensuring they have consistent padding and do not visually 'hug' the edge.

2. Typos & Text Overflow Rules (Generous & Natural):

Use text-overflow: ellipsis; white-space: nowrap; overflow: hidden; across all titles so truncated files do not get cut off abruptly (e.g., 'Atomic Habits (EXP) A...' to a soft ellipsis).

For loose documents or files with extensions, show the fully natural or neatly truncated title, with an optional smaller subtext on hover (or inline if space allows, like .md or .pdf in a gentle opacity-40 font).

Add custom tooltips on hover for any list item that goes past the sidebar width so the user can easily see its full name.

3. Restructuring Visual Noise & Badges:

Tame the high-contrast, multicolored circular badges/tags by adopting subtle, muted background tags. Ensure file type indicators (like PDF tags, database indicators, and Markdown/Mermaid badges) use soft, translucent fills (bg-[opacity 10%] of the theme colors) with smaller, elegant icons rather than busy, circular shapes.

For numerical counts (like folder sub-item counts), use a tiny, desaturated, medium-opacity font (e.g., var(--text-muted)) pushed to the far right, only visible when natural and uncrowded. Hide non-critical counts or badges on un-hovered rows if needed to save space.

Slightly increase item list spacing (e.g., py-[3px] px-[8px]) to give folders and text breathing room while maintaining a compact overall tree layout.

4. Better States and Interactions:

Align active states: active high-level and sub-level rows must highlight exactly with soft rounded corners (rounded-md, similar to other list selectors across Lumina), retaining their proper icon color without overcrowding.

Implement subtle transition states (transition-colors duration-150) for hover, focus, and active row interactions.

Ensure expand/collapse indicators gracefully rotate 90 degrees (transition-transform duration-100) rather than shifting the layout when directories open or close."
