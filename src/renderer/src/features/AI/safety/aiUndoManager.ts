/**
 * aiUndoManager.ts
 *
 * Tracks snapshots of every workspace file/note mutation performed by Lumina AI
 * so the user (or Lumina via the `undoChanges` tool) can revert either a single
 * file or an entire multi-file AI turn cleanly.
 */

import { useWorkspaceStore, type WorkspaceNote } from '../../../core/store/workspaceStore'

export type AIUndoActionKind = 'create' | 'update' | 'delete' | 'rename' | 'move' | 'clear'

export interface AIFileSnapshot {
  id: string
  turnId: string
  timestamp: number
  action: AIUndoActionKind
  targetPath: string
  noteId: string
  previousNote: WorkspaceNote | null
  createdNoteId?: string
}

const MAX_UNDO_TURNS = 25
let activeTurnId = `turn-${Date.now()}`
let undoHistory: AIFileSnapshot[] = []

/**
 * Starts a new AI turn group for multi-file undo tracking.
 */
export function beginAIUndoTurn(): string {
  activeTurnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  return activeTurnId
}

/**
 * Records a pre-mutation snapshot of a note before an AI tool modifies or deletes it.
 */
export function recordAIFileSnapshot(
  entry: Omit<AIFileSnapshot, 'id' | 'turnId' | 'timestamp'>
): void {
  const snapshot: AIFileSnapshot = {
    ...entry,
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    turnId: activeTurnId,
    timestamp: Date.now(),
    previousNote: entry.previousNote ? { ...entry.previousNote } : null
  }

  undoHistory.push(snapshot)

  // Bound memory to the last MAX_UNDO_TURNS distinct turns
  const distinctTurns = Array.from(new Set(undoHistory.map((s) => s.turnId)))
  if (distinctTurns.length > MAX_UNDO_TURNS) {
    const keepTurns = new Set(distinctTurns.slice(-MAX_UNDO_TURNS))
    undoHistory = undoHistory.filter((s) => keepTurns.has(s.turnId))
  }
}

export function getAIUndoHistory(): readonly AIFileSnapshot[] {
  return undoHistory
}

export function clearAIUndoHistory(): void {
  undoHistory = []
}

async function revertSnapshot(snap: AIFileSnapshot): Promise<{ ok: boolean; label: string }> {
  const store = useWorkspaceStore.getState()

  if (snap.action === 'create') {
    const targetId = snap.createdNoteId || snap.noteId
    const existing = store.notes.find((n) => n.id === targetId)
    if (existing) {
      await store.deleteNote(targetId, true)
    }
    return { ok: true, label: `Removed created note "${snap.targetPath}"` }
  }

  if (snap.previousNote) {
    await store.saveNote({
      ...snap.previousNote,
      id: snap.previousNote.id,
      title: snap.previousNote.title,
      code: snap.previousNote.code ?? '',
      folderId: snap.previousNote.folderId ?? '',
      fileName: snap.previousNote.fileName
    })
    return { ok: true, label: `Restored "${snap.targetPath}"` }
  }

  return { ok: false, label: `No previous snapshot for "${snap.targetPath}"` }
}

/**
 * Reverts either a specific file's latest AI change or the entire most recent AI turn
 * (single or multi-file).
 */
export async function undoAIChanges(targetFileQuery?: string): Promise<{
  success: boolean
  revertedCount: number
  revertedFiles: string[]
  message: string
}> {
  if (undoHistory.length === 0) {
    return {
      success: false,
      revertedCount: 0,
      revertedFiles: [],
      message: 'There are no recent AI file changes available to undo.'
    }
  }

  let toRevert: AIFileSnapshot[] = []
  const query = (targetFileQuery || '').trim().toLowerCase()

  if (query) {
    for (let i = undoHistory.length - 1; i >= 0; i--) {
      const snap = undoHistory[i]
      const targetMatch = snap.targetPath.toLowerCase().includes(query)
      const titleMatch = (snap.previousNote?.title || '').toLowerCase().includes(query)
      if (targetMatch || titleMatch) {
        toRevert = [snap]
        undoHistory.splice(i, 1)
        break
      }
    }
    if (toRevert.length === 0) {
      return {
        success: false,
        revertedCount: 0,
        revertedFiles: [],
        message: `No recent AI changes matched "${targetFileQuery}".`
      }
    }
  } else {
    const lastTurnId = undoHistory[undoHistory.length - 1].turnId
    toRevert = undoHistory.filter((s) => s.turnId === lastTurnId).reverse()
    undoHistory = undoHistory.filter((s) => s.turnId !== lastTurnId)
  }

  const revertedFiles: string[] = []
  const errors: string[] = []

  for (const snap of toRevert) {
    try {
      const res = await revertSnapshot(snap)
      if (res.ok) {
        revertedFiles.push(snap.targetPath)
      } else {
        errors.push(res.label)
      }
    } catch (err: any) {
      errors.push(`${snap.targetPath}: ${err?.message || 'Failed to revert'}`)
    }
  }

  if (revertedFiles.length === 0) {
    return {
      success: false,
      revertedCount: 0,
      revertedFiles: [],
      message: errors.join('; ') || 'Could not revert AI changes.'
    }
  }

  return {
    success: true,
    revertedCount: revertedFiles.length,
    revertedFiles,
    message: `Reverted ${revertedFiles.length} file${revertedFiles.length === 1 ? '' : 's'}: ${revertedFiles.join(', ')}`
  }
}
