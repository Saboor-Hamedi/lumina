/**
 * editorStreamer.ts
 * Synchronizes AI file creations, updates, and appends directly to the Lumina editor.
 * Eliminates artificial typewriter lag so large documents update instantly.
 */

export interface StreamCodeToEditorParams {
  targetId: string
  oldCode?: string
  newCode?: string
  isCurrentlySelected?: boolean
  changePos?: number | null
  changeLine?: number | null
  scrollToBottom?: boolean
  onProgress?: ((progress: number) => void) | null
}

export async function streamCodeToEditor({
  targetId,
  newCode = '',
  changePos = null,
  changeLine = null,
  scrollToBottom = false,
  onProgress = null
}: StreamCodeToEditorParams): Promise<void> {
  const { useWorkspaceStore } = await import('../../../core/store/workspaceStore')
  const vs = (useWorkspaceStore as any).getState()

  const newStr = newCode || ''

  // Immediately apply the new draft to the store
  if (vs.setDraft) {
    vs.setDraft(targetId, newStr)
  }

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
