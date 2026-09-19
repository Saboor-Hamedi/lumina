/**
 * editorDiff.ts
 * Computes minimal change boundaries between two string versions of a document.
 * This preserves CodeMirror selections, cursor positions, fold states, and history
 * by avoiding full-document replacement.
 */

export interface MinimalChange {
  from: number
  to: number
  insert: string
}

export function computeMinimalChange(oldStr: string, newStr: string): MinimalChange {
  if (oldStr === newStr) {
    return { from: 0, to: 0, insert: '' }
  }

  let start = 0
  const oldLen = oldStr.length
  const newLen = newStr.length

  // Find common prefix using charCodeAt for high performance
  while (start < oldLen && start < newLen && oldStr.charCodeAt(start) === newStr.charCodeAt(start)) {
    start++
  }

  // Find common suffix
  let oldEnd = oldLen
  let newEnd = newLen
  while (oldEnd > start && newEnd > start && oldStr.charCodeAt(oldEnd - 1) === newStr.charCodeAt(newEnd - 1)) {
    oldEnd--
    newEnd--
  }

  return {
    from: start,
    to: oldEnd,
    insert: newStr.slice(start, newEnd)
  }
}
