import React, { useState } from 'react'
import { ArrowRight, CheckCircle2, Download, Loader2, RefreshCw } from 'lucide-react'

const UpdateHeader = ({
  currentVersion,
  newVersion,
  status,
  progress,
  download,
  install,
  check
}) => {
  const [channel, setChannel] = useState('stable')
  const isUpToDate = status === 'idle' || (status === 'not-available') || (currentVersion === newVersion && status !== 'available' && status !== 'downloading' && status !== 'ready')

  const percentValue =
    typeof progress === 'number'
      ? progress
      : typeof progress?.percent === 'number'
        ? progress.percent
        : typeof progress?.progress === 'number'
          ? progress.progress
          : 0

  const safePercent = isNaN(percentValue)
    ? 0
    : Math.min(100, Math.max(0, Math.round(percentValue)))

  return (
    <div className="update-details-header">
      <div className="update-channel-bar">
        <div className="header-left-group">
          <div className="channel-toggle">
            <button
              className={`channel-btn ${channel === 'stable' ? 'active' : ''}`}
              onClick={() => setChannel('stable')}
            >
              Stable
            </button>
            <button
              className={`channel-btn ${channel === 'beta' ? 'active' : ''}`}
              onClick={() => setChannel('beta')}
            >
              Beta
            </button>
          </div>
        </div>

        <div className="header-action-wrap">
          {status === 'available' ? (
            <button
              className="header-action-btn update-download-btn"
              onClick={download}
            >
              <Download size={12} />
              <span>Download</span>
            </button>
          ) : status === 'downloading' ? (
            <button
              className="header-action-btn downloading-btn"
              style={{ cursor: 'default' }}
            >
              <Loader2 size={12} className="spin-animation" />
              <span>{safePercent}%</span>
            </button>
          ) : status === 'ready' ? (
            <button
              className="header-action-btn update-ready-btn"
              onClick={install}
            >
              <CheckCircle2 size={12} />
              <span>Restart & Install</span>
            </button>
          ) : status === 'checking' ? (
            <button
              className="header-action-btn checking-btn"
              disabled
              style={{ cursor: 'default' }}
            >
              <RefreshCw size={11} className="spin-animation" />
              <span>Checking...</span>
            </button>
          ) : status === 'not-available' ? (
            <button
              className="header-action-btn check-update-btn is-up-to-date"
              onClick={check}
            >
              <CheckCircle2 size={12} />
              <span>Up to date</span>
            </button>
          ) : status === 'error' ? (
            <button
              className="header-action-btn check-update-btn error-btn"
              onClick={check}
            >
              <RefreshCw size={11} />
              <span>Retry</span>
            </button>
          ) : (
            <button
              className="header-action-btn check-update-btn"
              onClick={check}
            >
              <RefreshCw size={11} />
              <span>Check for Updates</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default UpdateHeader
