# Tables & Task Lists

Tables and task lists provide structured formats for data presentation, checklists, and project roadmap tracking.

---

## Tables

Tables are created using pipes (`|`) for columns and hyphens (`-`) for separator rows.

```markdown
| Feature | Supported | Description |
|---------|:---------:|-------------|
| Wikilinks | Yes | Bidirectional cross-note links |
| Mermaid | Yes | Interactive diagram rendering |
| LaTeX Math | Yes | Inline and display KaTeX math |
| Tables | Yes | Live interactive table editor |
```

### Renders As:

| Feature | Supported | Description |
|---------|:---------:|-------------|
| Wikilinks | Yes | Bidirectional cross-note links |
| Mermaid | Yes | Interactive diagram rendering |
| LaTeX Math | Yes | Inline and display KaTeX math |
| Tables | Yes | Live interactive table editor |

---

## Column Alignment

Control alignment using colons (`:`) in the separator row:

- `:---` Left align
- `:---:` Center align
- `---:` Right align

```markdown
| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Items | Count | Price |
| Lumina Core | 1 | $0.00 |
| Cloud Sync | 3 | $12.50 |
```

---

## Formatting Inside Tables

You can format table cells with bold, italic, inline code, wikilinks, and external links:

```markdown
| Component | Status | Details |
|-----------|--------|---------|
| `useMark.js` | **Active** | Highlighting & Task Marks |
| `useQuote.js` | **Active** | Blockquote indentation |
| `useCallout.js` | **Active** | Admonitions & Callout cards |
| [[Architecture]] | *Reviewed* | System overview |
```

---

## Task Lists (Checklists)

Task lists allow interactive checking and unchecking:

```markdown
- [x] Complete modular hook extractions
- [x] Integrate Markdown Reference Guide into Documentation
- [ ] Implement table sorting
- [ ] Export note as PDF
  - [x] Generate print stylesheet
  - [ ] Add header/footer pagination
```

### Renders As:

- [x] Complete modular hook extractions
- [x] Integrate Markdown Reference Guide into Documentation
- [ ] Implement table sorting
- [ ] Export note as PDF
  - [x] Generate print stylesheet
  - [ ] Add header/footer pagination

### Smart Task Editing in Lumina

- **Toggle or convert (`Ctrl + Shift + X` / `⌘ + Shift + X`):** Toggles `- [ ]` ↔ `- [x]` on the current line or multi-line selection, and converts plain lines, bullets, or ordered items into tasks (preserving indentation and blockquote prefixes like `> - [ ]`).
- **Smart continuation & nested exit (`Enter`):** Pressing `Enter` on a task continues with a fresh unchecked `- [ ] `. Pressing `Enter` on an empty indented task outdents one level; pressing `Enter` on an empty root task exits the list cleanly.
- **Soft continuation (`Shift + Enter`):** Adds an aligned continuation line inside a task item without starting a new checkbox.
- **One-press clear (`Backspace`):** Pressing `Backspace` right after an empty `- [ ] ` outdents if nested or clears the entire checkbox marker in one keystroke.
