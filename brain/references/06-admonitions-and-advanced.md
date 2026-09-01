# Callouts & Advanced Markdown

Lumina provides rich admonition callouts, YAML metadata, footnotes, and custom markdown extensions.

---

## Callouts & Admonitions

Use blockquote notation with `[!TYPE]` headers to produce styled alert callout boxes:

### Note
```markdown
> [!NOTE]
> Notes highlight supplementary context and helpful observations.
```

### Tip
```markdown
> [!TIP]
> Use keyboard shortcuts to streamline your note-taking flow.
```

### Warning
```markdown
> [!WARNING]
> Destructive actions like deleting a note cannot be undone without backups.
```

### Important
```markdown
> [!IMPORTANT]
> Make sure to configure your API keys in Settings before querying AI features.
```

### Caution / Danger
```markdown
> [!CAUTION]
> Modifying raw JSON database files directly may cause synchronization conflicts.
```

---

## Front Matter (YAML Metadata)

At the very top of your document, you can include structured YAML front matter:

```yaml
---
title: Advanced Markdown Guide
author: Lumina Core Team
date: 2026-09-01
tags:
  - documentation
  - reference
  - guide
status: published
---
```

---

## Footnotes

Attach footnotes to statements using numeric or descriptive anchors:

```markdown
Lumina stores documents locally on your filesystem.[^local-first]

[^local-first]: Local-first architecture guarantees zero cloud lock-in and complete privacy.
```

---

## Emojis & Shortcodes

Lumina supports both direct Unicode emojis and GitHub-style shortcodes:

```markdown
🚀 :rocket: 
⭐ :star: 
💡 :bulb: 
🔥 :fire: 
🎉 :tada: 
✅ :white_check_mark:
```

---

## Escaping Characters

To display characters that Markdown normally interprets as markup, escape them with a backslash (`\`):

```markdown
\*This is literal asterisk text, not italic\*
\# This is not a heading
\[This is not a link\]
```
