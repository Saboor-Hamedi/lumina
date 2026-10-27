import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { Check } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { useWorkspaceStore } from '../../core/store/workspaceStore'

export function LearnedButton({ snippet, note: propNote }) {
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
        className="meta-action-btn"
        style={{
          cursor: 'pointer',
          color: isLearned ? 'var(--text-main, #f8fafc)' : 'var(--text-muted, #94a3b8)',
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
  const notes = useWorkspaceStore((state) => state.notes || state.snippets) || []
  const selectedNote = useWorkspaceStore(
    (state) =>
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
      <div
        className="learning-track-badge"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '0 6px',
          height: '22px',
          width: '64px',
          minWidth: '64px',
          maxWidth: '64px',
          borderRadius: '4px',
          userSelect: 'none',
          cursor: 'default',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          boxSizing: 'border-box',
          flexShrink: 0,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: '26px',
            minWidth: '26px',
            maxWidth: '26px',
            height: '4px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2px',
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0
          }}
        >
          <div
            style={{
              width: `${Math.min(100, Math.max(0, stats.percentage))}%`,
              maxWidth: '100%',
              height: '100%',
              background: 'linear-gradient(to right, var(--text-accent, #8b5cf6), #a78bfa)',
              borderRadius: '2px',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </div>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
            color: stats.percentage > 0 ? 'var(--text-accent, #a78bfa)' : 'var(--text-muted, #94a3b8)',
            lineHeight: 1,
            width: '25px',
            textAlign: 'right',
            flexShrink: 0
          }}
        >
          {stats.percentage}%
        </span>
      </div>
    </ToolTip>
  )
}

export default function ProgressTracker({ snippetId, noteId }) {
  return <LearningTrackBadge snippetId={snippetId} noteId={noteId} />
}

export { ProgressTracker as RoadmapProgressBar }
