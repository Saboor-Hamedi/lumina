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

  const tooltipText = stats.isFolder
    ? `Topic Track: ${stats.learned} of ${stats.total} notes learned (${stats.percentage}%) • Total Workspace: ${stats.vaultLearned}/${stats.vaultTotal}`
    : `Workspace Progress: ${stats.learned} of ${stats.total} notes learned (${stats.percentage}%)`

  return (
    <ToolTip text={tooltipText} position="bottom">
      <div
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: '2px',
          padding: '1px 0',
          background: 'transparent',
          border: 'none',
          userSelect: 'none',
          cursor: 'default',
          minWidth: '65px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            fontSize: '11px',
            color: 'var(--text-muted, #94a3b8)',
            padding: '0 1px'
          }}
        >
          <span
            style={{
              fontWeight: 600,
              color: stats.percentage > 0 ? 'var(--text-accent, #a78bfa)' : 'inherit'
            }}
          >
            {stats.isFolder
              ? `${stats.learned}/${stats.total} (${stats.percentage}%)`
              : `${stats.learned}/${stats.total}`}
          </span>
        </div>

        <div
          style={{
            width: '100%',
            height: '2px',
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: '1px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${stats.percentage}%`,
              height: '100%',
              background:
                'linear-gradient(90deg, var(--text-accent, #8b5cf6), var(--text-accent, #a78bfa))',
              borderRadius: '1px',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </div>
      </div>
    </ToolTip>
  )
}

export default function ProgressTracker({ snippetId }) {
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

  const tooltipText = stats.isFolder
    ? `Topic Track: ${stats.learned}/${stats.total} notes understood (${stats.percentage}%) • Total Workspace: ${stats.vaultLearned}/${stats.vaultTotal}`
    : `Learning Track: ${stats.learned}/${stats.total} notes understood (${stats.percentage}%)`

  return (
    <ToolTip text={tooltipText} position="bottom">
      <div
        className="learning-track-progress-edge"
        style={{
          marginTop: '12px',
          marginBottom: '-12px',
          width: '100%',
          height: '2px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '1px',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div
          style={{
            width: `${stats.percentage}%`,
            height: '100%',
            background:
              'linear-gradient(90deg, var(--text-accent, #8b5cf6), var(--text-accent, #a78bfa))',
            boxShadow:
              stats.percentage > 0
                ? '0 0 8px rgba(var(--text-accent-rgb, 139, 92, 246), 0.4)'
                : 'none',
            borderRadius: '1px',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
      </div>
    </ToolTip>
  )
}

export { ProgressTracker as RoadmapProgressBar }
