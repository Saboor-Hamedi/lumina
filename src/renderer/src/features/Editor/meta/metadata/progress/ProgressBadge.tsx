import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { Check } from 'lucide-react'
import ToolTip from '../../../../../components/atoms/ToolTip'
import { useWorkspaceStore } from '../../../../../core/store/workspaceStore'
import './progress.css'

export interface LearnedNoteLike {
  id?: string
  isLearned?: boolean
  [key: string]: unknown
}

export interface LearnedButtonProps {
  snippet?: LearnedNoteLike | null
  note?: LearnedNoteLike | null
}

export interface LearningTrackBadgeProps {
  snippetId?: string | null
  noteId?: string | null
}

export function LearnedButton({
  snippet,
  note: propNote
}: LearnedButtonProps): React.ReactElement | null {
  const note = propNote || snippet
  const saveNote = useWorkspaceStore((state) => state.saveNote || state.saveSnippet)
  const isStoreLearned = useWorkspaceStore((state) => {
    const all = state.notes || state.snippets || []
    const n = all.find((item) => item.id === note?.id)
    return n ? !!n.isLearned : !!note?.isLearned
  })

  const [localLearned, setLocalLearned] = useState(isStoreLearned)

  useEffect(() => {
    setLocalLearned(isStoreLearned)
  }, [isStoreLearned])

  const toggleLearned = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (!note?.id) return
      const noteId = note.id

      const nextLearnedState = !localLearned
      setLocalLearned(nextLearnedState)

      requestAnimationFrame(() => {
        const state = useWorkspaceStore.getState()
        const targetNote = (state.notes || []).find((n) => n.id === noteId) || note

        useWorkspaceStore.setState({
          notes: (state.notes || []).map((n) =>
            n.id === noteId ? { ...n, isLearned: nextLearnedState } : n
          ),
          selectedNote:
            state.selectedNote && state.selectedNote.id === noteId
              ? { ...state.selectedNote, isLearned: nextLearnedState }
              : state.selectedNote
        })

        if (saveNote) {
          saveNote({
            ...targetNote,
            id: noteId,
            isLearned: nextLearnedState
          }).catch((err: unknown) => {
            console.error('[ProgressTracker] Failed to toggle learned status:', err)
            setLocalLearned(!nextLearnedState)
          })
        }
      })
    },
    [note, localLearned, saveNote]
  )

  if (!note?.id) return null

  const isLearned = localLearned

  return (
    <ToolTip text={isLearned ? 'Mark as Not Learned' : 'Mark as Learned'} position="bottom">
      <button
        type="button"
        onClick={toggleLearned}
        className={`meta-action-btn meta-learned-btn ${isLearned ? 'is-learned' : ''}`}
      >
        <Check size={12} strokeWidth={2.5} className="meta-learned-icon" />
        <span>{isLearned ? 'Learned' : 'Learn'}</span>
      </button>
    </ToolTip>
  )
}

export function LearningTrackBadge({
  snippetId,
  noteId: propNoteId
}: LearningTrackBadgeProps): React.ReactElement | null {
  const noteId = propNoteId || snippetId
  const notes = useWorkspaceStore((state) => state.notes || state.snippets) || []
  const selectedNote = useWorkspaceStore((state) =>
    noteId
      ? (state.notes || state.snippets || []).find((n) => n.id === noteId)
      : state.selectedNote || state.selectedSnippet
  )

  const stats = useMemo(() => {
    if (!notes || notes.length === 0) return null

    const totalWorkspace = notes.length
    const learnedWorkspace = notes.filter((n) => !!n.isLearned).length

    const folderId = selectedNote?.folderId
    const folderNotes = folderId ? notes.filter((n) => (n.folderId || '') === folderId) : null

    if (folderNotes && folderNotes.length > 0) {
      const folderTotal = folderNotes.length
      const folderLearned = folderNotes.filter((n) => !!n.isLearned).length
      const folderPercent = Math.min(100, Math.round((folderLearned / folderTotal) * 100))
      return {
        isFolder: true,
        learned: folderLearned,
        total: folderTotal,
        percentage: folderPercent,
        workspaceLearned: learnedWorkspace,
        workspaceTotal: totalWorkspace
      }
    }

    const workspacePercent = totalWorkspace > 0 ? (learnedWorkspace / totalWorkspace) * 100 : 0
    const displayPercent =
      workspacePercent >= 10 || workspacePercent === 0
        ? Math.round(workspacePercent)
        : parseFloat(workspacePercent.toFixed(1))

    return {
      isFolder: false,
      learned: learnedWorkspace,
      total: totalWorkspace,
      percentage: displayPercent,
      workspaceLearned: learnedWorkspace,
      workspaceTotal: totalWorkspace
    }
  }, [notes, selectedNote])

  if (!stats || stats.total === 0) return null

  const tooltipText = `Progress: ${stats.percentage}% (${stats.learned}/${stats.total})`

  return (
    <ToolTip text={tooltipText} position="bottom">
      <div className="learning-track-badge">
        <div className="learning-track-bar">
          <div
            className="learning-track-fill"
            style={{ width: `${Math.min(100, Math.max(0, stats.percentage))}%` }}
          />
        </div>
        <span className={`learning-track-percent ${stats.percentage > 0 ? 'has-progress' : ''}`}>
          {stats.percentage}%
        </span>
      </div>
    </ToolTip>
  )
}

export function ProgressBadge({
  snippetId,
  noteId
}: LearningTrackBadgeProps): React.ReactElement {
  return <LearningTrackBadge snippetId={snippetId} noteId={noteId} />
}

export default ProgressBadge
export { ProgressBadge as ProgressTracker, ProgressBadge as RoadmapProgressBar }
