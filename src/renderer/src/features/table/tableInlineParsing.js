/**
 * Table Inline Parsing Utility
 * Parses inline Markdown tokens (bold, italics, code, wikilinks, tags, mentions) inside table cells.
 */

export function parseCellInline(raw) {
  const tokens = []
  let textBuf = ''
  let i = 0
  const flushText = () => {
    if (textBuf.length) {
      tokens.push({ type: 'text', text: textBuf })
      textBuf = ''
    }
  }
  while (i < raw.length) {
    // CommonMark backslash escape — the following char is emitted
    // literally and can't open/close a mark. Pair is consumed.
    if (raw[i] === '\\' && i + 1 < raw.length && /[!-/:-@[-`{-~]/.test(raw[i + 1])) {
      textBuf += raw[i + 1]
      i += 2
      continue
    }
    const match = matchCellMarkAt(raw, i)
    if (match) {
      flushText()
      tokens.push(match.token)
      i = match.end
      continue
    }
    textBuf += raw[i]
    i++
  }
  flushText()
  return tokens
}
export function matchCellMarkAt(raw, from) {
  const rest = raw.slice(from)
  // Bold with `**` or `__` — greedy on the outside, lazy on the
  // content so we catch the nearest closer.
  let m = rest.match(/^\*\*([\s\S]+?)\*\*/)
  if (m) {
    return {
      token: { type: 'strong', delim: '**', children: parseCellInline(m[1]) },
      end: from + m[0].length
    }
  }
  m = rest.match(/^__([\s\S]+?)__/)
  if (m) {
    return {
      token: { type: 'strong', delim: '__', children: parseCellInline(m[1]) },
      end: from + m[0].length
    }
  }
  // Inline Code
  m = rest.match(/^`([^`\n]+)`/)
  if (m) {
    return {
      token: { type: 'code', text: m[1] },
      end: from + m[0].length
    }
  }
  // Strikethrough.
  m = rest.match(/^~~([\s\S]+?)~~/)
  if (m) {
    return {
      token: { type: 'strike', children: parseCellInline(m[1]) },
      end: from + m[0].length
    }
  }
  // Wikilink `[[text]]`.
  m = rest.match(/^\[\[([^\]]+)\]\]/)
  if (m) {
    return {
      token: {
        type: 'wikilink',
        textChildren: parseCellInline(m[1]),
        url: m[1]
      },
      end: from + m[0].length
    }
  }
  // Image `![alt](url)`
  m = rest.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
  if (m) {
    return {
      token: {
        type: 'image',
        alt: m[1],
        url: m[2],
        raw: m[0]
      },
      end: from + m[0].length
    }
  }
  // Link `[text](url)`. Reject empty text / url via `+` quantifiers.
  // `]` and `)` can't appear unescaped inside their respective fields.
  m = rest.match(/^\[([^\]\n]+)\]\(([^)]+)\)/)
  if (m) {
    return {
      token: {
        type: 'link',
        textChildren: parseCellInline(m[1]),
        url: m[2]
      },
      end: from + m[0].length
    }
  }
  // Italic with `*`. Reject a leading `*` (that would have matched
  // the bold regex above; this guards against pathological inputs
  // like `***` that slip through).
  m = rest.match(/^\*([^*\n]+?)\*/)
  if (m) {
    return {
      token: { type: 'em', delim: '*', children: parseCellInline(m[1]) },
      end: from + m[0].length
    }
  }
  // Tags and Mentions
  const prevChar = from > 0 ? raw[from - 1] : ''
  if (!/\w/.test(prevChar)) {
    m = rest.match(/^#([\w-]+)/)
    if (m) {
      return {
        token: { type: 'tag', text: m[1] },
        end: from + m[0].length
      }
    }
    m = rest.match(/^@([\w-]+)/)
    if (m) {
      return {
        token: { type: 'mention', text: m[1] },
        end: from + m[0].length
      }
    }
  }

  // Italic with `_`. Avoid triggering inside words like `snake_case`
  // by requiring the char before `_` to not be a word character.
  // (Fallback to true when `_` is at start-of-input.)
  const prev = from > 0 ? raw[from - 1] : ''
  if (!/\w/.test(prev)) {
    m = rest.match(/^_([^_\n]+?)_/)
    if (m) {
      return {
        token: { type: 'em', delim: '_', children: parseCellInline(m[1]) },
        end: from + m[0].length
      }
    }
  }
  return null
}
// Build the decorated DOM for a cell's source. The parser strips
// CommonMark backslash escapes inline (so `\*` emits a literal `*`
// text node); the fragment's `textContent` equals the escape-stripped
// raw. The cell's input handler reads `textContent` to update
// `dataset.raw` — round-trip is one-way for escapes (same as the
// pre-markdown-in-cells behavior), but fully preserves every inline
// mark delimiter because those live in `display: none` spans inside
// the DOM rather than being derived on serialize.
