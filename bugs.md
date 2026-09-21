1. Sidebar Organization: Reduce Cognitive Load
Currently, the sidebar has too many dropdowns and repeated headers. We need to flatten the hierarchy.
Current Structure:
Geometric Shapes (Header)
Instruction text
Theme Color (Dropdown + Label)
Color Swatches
Quick Insert Shape (Dropdown + Label)
Shape Category (Dropdown + Label)
Search Bar
Shape Grid
Proposed "Clean" Structure:
Section
UI Element Change
Why?
Top Bar
Keep Canvas Studio + 4 cards badge. Add a subtle divider below.
Establishes context immediately.
Tabs
Shapes Wires Layout Export. Make active tab background slightly distinct (e.g., soft pink fill).
Clear navigation state.
Theme Color
Remove the "Default color" label. Just show "Theme Color" as the section header. The swatches are the selector.
Removes redundant text. Visual > Verbal.
Quick Insert
Merge with Category. Don't have two dropdowns. Have one "Insert Shape" dropdown that filters the grid below, OR just keep the grid visible and use the search bar for specific shapes.
Two dropdowns side-by-side or stacked feels like a form, not a creative tool.
Search
Move Search to the top of the shape list, right under the tabs.
Users search before they browse.
Shape Grid
Remove "Geometric Shapes" header if it's the only category visible. If there are multiple categories, use a sticky sub-header.
Saves vertical space.
2. Text Refinement: Aligning with "Human" Theme
The current text is functional but dry. Let's make it inviting and precise.
"Double-click to type..." → "Double-click to edit" or just "Type here..."
Why: "To type" sounds like a command. "To edit" implies ownership. Or simply "Type here" is faster to read.
"Click or drag directly into your diagram" → "Drag to add"
Why: The original is a full sentence instruction. In a pro tool, users know how to drag. Shorten it to a micro-copy label.
"Choose shape to insert..." → "Select a shape"
Why: "Choose... to insert" is verbose. "Select a shape" is standard UI pattern language.
"Search 22 shapes..." → "Search shapes..."
Why: The number "22" changes dynamically and adds visual noise. Just "Search shapes" is timeless.
"Default Accent" → "Accent"
Why: "Default" implies there's a "Custom" option that might be confusing. "Accent" describes what the color does.
3. Visual Hierarchy & Spacing Fixes
Color Swatches: They look a bit small and cramped.
Fix: Increase size slightly (e.g., 24px diameter). Add a 2px white border (in dark mode) or subtle shadow (in light mode) to the selected color to make the active state unmistakable without needing a checkmark.
Dropdowns: The "Theme Color", "Quick Insert", and "Shape Category" dropdowns all look identical.
Fix: Differentiate them.
Theme Color: Should look like a color picker trigger (maybe show the current color inside the button).
Quick Insert/Category: Standard dropdowns.
Section Spacing: The gap between "Theme Color" and "Quick Insert" is tight.
Fix: Add 16px or 20px margin-bottom to section headers to create breathing room between logical groups.
4. The "Spatial Navigator" (Bottom Right)
Current: Spatial Navigator 4 nodes
Critique: "Spatial Navigator" sounds very technical/engineering-heavy.
Suggestion: Rename to "Overview" or "Minimap".
Text: Change "4 nodes" to just "4 items" or hide the count unless it's >10. The visual map is enough.
5. Implementation Checklist for You
Consolidate Dropdowns: Merge "Quick Insert" and "Category" logic. One control is better than two.
Micro-copy Audit: Apply the shorter text suggestions above.
Search Placement: Move search bar above the shape grid.
Active States: Ensure the selected color swatch and selected shape tool have a clear, high-contrast active state (ring or border).
Typography: Ensure section headers ("Theme Color", "Shape Category") use a slightly smaller font size (e.g., 11px uppercase tracking) compared to the main content to establish hierarchy.