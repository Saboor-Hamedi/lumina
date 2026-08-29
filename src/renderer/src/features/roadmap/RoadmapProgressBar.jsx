import React from 'react'
import { Check, Sparkles } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { useVaultStore } from '../../core/store/useVaultStore'

/**
 * Clean, self-contained Learn/Understand toggle button for notes
 * Stores `isLearned: true` directly on the snippet document.
 */
export function LearnedButton({ snippet }) {
  const saveSnippet = useVaultStore((state) => state.saveSnippet)
  const currentSnippet = useVaultStore((state) => state.snippets.find((s) => s.id === snippet?.id) || snippet)
  const isLearned = !!currentSnippet?.isLearned

  const toggleLearned = async (e) => {
    e.preventDefault()
    if (!currentSnippet?.id) return
    try {
      await saveSnippet({
        ...currentSnippet,
        isLearned: !isLearned
      })
    } catch (err) {
      console.error('Failed to toggle learned status:', err)
    }
  }

  if (!snippet?.id) return null

  return (
    <ToolTip text={isLearned ? 'Mark as Unlearned' : 'Mark as Understood / Learned'} position="bottom">
      <button
        onClick={toggleLearned}
        style={{
          background: isLearned ? 'rgba(var(--text-accent-rgb, 139, 92, 246), 0.12)' : 'rgba(255, 255, 255, 0.03)',
          border: isLearned ? '1px solid rgba(var(--text-accent-rgb, 139, 92, 246), 0.35)' : '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '6px',
          height: '24px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: isLearned ? 'var(--text-accent, #a78bfa)' : 'var(--text-muted, #94a3b8)',
          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          padding: '0 9px',
          gap: '5px',
          fontSize: '12px',
          fontWeight: isLearned ? 600 : 500
        }}
        onMouseEnter={(e) => {
          if (!isLearned) {
            e.currentTarget.style.color = 'var(--text-main, #f8fafc)'
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isLearned) {
            e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)'
          }
        }}
      >
        <Check size={12} style={{ opacity: isLearned ? 1 : 0.6 }} />
        <span>{isLearned ? 'Learned' : 'Understand'}</span>
      </button>
    </ToolTip>
  )
}

/**
 * Compact learning track badge for the action row
 */
export function LearningTrackBadge() {
  const snippets = useVaultStore((state) => state.snippets)
  const total = snippets.length
  if (total === 0) return null

  const learnedCount = snippets.filter((s) => !!s.isLearned).length
  const percentage = Math.min(100, Math.round((learnedCount / total) * 100))

  return (
    <ToolTip text={`Learning Track: ${learnedCount} of ${total} notes understood (${percentage}%)`} position="bottom">
      <div
        style={{
          marginLeft: 'auto',
          fontSize: '11px',
          color: 'var(--text-muted, #94a3b8)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 8px',
          borderRadius: '5px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          userSelect: 'none',
          cursor: 'default'
        }}
      >
        <span style={{ opacity: 0.7 }}>Track:</span>
        <span style={{ fontWeight: 600, color: percentage > 0 ? 'var(--text-accent, #a78bfa)' : 'inherit' }}>
          {percentage}%
        </span>
      </div>
    </ToolTip>
  )
}

/**
 * Sleek 2px ambient progress edge line anchored to the header bottom
 */
export default function RoadmapProgressBar() {
  const snippets = useVaultStore((state) => state.snippets)

  const total = snippets.length
  if (total === 0) return null

  const learnedCount = snippets.filter((s) => !!s.isLearned).length
  const percentage = Math.min(100, Math.round((learnedCount / total) * 100))

  return (
    <ToolTip text={`Learning Track: ${learnedCount}/${total} notes understood (${percentage}%)`} position="bottom">
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
          position: 'relative',
          cursor: 'pointer'
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: 'linear-gradient(90deg, var(--text-accent, #8b5cf6), var(--text-accent, #a78bfa))',
            boxShadow: percentage > 0 ? '0 0 8px rgba(var(--text-accent-rgb, 139, 92, 246), 0.4)' : 'none',
            borderRadius: '1px',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
      </div>
    </ToolTip>
  )
}
