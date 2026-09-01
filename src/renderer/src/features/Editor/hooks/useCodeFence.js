/**
 * useCodeFence.js
 * 
 * Modular helper for Markdown Fenced Code Blocks (```lang ... ```):
 * Handles auto-closing unclosed code fences and expanding inline single-line code fences on Enter.
 */

/**
 * Handles Enter key on fenced code blocks:
 * 1. Auto-closes unclosed code fences: ```js + Enter -> creates \n\n``` and positions caret inside.
 * 2. Auto-expands single-line code blocks: ```console.log('hi')``` + Enter -> expands to multi-line code block.
 * Returns true if handled, false otherwise.
 */
export function handleCodeFenceEnter(view) {
  const state = view.state
  const pos = state.selection.main.head
  const line = state.doc.lineAt(pos)

  // 1. Auto-close unclosed fenced code blocks
  const openingFenceMatch = line.text.match(/^```[a-zA-Z0-9+#-]*\s*$/)
  if (openingFenceMatch && pos === line.to) {
    let isClosed = false
    for (let i = line.number + 1; i <= state.doc.lines; i++) {
      if (state.doc.line(i).text.trim().startsWith('```')) {
        isClosed = true
        break
      }
    }
    if (!isClosed) {
      view.dispatch({
        changes: { from: line.to, insert: '\n\n```' },
        selection: { anchor: line.to + 1 }
      })
      return true
    }
  }

  // 2. Auto-expand single-line fenced code blocks
  const singleLineCodeMatch = line.text.match(/^```(.*?)```\s*$/)
  if (singleLineCodeMatch) {
    const inside = singleLineCodeMatch[1]
    const relativePos = pos - (line.from + 3)

    let beforeCursor = ''
    let afterCursor = ''

    if (relativePos <= 0) {
      afterCursor = inside
    } else if (relativePos >= inside.length) {
      beforeCursor = inside
    } else {
      beforeCursor = inside.slice(0, relativePos)
      afterCursor = inside.slice(relativePos)
    }

    let lang = ''
    let contentBefore = ''

    const langMatch = beforeCursor.match(/^([a-zA-Z0-9+#-]+)(?:\s+|$)/)
    if (langMatch) {
      lang = langMatch[1]
      contentBefore = beforeCursor.slice(langMatch[0].length)
    } else {
      contentBefore = beforeCursor
    }

    let insertText = `\`\`\`${lang}\n`
    let newCursorPos = line.from + insertText.length

    if (
      contentBefore.trim() ||
      (!contentBefore.trim() && beforeCursor.endsWith(' ') && !langMatch)
    ) {
      insertText += `${contentBefore}\n`
      newCursorPos = line.from + insertText.length
    }

    insertText += `${afterCursor}\n\`\`\``

    if (relativePos >= inside.length) {
      insertText += '\n'
      newCursorPos = line.from + insertText.length
    }

    view.dispatch({
      changes: {
        from: line.from,
        to: line.to,
        insert: insertText
      },
      selection: { anchor: newCursorPos }
    })
    return true
  }

  return false
}
