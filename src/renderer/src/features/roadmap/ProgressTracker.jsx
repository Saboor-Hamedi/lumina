import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { Check } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { useVaultStore } from '../../core/store/workspaceStore'

export function LearnedButton({ snippet }) {
  const saveSnippet = useVaultStore((state) => state.saveSnippet)
  const isStoreLearned = useVaultStore((state) => {
    const s = state.snippets.find((item) => item.id === snippet?.id)
    return s ? !!s.isLearned : !!snippet?.isLearned
  })

  const [localLearned, setLocalLearned] = useState(isStoreLearned)

  useEffect(() => {
    setLocalLearned(isStoreLearned)
  }, [isStoreLearned])

  const toggleLearned = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!snippet?.id) return

      const nextLearnedState = !localLearned
      setLocalLearned(nextLearnedState)

      requestAnimationFrame(() => {
        const state = useVaultStore.getState()
        const targetSnippet = state.snippets.find((s) => s.id === snippet.id) || snippet

        useVaultStore.setState({
          snippets: state.snippets.map((s) =>
            s.id === snippet.id ? { ...s, isLearned: nextLearnedState } : s
          ),
          selectedSnippet:
            state.selectedSnippet?.id === snippet.id
              ? { ...state.selectedSnippet, isLearned: nextLearnedState }
              : state.selectedSnippet
        })

        saveSnippet({
          ...targetSnippet,
          isLearned: nextLearnedState
        }).catch((err) => {
          console.error('[ProgressTracker] Failed to toggle learned status:', err)
          setLocalLearned(!nextLearnedState)
        })
      })
    },
    [snippet, localLearned, saveSnippet]
  )

  if (!snippet?.id) return null

  const isLearned = localLearned

  return (
    <ToolTip text={isLearned ? 'Mark as Not Learned' : 'Mark as Learned'} position="bottom">
      <button
        onClick={toggleLearned}
        style={{
          background: isLearned
            ? 'rgba(34, 197, 94, 0.08)'
            : 'transparent',
          border: isLearned
            ? '1px solid rgba(34, 197, 94, 0.25)'
            : '1px solid transparent',
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
          if (!isLearned) {
            e.currentTarget.style.color = 'var(--text-main, #f8fafc)'
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isLearned) {
            e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.borderColor = 'transparent'
          }
        }}
      >
        {isLearned ? (
          <span
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#22c55e',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Check size={8} strokeWidth={3.5} color="#000" />
          </span>
        ) : (
          <span
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Check size={7} strokeWidth={2.5} style={{ opacity: 0.4 }} />
          </span>
        )}
        <span>{isLearned ? 'Learned' : 'Learn'}</span>
      </button>
    </ToolTip>
  )
}

export function LearningTrackBadge({ snippetId }) {
  const snippets = useVaultStore((state) => state.snippets)
  const selectedSnippet = useVaultStore(
    (state) => (snippetId ? state.snippets.find((s) => s.id === snippetId) : state.selectedSnippet)
  )

  const stats = useMemo(() => {
    if (!snippets || snippets.length === 0) return null

    const totalVault = snippets.length
    const learnedVault = snippets.filter((s) => !!s.isLearned).length

    const folderId = selectedSnippet?.folderId
    const folderSnippets = folderId ? snippets.filter((s) => (s.folderId || '') === folderId) : null

    if (folderSnippets && folderSnippets.length > 0) {
      const folderTotal = folderSnippets.length
      const folderLearned = folderSnippets.filter((s) => !!s.isLearned).length
      const folderPercent = Math.min(100, Math.round((folderLearned / folderTotal) * 100))
      return {
        isFolder: true,
        learned: folderLearned,
        total: folderTotal,
        percentage: folderPercent,
        vaultLearned: learnedVault,
        vaultTotal: totalVault
      }
    }

    const vaultPercent = totalVault > 0 ? (learnedVault / totalVault) * 100 : 0
    const displayPercent =
      vaultPercent >= 10 || vaultPercent === 0
        ? Math.round(vaultPercent)
        : parseFloat(vaultPercent.toFixed(1))

    return {
      isFolder: false,
      learned: learnedVault,
      total: totalVault,
      percentage: displayPercent,
      vaultLearned: learnedVault,
      vaultTotal: totalVault
    }
  }, [snippets, selectedSnippet])

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

export default function ProgressTracker({ snippetId }) {
  return <LearningTrackBadge snippetId={snippetId} />
}

export { ProgressTracker as RoadmapProgressBar }
