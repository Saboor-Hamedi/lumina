/**
 * editorStreamer.js
 * Enables realistic word-by-word / chunk-by-chunk streaming into the Lumina editor
 * whenever AI updates, appends, or creates files in the active tab.
 */

export async function streamCodeToEditor({
  targetId,
  oldCode = '',
  newCode = '',
  isCurrentlySelected = false,
  onProgress = null,
  chunkDelayMs = 12,
  wordsPerChunk = 3
}) {
  const { useVaultStore } = await import('../../../core/store/workspaceStore')
  const vs = useVaultStore.getState()

  const oldStr = oldCode || ''
  const newStr = newCode || ''

  // If not open in active editor tab, update state immediately without animation
  if (!isCurrentlySelected || oldStr === newStr) {
    vs.setDraft(targetId, newStr)
    window.dispatchEvent(
      new CustomEvent('ai-saved-snippet', {
        detail: { id: targetId, code: newStr, isStreaming: false }
      })
    )
    return
  }

  // Calculate common prefix and suffix to isolate newly inserted/modified text
  let prefixLen = 0
  while (
    prefixLen < oldStr.length &&
    prefixLen < newStr.length &&
    oldStr[prefixLen] === newStr[prefixLen]
  ) {
    prefixLen++
  }

  let oldSuffixLen = 0
  while (
    oldSuffixLen < (oldStr.length - prefixLen) &&
    oldSuffixLen < (newStr.length - prefixLen) &&
    oldStr[oldStr.length - 1 - oldSuffixLen] === newStr[newStr.length - 1 - oldSuffixLen]
  ) {
    oldSuffixLen++
  }

  const prefix = oldStr.slice(0, prefixLen)
  const suffix = oldSuffixLen > 0 ? oldStr.slice(oldStr.length - oldSuffixLen) : ''
  const inserted = newStr.slice(prefixLen, newStr.length - oldSuffixLen)

  // Split into tokens (words and whitespace preserved)
  const tokens = inserted.split(/(\s+)/).filter(Boolean)

  // If very brief edit, apply in single step
  if (tokens.length <= 2) {
    vs.setDraft(targetId, newStr)
    window.dispatchEvent(
      new CustomEvent('ai-saved-snippet', {
        detail: { id: targetId, code: newStr, isStreaming: false, autoScroll: true }
      })
    )
    return
  }

  const stepSize = Math.max(1, wordsPerChunk)
  let currentAccum = ''

  for (let i = 0; i < tokens.length; i += stepSize) {
    const chunk = tokens.slice(i, i + stepSize).join('')
    currentAccum += chunk
    const intermediateCode = prefix + currentAccum + suffix

    vs.setDraft(targetId, intermediateCode)
    window.dispatchEvent(
      new CustomEvent('ai-saved-snippet', {
        detail: {
          id: targetId,
          code: intermediateCode,
          isStreaming: true,
          autoScroll: true
        }
      })
    )

    if (onProgress) {
      onProgress(currentAccum.length / inserted.length)
    }

    await new Promise((resolve) => setTimeout(resolve, chunkDelayMs))
  }

  // Final flush to ensure exact match
  vs.setDraft(targetId, newStr)
  window.dispatchEvent(
    new CustomEvent('ai-saved-snippet', {
      detail: { id: targetId, code: newStr, isStreaming: false, autoScroll: true }
    })
  )
}
