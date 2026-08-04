import React, { useState, useEffect } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import './IndexingStatus.css'

const IndexingStatus = () => {
  const [stats, setStats] = useState(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!window.api?.onIndexProgress) return

    const unsubscribe = window.api.onIndexProgress((newStats) => {
      setStats(newStats)
      setIsVisible(true)
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!stats) return

    const isComplete =
      stats.progress >= 100 || stats.stage === 'up-to-date' || stats.stage === 'completed'

    if (!isComplete) return

    const timer = setTimeout(() => {
      setIsVisible(false)
      setStats(null)
    }, 1000)

    return () => clearTimeout(timer)
  }, [stats])

  if (!isVisible || !stats) return null

  const isComplete =
    stats.progress >= 100 || stats.stage === 'up-to-date' || stats.stage === 'completed'

  // Ensure progress remains visually bounded between 0 and 100
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
            <Loader2 size={15} className="indexing-icon-spin" />
          )}
        </div>

        <div
          className="indexing-toast-message"
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <div>
            {isComplete 
              ? (stats.type === 'backup' ? 'Backup complete' : 'Indexing complete') 
              : (stats.type === 'backup' ? 'Backing up to Drive...' : 'Indexing...')}
          </div>
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
            {stats.type === 'backup'
              ? (stats.stage === 'scanning' ? 'Compressing workspace...' : stats.stage === 'uploading' ? 'Uploading to Drive...' : 'Workspace synced to Drive.')
              : (stats.stage === 'scanning' || stats.stage === 'checking'
              ? `Scanning ${stats.found || stats.total || 0} files...`
              : stats.stage === 'up-to-date' || stats.stage === 'completed' || stats.progress >= 100
                ? 'All files up to date.'
                : `Processed ${stats.indexed || 0} of ${stats.total || 0} files`)}
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

export default React.memo(IndexingStatus)
