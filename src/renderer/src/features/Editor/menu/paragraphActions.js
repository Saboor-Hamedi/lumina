/**
 * paragraphActions.js
 * Handles block-level markdown formatting such as Headings (H1-H6), Lists, and Quotes.
 */
export const togglePrefix = (view, prefix) => {
  if (!view) return
  const { state, dispatch } = view
  
  const selection = state.selection.main
  const startLine = state.doc.lineAt(selection.from)
  
  // If the user's selection ends exactly at the start of a new line (due to selecting trailing whitespace/newlines)
  // we do not want to format that empty new line, so we step back by 1 character.
  let endPos = selection.to
  if (endPos > selection.from) {
    const endLineObj = state.doc.lineAt(endPos)
    if (endPos === endLineObj.from) endPos = Math.max(0, endPos - 1)
  }
  
  const endLine = state.doc.lineAt(endPos)
  
  const changes = []
  
  // Iterate from top to bottom (CodeMirror 6 handles relative mapping natively)
  for (let i = startLine.number; i <= endLine.number; i++) {
    const line = state.doc.line(i)
    const text = line.text
    
    // Match any existing block prefix (headings, lists, tasks, blockquotes)
    const match = text.match(/^(#{1,6}\s+|-\s+\[[ x]\]\s+|-\s+|\d+\.\s+|>\s+)/)
    
    const from = line.from
    let to = line.from
    
    if (match) {
      to = line.from + match[0].length
      // If it perfectly matches the requested prefix, just strip it (toggle off)
      if (match[0] === prefix) {
        changes.push({ from, to, insert: '' })
        continue
      }
    }
    
    // Replace old prefix (or nothing) with new prefix
    if (prefix !== '') {
      changes.push({ from, to, insert: prefix })
    } else if (match) {
      changes.push({ from, to, insert: '' })
    }
  }

  // Preserve selection by returning the cursor/selection to original bounds mapped roughly
  dispatch({ changes })
  view.focus()
}
