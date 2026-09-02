import React, { useState, useEffect } from 'react'
import { Download, Loader2, Settings, ArrowLeft, CheckCircle2 } from 'lucide-react'
import ToolTip from '../atoms/ToolTip'

const UpdateFooter = ({ status, progress, install, onClose }) => {
  const [showSettings, setShowSettings] = useState(false)
  const [minutesAgo, setMinutesAgo] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMinutesAgo(prev => prev + 1)
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  if (showSettings) {
    return (
      <div className="update-details-footer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Update Preferences</span>
          <button className="text-btn" onClick={() => setShowSettings(false)}>Done</button>
        </div>
        <div className="settings-pane">
          <label className="setting-item">
            <input type="checkbox" className="update-preference-checkbox" defaultChecked /> Download updates automatically
          </label>
          <label className="setting-item">
            <input type="checkbox" className="update-preference-checkbox" /> Install updates on quit
          </label>
          <label className="setting-item">
            <input type="checkbox" className="update-preference-checkbox" defaultChecked /> Notify me about pre-releases
          </label>
        </div>
      </div>
    )
  }

  const percentValue =
    typeof progress === 'number'
      ? progress
      : typeof progress?.percent === 'number'
        ? progress.percent
        : typeof progress?.progress === 'number'
          ? progress.progress
          : 0

  const safePercent = isNaN(percentValue) ? 0 : Math.min(100, Math.max(0, Math.round(percentValue)))

  return (
    <div className="update-details-footer">
      {status === 'downloading' || status === 'available' ? (
        <button className="update-install-btn primary-solid" style={{ cursor: 'default' }}>
          <div
            className="progress-bar-fill"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${safePercent}%`,
              background: 'rgba(255,255,255,0.2)',
              transition: 'width 0.3s'
            }}
          />
          <Loader2 size={14} className="spin" style={{ position: 'relative', zIndex: 1 }} />
          <span style={{ position: 'relative', zIndex: 1 }}>
            {status === 'available' ? 'Preparing download...' : `Downloading... ${safePercent}%`}
          </span>
        </button>
      ) : status === 'ready' ? (
        <button className="update-install-btn primary-solid" onClick={install}>
          <CheckCircle2 size={14} />
          <span>Restart & Install Now</span>
        </button>
      ) : null}
      
      <div className="footer-actions-secondary" style={{ marginTop: (status === 'idle' || status === 'checking') ? '0' : '4px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <ToolTip text="Update Preferences" position="top">
            <button className="settings-btn" onClick={() => setShowSettings(true)}>
              <Settings size={14} />
            </button>
          </ToolTip>
          {(status === 'idle' || status === 'checking') && (
            <span style={{ fontSize: '11px', color: 'var(--text-faint)', transition: 'color 0.3s' }}>
              Last checked: {minutesAgo === 0 ? 'Just now' : `${minutesAgo} min ago`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="text-btn" onClick={onClose}>Remind Me</button>
          <button className="text-btn" onClick={onClose}>Not Now</button>
        </div>
      </div>
    </div>
  )
}

export default UpdateFooter
