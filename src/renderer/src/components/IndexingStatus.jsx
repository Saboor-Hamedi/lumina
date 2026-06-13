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
      setStats(newStats)
      setIsVisible(true)
      setIsComplete(false)

      // If finished
      if (newStats.progress >= 100 || newStats.indexed >= newStats.total) {
        setIsComplete(true)
        
        // Hide after 3 seconds
        setTimeout(() => {
          setIsVisible(false)
          // Reset after fade out
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

  // Ensure progress doesn't exceed 100 visually
  const safeProgress = Math.min(100, Math.max(0, stats.progress || 0))

  return (
    <div className={`indexing-status-container ${isComplete ? 'complete' : ''}`}>
      <div className="indexing-status-icon">
        {isComplete ? (
          <CheckCircle2 size={14} className="indexing-icon-complete" />
        ) : (
          <Database size={14} className="indexing-icon-spin" />
        )}
      </div>
      
      <div className="indexing-status-content">
        <div className="indexing-status-header">
          <span className="indexing-status-title">
            {isComplete ? 'Vault Indexed' : 'Indexing Vault'}
          </span>
          <span className="indexing-status-percent">
            {Math.round(safeProgress)}%
          </span>
        </div>
        
        <div className="indexing-status-bar-bg">
          <div 
            className="indexing-status-bar-fill" 
            style={{ width: `${safeProgress}%` }}
          />
        </div>
        
        <div className="indexing-status-details">
          {stats.indexed} of {stats.total} files
        </div>
      </div>
    </div>
  )
}

export default IndexingStatus
