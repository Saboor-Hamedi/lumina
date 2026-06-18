import React, { useState, useEffect } from 'react'
import { Database, CheckCircle2 } from 'lucide-react'
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
      stats.progress >= 100 ||
      stats.stage === 'up-to-date' ||
      stats.stage === 'completed'

    if (!isComplete) return

    const timer = setTimeout(() => {
      setIsVisible(false)
      setStats(null)
    }, 1000)

    return () => clearTimeout(timer)
  }, [stats])

  if (!isVisible || !stats) return null

  const isComplete =
    stats.progress >= 100 ||
    stats.stage === 'up-to-date' ||
    stats.stage === 'completed'

  // Ensure progress remains visually bounded between 0 and 100
  const safeProgress = Math.min(100, Math.max(0, stats.progress || 0))

  return (
    <div className={`indexing-status-container ${isComplete ? 'complete' : ''}`}>
      <div className="indexing-status-header">
        <div className="indexing-status-icon">
          {isComplete ? (
            <CheckCircle2 size={16} />
          ) : (
            <Database size={16} className="indexing-icon-spin" />
          )}
        </div>
        
        <div className="indexing-status-title-container">
          <span className="indexing-status-title">
            {isComplete ? 'Vault Indexed' : 'Indexing Vault'}
          </span>
          <span className="indexing-status-percent">
            {Math.round(safeProgress)}%
          </span>
        </div>
      </div>
      
      <div className="indexing-status-bar-bg">
        <div 
          className="indexing-status-bar-fill" 
          style={{ width: `${safeProgress}%` }}
        />
      </div>
      
      <div className="indexing-status-details">
        {stats.stage === 'scanning' || stats.stage === 'checking'
          ? `Scanning ${stats.found || stats.total || 0} files...`
          : stats.stage === 'up-to-date' || stats.stage === 'completed' || stats.progress >= 100
          ? 'Index is complete'
          : `Processed ${stats.indexed || 0} of ${stats.total || 0} files`}
      </div>
    </div>
  )
}

export default React.memo(IndexingStatus)
