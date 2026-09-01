# Best Practices & Markdown Cheat Sheet

Writing clean, readable Markdown ensures your knowledge base remains structured and easily maintainable.

---

## Best Practices

### 1. Document Structure & Heading Hierarchy
- Use a single **Heading 1** (`#`) for the document title.
- Organize subtopics under **Heading 2** (`##`) and granular sub-sections under **Heading 3** (`###`).
- Avoid skipping levels (e.g. going directly from H1 to H4).

### 2. Spacing Around Blocks
Always include an empty line before and after code blocks, tables, lists, and headings:

```markdown
<!-- Good -->
## Section Title

Here is the paragraph.

- List item 1
- List item 2

<!-- Bad -->
## Section Title
Here is the paragraph.
- List item 1
- List item 2
```

### 3. Meaningful Link Names
Use descriptive anchor text instead of generic words:
- **Good**: [Read the Lumina Architecture Guide](01-architecture.md)
- **Bad**: [Click here](01-architecture.md)

---

## Quick Reference Cheat Sheet

| Syntax | Description | Example |
|--------|-------------|---------|
| `# Heading` | Heading Level 1 | `# Title` |
| `**text**` | Bold text | `**bold**` |
| `*text*` | Italic text | `*italic*` |
| `~~text~~` | Strikethrough | `~~removed~~` |
| `==text==` | Highlight | `==important==` |
| `[text](url)` | Hyperlink | `[Google](https://google.com)` |
| `![alt](url)` | Image | `![logo](logo.png)` |
| `` `code` `` | Inline code | `` `const x = 1;` `` |
| `> text` | Blockquote | `> Quotation` |
| `- [ ] task` | Unchecked task | `- [ ] Todo item` |
| `- [x] task` | Completed task | `- [x] Finished` |
| `\| a \| b \|` | Table | `\| Header \| Value \|` |
| `---` | Horizontal Rule | `---` |
