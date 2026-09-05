import React, { useState, useEffect } from 'react'
import { Download, Loader2, Settings, CheckCircle2, RefreshCw } from 'lucide-react'
import ToolTip from '../atoms/ToolTip'

const UpdateFooter = ({
  currentVersion,
  lastChecked,
  status,
  progress,
  install,
  download,
  check,
  newVersion,
  onClose
}) => {
  const [showSettings, setShowSettings] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const getRelativeTime = () => {
    if (!lastChecked) return 'Just now'
    const diffSec = Math.max(0, Math.floor((now - lastChecked) / 1000))
    if (diffSec < 45) return 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
  }

  if (showSettings) {
    return (
      <div className="update-details-footer">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
            Update Preferences
          </span>
          <button className="text-btn" onClick={() => setShowSettings(false)}>
            Done
          </button>
        </div>
        <div className="settings-pane">
          <label className="setting-item">
            <input
              type="checkbox"
              className="update-preference-checkbox"
              defaultChecked
            />{' '}
            Download updates automatically
          </label>
          <label className="setting-item">
            <input type="checkbox" className="update-preference-checkbox" /> Install
            updates on quit
          </label>
          <label className="setting-item">
            <input
              type="checkbox"
              className="update-preference-checkbox"
              defaultChecked
            />{' '}
            Notify me about pre-releases
          </label>
        </div>
      </div>
    )
  }

  return (
    <div className="update-details-footer">
      <div className="footer-actions-secondary">
        <ToolTip text="Update Preferences" position="top">
          <button
            className="settings-btn"
            onClick={() => setShowSettings(true)}
            title="Update Preferences"
          >
            <Settings size={14} />
          </button>
        </ToolTip>

        <div className="footer-right-info">
          <span className="footer-version-text">
            v{currentVersion || newVersion || '1.0.0'}
          </span>
          <span className="footer-time-text">
            • {getRelativeTime()}
          </span>
        </div>
      </div>
    </div>
  )
}

export default UpdateFooter
