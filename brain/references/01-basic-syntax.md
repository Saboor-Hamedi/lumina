# Basic Markdown Syntax

Welcome to the fundamentals of Markdown. These are the core elements you'll use every single day for structuring documents, formatting text, creating lists, and embedding media.

---

## Headings

Headings are created using the hash `#` symbol. The number of hashes determines the heading level (H1 to H6).

```markdown
# Heading Level 1
## Heading Level 2
### Heading Level 3
#### Heading Level 4
##### Heading Level 5
###### Heading Level 6
```

### Alternative Style (Setext)

For Heading 1 and Heading 2, you can also use underline syntax:

```markdown
Heading Level 1
===============

Heading Level 2
---------------
```

> [!TIP]
> Heading Level 1 (`#`) is usually reserved for the document title. Most platforms use the first H1 as the page title automatically.

---

## Paragraphs & Line Breaks

Paragraphs are blocks of text separated by blank lines.

```markdown
This is a paragraph. It contains some text.
This is still the same paragraph because there's no blank line.

This is a new paragraph because there's a blank line between them.
```

For a soft line break without starting a new paragraph, add **two spaces** at the end of a line or use `<br>`:

```markdown
This line ends with two spaces.  
This is the next line in the same paragraph.
```

---

## Text Emphasis

Combine asterisks (`*`) or underscores (`_`) for italic, bold, and combined formatting:

```markdown
*This is italic* or _This is italic_
**This is bold** or __This is bold__
***This is bold and italic*** or ___This is bold and italic___
~~This is strikethrough~~
==This is highlighted==
```

---

## Lists

### Unordered Lists (Bullet Points)

Use `-`, `*`, or `+`:

```markdown
- Item 1
- Item 2
  - Nested subitem A
  - Nested subitem B
- Item 3
```

### Ordered Lists (Numbered)

Use numbers followed by a period:

```markdown
1. First step
2. Second step
   1. Sub-step A
   2. Sub-step B
3. Third step
```

> [!NOTE]
> Markdown automatically handles list numbering sequentially even if the raw numbers differ.

---

## Links

### Inline Links
```markdown
[Lumina Documentation](https://github.com/Saboor-Hamedi/lumina)
```

### Links with Tooltips
```markdown
[Visit Website](https://example.com "Hover preview title")
```

### Reference-Style Links
```markdown
[Click here for reference][ref-link]

[ref-link]: https://example.com "Optional Title"
```

### Internal / Relative Links
```markdown
[Architecture Guide](01-architecture.md)
[Code Reference](../references/02-code-and-syntax.md)
```

---

## Images

Images share a syntax similar to links, prefixed with an exclamation mark `!`:

```markdown
![Lumina Logo](./assets/logo.png)
![Screenshot](https://example.com/screenshot.png "Dashboard Overview")
```

### Resized Images
Use standard HTML tags when you need custom width or height constraints:

```html
<img src="./assets/logo.png" width="400" alt="Lumina Logo" />
```

---

## Blockquotes

Blockquotes are formatted with the greater-than `>` character:

```markdown
> "Simplicity is prerequisite for reliability."
> — Edsger W. Dijkstra

> Nested blockquote level 1
>> Nested blockquote level 2
>>> Nested blockquote level 3
```

---

## Horizontal Rules

Three or more dashes (`---`), asterisks (`***`), or underscores (`___`) on their own line create a horizontal divider:

```markdown
---
```
