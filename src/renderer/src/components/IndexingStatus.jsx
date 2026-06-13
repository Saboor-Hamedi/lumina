import React, { useState, useEffect } from 'react'
import { Database, CheckCircle2 } from 'lucide-react'
import './IndexingStatus.css'

const IndexingStatus = () => {
  const [stats, setStats] = useState(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (!window.api?.onIndexProgress) return

    const unsubscribe = window.api.onIndexProgress((newStats) => {
      // If the indexer instantly finishes and indexed 0 files, do not show the UI.
      if (newStats.progress >= 100 && newStats.indexed === 0) {
        setIsVisible(false)
        setStats(null)
        return
      }

      setStats(newStats)
      setIsVisible(true)
      setIsComplete(false)

      // Check for completion
      if (newStats.progress >= 100 || newStats.indexed >= newStats.total) {
        setIsComplete(true)
        
        // Hide automatically after 3 seconds
        setTimeout(() => {
          setIsVisible(false)
          // Clean up state after the fade-out animation
          setTimeout(() => {
            setStats(null)
            setIsComplete(false)
          }, 300)
        }, 3000)
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  if (!isVisible || !stats) return null

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
        Processed {stats.indexed} of {stats.total} files
      </div>
    </div>
  )
}

export default React.memo(IndexingStatus)
