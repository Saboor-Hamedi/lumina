import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { Check } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { useWorkspaceStore } from '../../core/store/workspaceStore'

export function LearnedButton({ snippet, note: propNote }) {
  const note = propNote || snippet
  const saveNote = useWorkspaceStore((state) => state.saveNote)
  const isStoreLearned = useWorkspaceStore((state) => {
    const n = (state.notes || []).find((item) => item.id === note?.id)
    return n ? !!n.isLearned : !!note?.isLearned
  })

  const [localLearned, setLocalLearned] = useState(isStoreLearned)

  useEffect(() => {
    setLocalLearned(isStoreLearned)
  }, [isStoreLearned])

  const toggleLearned = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!note?.id) return

      const nextLearnedState = !localLearned
      setLocalLearned(nextLearnedState)

      requestAnimationFrame(() => {
        const state = useWorkspaceStore.getState()
        const targetNote = (state.notes || []).find((n) => n.id === note.id) || note

        useWorkspaceStore.setState({
          notes: (state.notes || []).map((n) =>
            n.id === note.id ? { ...n, isLearned: nextLearnedState } : n
          ),
          selectedNote:
            state.selectedNote?.id === note.id
              ? { ...state.selectedNote, isLearned: nextLearnedState }
              : state.selectedNote
        })

        if (saveNote) {
          saveNote({
            ...targetNote,
            isLearned: nextLearnedState
          }).catch((err) => {
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
        onClick={toggleLearned}
        style={{
          background: 'transparent',
          border: '1px solid transparent',
          borderRadius: '5px',
          height: '21px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: isLearned ? 'var(--text-main, #f8fafc)' : 'var(--text-muted, #94a3b8)',
          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          padding: '0 6px',
          gap: '4px',
          fontSize: '11px',
          fontWeight: isLearned ? 500 : 400
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-main, #f8fafc)'
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = isLearned ? 'var(--text-main, #f8fafc)' : 'var(--text-muted, #94a3b8)'
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.borderColor = 'transparent'
        }}
      >
        {isLearned ? (
          <Check size={12} strokeWidth={2.5} color="var(--text-accent)" style={{ flexShrink: 0 }} />
        ) : (
          <Check size={12} strokeWidth={2.5} style={{ opacity: 0.4, flexShrink: 0 }} />
        )}
        <span>{isLearned ? 'Learned' : 'Learn'}</span>
      </button>
    </ToolTip>
  )
}

export function LearningTrackBadge({ snippetId, noteId: propNoteId }) {
  const noteId = propNoteId || snippetId
  const notes = useWorkspaceStore((state) => state.notes) || []
  const selectedNote = useWorkspaceStore(
    (state) => (noteId ? (state.notes || []).find((n) => n.id === noteId) : state.selectedNote)
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
    <ToolTip text={tooltipText} position="left">
      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          padding: '2px 4px',
          borderRadius: '4px',
          userSelect: 'none',
          cursor: 'default',
          background: 'transparent'
        }}
      >
        <span
          style={{
            fontSize: '9.5px',
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
            color: stats.percentage > 0 ? 'var(--text-accent, #a78bfa)' : 'var(--text-muted, #94a3b8)',
            lineHeight: 1
          }}
        >
          {stats.percentage}%
        </span>
        <div
          style={{
            width: '2.5px',
            height: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '2px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            position: 'relative'
          }}
        >
          <div
            style={{
              width: '100%',
              height: `${stats.percentage}%`,
              background: 'linear-gradient(to top, var(--text-accent, #8b5cf6), #a78bfa)',
              borderRadius: '2px',
              boxShadow: stats.percentage > 0 ? '0 0 4px rgba(167, 139, 250, 0.4)' : 'none',
              transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </div>
      </div>
    </ToolTip>
  )
}

export default function ProgressTracker({ snippetId, noteId }) {
  return <LearningTrackBadge snippetId={snippetId} noteId={noteId} />
}

export { ProgressTracker as RoadmapProgressBar }
