🎯 Prompt for Agent: Refactor Export Modal to "Sleek Studio" Aesthetic
Context:
The current Export modal feels functional but utilitarian. It lacks the visual polish and cohesive design language of Lumina's main interface. We need to transform it from a "file saver dialog" into a premium document publishing studio that feels like a natural extension of the editor.
Current Pain Points:
Toggle Switch Feels Cheap: The "One file / Separate files" toggle looks like a settings switch, not a primary workflow decision.
Format Buttons Are Hard to Scan: Small icon+text buttons don't convey the value of each format (e.g., PDF vs Word). Users have to guess or hover.
Preview Feels Disconnected: The preview pane (when visible) doesn't clearly link to the selected format. It shows a PDF view even when Word might be selected.
Success State Is Abrupt: Just showing a file path isn't helpful. Users want to open or verify their export immediately.
✨ Required Design Changes

1. Replace Toggle with "Mode Cards" (Top Section)
   Remove the small toggle switch.
   Add two large, side-by-side cards at the very top of the modal:
   Card A: "Merge into One"
   Icon: Layers or Stack
   Title: "Single Document"
   Subtitle: "Combine all notes into one seamless file."
   Card B: "Export Individually"
   Icon: FolderOpen or Files
   Title: "Separate Files"
   Subtitle: "Save each note as its own file in a folder."
   Interaction: Clicking a card highlights it with a thick accent-colored border (2px) and subtle background tint (rgba(accent, 0.08)). The other card dims slightly.
   Why: Makes the core decision feel intentional and premium, not like flipping a light switch.
2. Transform Format Selection into "Rich Format Cards" (Middle Section)
   Replace the row of small buttons with a grid of selectable cards (2 columns x 3 rows, or vertical list if space is tight).
   Each Card Must Include:
   Large Icon: Themed to the format (e.g., red PDF icon, blue Word icon, green Markdown icon). Use Lucide or Phosphor icons with consistent stroke weight (1.5px).
   Title: Bold, 14px (e.g., "PDF Document", "Word (.docx)").
   Description: Muted text, 12px (e.g., "Print-ready A4 with TOC & diagrams."). Keep your existing descriptions—they’re perfect!
   Badge (Optional): If a format is only available for one mode (e.g., "Markdown" only for "Separate files"), show a tiny badge: "Single Only" or "Batch Only".
   Selection State: When clicked, the card gets:
   Accent-colored border (2px solid var(--accent-color))
   Subtle background tint (rgba(var(--accent-rgb), 0.06))
   Smooth transition (0.2s ease)
   Hover State: Slight brightness increase + cursor pointer. No layout shift.
   Why: Users can instantly understand what they’re exporting and why they’d choose it.
3. Integrate Preview Pane Dynamically (Right Panel)
   Keep the split-view layout (Left: Format Selection | Right: Preview).
   Dynamic Updates: When a format card is selected, the preview must update to show a mock-up of that specific format:
   PDF: Show a print-ready page with margins, headers, and a generated Table of Contents (if "Merge" is active).
   Word: Show a .docx-style layout with styled headings and embedded images.
   HTML: Show a browser-like viewport with responsive styling.
   Markdown/Text: Show raw source with syntax highlighting.
   TOC Visibility: If "Merge into One" is selected, always show the generated Table of Contents in the preview. This confirms the merge worked correctly.
   Metadata Toggle: Add a small checkbox below the preview: [ ] Include Metadata (Date, Tags, Links). Let users toggle it on/off to see the difference live.
   Why: Eliminates guesswork. Users see exactly what they’ll get before exporting.
4. Elevate the Success State (Post-Export)
   Replace the simple "Combined 14 notes" message with a celebratory success panel:
   Large animated checkmark icon (green/accent color) at the top.
   Clear headline: "Export Complete!"
   Details: "Successfully merged 14 notes into 'Combined Export.pdf'"
   File path shown in a subtle, copyable field (with a Copy icon button).
   Action Buttons (Below Success Message):
   [ Open File ] → Opens the exported file in the default app.
   [ Open Folder ] → Reveals the file in Explorer/Finder.
   [ Export Again ] → Resets the modal to start a new export.
   Why: Users rarely just want to "export again." They want to verify or use the result immediately.
   Global Styling Rules (Lumina "Sleek" Standard)
   Modal Container:
   Background: var(--bg-modal) (slightly lighter than editor bg)
   Border: 1px solid rgba(255,255,255,0.06)
   Border Radius: 12px
   Shadow: 0 20px 50px rgba(0,0,0,0.4)
   Padding: 24px internal, 0 external (no OS title bar—use custom header)
   Typography:
   Headings: Inter, 16px, bold, var(--text-primary)
   Body/Descriptions: Inter, 13px, regular, var(--text-secondary)
   Line Height: 1.6 (match editor)
   Interactive Elements:
   All clickable items (cards, buttons) must have cursor: pointer and smooth hover transitions (0.15s ease).
   Focus rings: 2px solid var(--accent-color) with outline-offset: 2px for keyboard navigation.
   Disabled state: Opacity 0.4, no pointer events.
   Footer Actions:
   "Cancel": Ghost button (text only, muted color).
   "Export": Primary CTA — solid accent color background, white text, rounded corners (6px), padding 10px 20px.
   Disable Logic: If no format is selected OR no notes are chosen, disable the Export button and show tooltip: "Select a format first".
   ✅ Goal
   Transform the Export modal from a "utility dialog" into a confident, polished publishing experience. Every element should feel intentional, connected, and aligned with Lumina’s premium identity. Users should feel excited to export—not just resigned to it.
