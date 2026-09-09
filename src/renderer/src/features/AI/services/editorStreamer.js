/**
 * editorStreamer.js
 * Synchronizes AI file creations, updates, and appends directly to the Lumina editor.
 * Eliminates artificial typewriter lag so large documents update instantly.
 */

export async function streamCodeToEditor({
  targetId,
  oldCode = '',
  newCode = '',
  isCurrentlySelected = false,
  changePos = null,
  changeLine = null,
  scrollToBottom = false,
  onProgress = null
}) {
  const { useVaultStore } = await import('../../../core/store/workspaceStore')
  const vs = useVaultStore.getState()

  const newStr = newCode || ''

  // Immediately apply the new draft to the store
  vs.setDraft(targetId, newStr)

  // Dispatch update to CodeMirror editor view
  window.dispatchEvent(
    new CustomEvent('ai-saved-snippet', {
      detail: {
        id: targetId,
        code: newStr,
        isStreaming: false,
        changePos,
        changeLine,
        scrollToBottom
      }
    })
  )

  if (onProgress) {
    onProgress(1)
  }
}

