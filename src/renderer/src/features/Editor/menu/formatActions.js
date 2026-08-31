/**
 * formatActions.js
 * Handles inline markdown formatting such as Bold, Italic, Strikethrough, Code, and Links.
 */
export const toggleMark = (view, prefix, suffix = prefix) => {
  if (!view) return
  const { state, dispatch } = view
  const selection = state.selection.main
  
  let { from, to } = selection
  let text = state.sliceDoc(from, to)

  // Trim trailing whitespace (like newlines) from the selection bounds so wrappers don't fall on the next line
  const trailingMatch = text.match(/\s+$/)
  if (trailingMatch) to -= trailingMatch[0].length
  
  // Trim leading whitespace
  const leadingMatch = text.match(/^\s+/)
  if (leadingMatch) from += leadingMatch[0].length
  
  // Re-fetch the precise trimmed text
  text = state.sliceDoc(from, to)

  // 1. Check if the selection itself includes the wrappers (e.g., user highlighted "**bold**")
  const isWrappedInside = text.length >= prefix.length + suffix.length && 
                          text.startsWith(prefix) && 
                          text.endsWith(suffix)

  // 2. Check if the wrappers are just outside the selection (e.g., user highlighted "bold" inside "**bold**")
  const textBefore = state.sliceDoc(Math.max(0, from - prefix.length), from)
  const textAfter = state.sliceDoc(to, Math.min(state.doc.length, to + suffix.length))
  const isWrappedOutside = textBefore === prefix && textAfter === suffix

  if (isWrappedInside) {
    // Unwrap from inside
    dispatch({
      changes: { from, to, insert: text.slice(prefix.length, -suffix.length) },
      selection: { anchor: from, head: to - prefix.length - suffix.length }
    })
  } else if (isWrappedOutside) {
    // Unwrap from outside
    dispatch({
      changes: [
        { from: from - prefix.length, to: from, insert: '' },
        { from: to, to: to + suffix.length, insert: '' }
      ]
    })
  } else {
    // Wrap
    dispatch({
      changes: [
        { from, insert: prefix },
        { from: to, insert: suffix }
      ],
      selection: { anchor: from + prefix.length, head: to + prefix.length }
    })
  }
  view.focus()
}

export const clearFormatting = (view) => {
  if (!view) return
  const { state, dispatch } = view
  const s = state.selection.main
  const text = state.sliceDoc(s.from, s.to)
  // Remove markdown symbols
  const clean = text.replace(/[*_~=`$]/g, '')
  dispatch({ changes: { from: s.from, to: s.to, insert: clean } })
  view.focus()
}
