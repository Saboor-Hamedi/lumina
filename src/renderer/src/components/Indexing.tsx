import React, { useState, useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { PulseLoader } from './PulseLoader'
import '../assets/indexingStatus.css'

export interface IndexProgressStats {
  type?: string
  stage?: string
  progress?: number
  indexed?: number
  total?: number
  [key: string]: unknown
}

const Indexing: React.FC = () => {
  const [stats, setStats] = useState<IndexProgressStats | null>(null)
  const [isVisible, setIsVisible] = useState<boolean>(false)

  useEffect(() => {
    if (!window.api?.onIndexProgress) return

    const unsubscribe = window.api.onIndexProgress((newStats: IndexProgressStats | null | undefined) => {
      // Ignore backup events — those are handled inline in the SettingDropdown
      if (newStats?.type === 'backup') return

      // Don't pop up the toast if the workspace is already up-to-date with 0 files to index
      if (newStats?.stage === 'up-to-date') {
        setIsVisible(false)
        setStats(null)
        return
      }

      // Only show when actual work begins (files found to process)
      // Stages 'starting', 'scanned', 'checking' are pre-scans where we don't know yet if any files changed
      if (newStats?.stage && ['starting', 'scanned', 'checking'].includes(newStats.stage)) {
        return
      }

      if (newStats) {
        setStats(newStats)
        setIsVisible(true)
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!stats || !isVisible) return

    const isComplete = (stats.progress ?? 0) >= 100 || stats.stage === 'completed'

    if (!isComplete) return

    const timer = setTimeout(() => {
      setIsVisible(false)
      setStats(null)
    }, 2500)

    return () => clearTimeout(timer)
  }, [stats, isVisible])

  if (!isVisible || !stats) return null

  const isComplete = (stats.progress ?? 0) >= 100 || stats.stage === 'completed'

  const safeProgress = Math.min(100, Math.max(0, stats.progress || 0))

  return (
    <div
      className={`indexing-toast ${isComplete ? 'complete' : ''}`}
      style={{
        bottom: '24px',
        top: 'auto',
        paddingBottom: !isComplete ? '10px' : '8px',
        zIndex: 10001,
        width: '280px'
      }}
    >
      <div className="indexing-toast-content" style={{ alignItems: 'center' }}>
        <div
          className="indexing-icon-wrapper"
          style={isComplete ? { background: 'rgba(34, 197, 94, 0.14)', color: '#22c55e' } : {}}
        >
          {isComplete ? (
            <CheckCircle2 size={15} />
          ) : (
            <PulseLoader size="xs" inline delayMs={0} message="" />
          )}
        </div>

        <div
          className="indexing-toast-message"
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <div>{isComplete ? 'Indexing complete' : 'Indexing…'}</div>
          <div
            style={{
              fontSize: '10.5px',
              color: 'var(--text-faint)',
              fontWeight: 400,
              marginTop: '2px',
              lineHeight: 1.2,
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {isComplete
              ? `Indexed ${stats.indexed || stats.total || 0} files.`
              : `Processed ${stats.indexed || 0} of ${stats.total || 0} files`}
          </div>
        </div>

        {!isComplete && (
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              color: 'var(--text-faint)',
              marginLeft: '8px',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {Math.round(safeProgress)}%
          </span>
        )}
      </div>

      {!isComplete && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            backgroundColor: 'var(--bg-active)'
          }}
        >
          <div
            style={{
              height: '100%',
              backgroundColor: 'var(--text-accent)',
              width: `${safeProgress}%`,
              transition: 'width 0.3s ease-out'
            }}
          />
        </div>
      )}
    </div>
  )
}

export default React.memo(Indexing)
