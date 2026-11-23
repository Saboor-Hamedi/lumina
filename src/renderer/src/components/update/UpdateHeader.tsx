import React, { useState } from 'react'
import { CheckCircle2, Download, RefreshCw } from 'lucide-react'
import { PulseLoader } from '../PulseLoader'
import type { UpdateStatus, UpdateProgress } from '../../core/store/UpdateSetting'

export interface UpdateHeaderProps {
  currentVersion: string
  newVersion: string
  status: UpdateStatus
  progress?: UpdateProgress | number | null
  download: () => Promise<void> | void
  install: () => Promise<void> | void
  check: () => Promise<void> | void
  onClose?: () => void
}

export const UpdateHeader: React.FC<UpdateHeaderProps> = ({
  currentVersion,
  newVersion,
  status,
  progress,
  download,
  install,
  check
}) => {
  const [channel, setChannel] = useState<'stable' | 'beta'>('stable')

  const percentValue =
    typeof progress === 'number'
      ? progress
      : typeof (progress as any)?.percent === 'number'
        ? (progress as any).percent
        : typeof (progress as any)?.progress === 'number'
          ? (progress as any).progress
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
              <PulseLoader size="xs" inline delayMs={0} message="" tone="current" />
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
          ) : status === 'installing' ? (
            <button
              className="header-action-btn installing-btn"
              disabled
              style={{ cursor: 'default' }}
            >
              <PulseLoader size="xs" inline delayMs={0} message="" tone="current" />
              <span>Installing...</span>
            </button>
          ) : status === 'checking' ? (
            <button
              className="header-action-btn checking-btn"
              disabled
              style={{ cursor: 'default' }}
            >
              <PulseLoader size="xs" inline delayMs={0} message="" tone="current" />
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
