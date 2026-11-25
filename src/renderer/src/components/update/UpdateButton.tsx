/**
 * =========================================================================
 * UpdateButton.tsx — Detached TitleBar Update Action Button with Notifications
 * =========================================================================
 *
 * Dedicated top TitleBar update button (detached from ReleaseNotesTab):
 * - Clicking checks for updates and shows Lumina's toast notification:
 *   - Update available -> "New update vX.Y.Z is available — click to download"
 *   - No update available -> "You're up to date — Lumina is on the latest version"
 *   - Error -> "Could not check for updates"
 * - When an update is available, clicking starts the download directly.
 * - When downloaded (ready), switches to the same-shape Restart button to install & restart.
 */

import React, { useEffect, useMemo, useCallback, useRef } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import { useUpdateStore } from '../../core/store/UpdateSetting'
import { PulseLoader } from '../PulseLoader'
import ToolTip from '../atoms/ToolTip'
import './ReleaseNotesTab.css'

export const UpdateButton: React.FC = React.memo(() => {
  const { status, updateInfo, progress, check, download, install } = useUpdateStore()
  const manualCheckTriggeredRef = useRef(false)
  const notifiedVersionRef = useRef<string | null>(null)
  const notifiedReadyRef = useRef<string | null>(null)

  const newVersion = updateInfo?.version || ''
  const percentValue =
    typeof progress === 'number'
      ? progress
      : typeof (progress as any)?.percent === 'number'
        ? (progress as any).percent
        : 0
  const safePercent = isNaN(percentValue) ? 0 : Math.min(100, Math.max(0, Math.round(percentValue)))

  useEffect(() => {
    if (status === 'available') {
      if (manualCheckTriggeredRef.current || (newVersion && notifiedVersionRef.current !== newVersion)) {
        manualCheckTriggeredRef.current = false
        notifiedVersionRef.current = newVersion || 'available'
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: {
              message: newVersion
                ? `Update v${newVersion} is available — click the update button to download.`
                : 'A new update is available — click the update button to download.',
              type: 'info'
            }
          })
        )
      }
    } else if (status === 'not-available') {
      if (manualCheckTriggeredRef.current) {
        manualCheckTriggeredRef.current = false
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: {
              message: 'You are up to date — running the latest version of Lumina.',
              type: 'success'
            }
          })
        )
      }
    } else if (status === 'ready') {
      manualCheckTriggeredRef.current = false
      if (notifiedReadyRef.current !== (newVersion || 'ready')) {
        notifiedReadyRef.current = newVersion || 'ready'
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: {
              message: `Update${newVersion ? ` v${newVersion}` : ''} downloaded — click Restart to install.`,
              type: 'success'
            }
          })
        )
      }
    } else if (status === 'error') {
      if (manualCheckTriggeredRef.current) {
        manualCheckTriggeredRef.current = false
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: {
              message: 'Could not check for updates. Please check your connection.',
              type: 'error'
            }
          })
        )
      }
    }
  }, [status, newVersion])

  const handleClick = useCallback(() => {
    if (status === 'checking' || status === 'downloading' || status === 'installing') return
    if (status === 'ready') {
      void install()
    } else if (status === 'available') {
      void download()
    } else {
      manualCheckTriggeredRef.current = true
      void check()
    }
  }, [status, install, download, check])

  const { icon, label, tooltip, className, ariaLabel } = useMemo(() => {
    if (status === 'installing') {
      return {
        icon: <PulseLoader size="xs" inline delayMs={0} message="" tone="current" />,
        label: 'Installing',
        tooltip: 'Installing update...',
        className: 'has-update is-downloading',
        ariaLabel: 'Installing update'
      }
    }
    if (status === 'ready') {
      return {
        icon: <RotateCcw size={12} strokeWidth={2.1} />,
        label: 'Restart',
        tooltip: `Update${newVersion ? ` v${newVersion}` : ''} ready — click to restart & install`,
        className: 'has-update is-ready',
        ariaLabel: 'Restart and install update'
      }
    }
    if (status === 'downloading') {
      return {
        icon: <PulseLoader size="xs" inline delayMs={0} message="" tone="current" />,
        label: `${safePercent}%`,
        tooltip: `Downloading update (${safePercent}%)...`,
        className: 'has-update is-downloading',
        ariaLabel: 'Downloading update'
      }
    }
    if (status === 'available') {
      return {
        icon: <Download size={12} strokeWidth={2.1} />,
        label: newVersion ? `v${newVersion}` : 'Download',
        tooltip: `Download update${newVersion ? ` v${newVersion}` : ''}`,
        className: 'has-update',
        ariaLabel: 'Download update'
      }
    }
    if (status === 'checking') {
      return {
        icon: <PulseLoader size="xs" inline delayMs={0} message="" tone="current" />,
        label: null,
        tooltip: 'Checking for updates...',
        className: 'is-checking',
        ariaLabel: 'Checking for updates'
      }
    }
    return {
      icon: <Download size={13} strokeWidth={2} />,
      label: null,
      tooltip: 'Check for updates',
      className: '',
      ariaLabel: 'Check for updates'
    }
  }, [status, safePercent, newVersion])

  return (
    <div className="update-details-container">
      <ToolTip text={tooltip} position="bottom">
        <button
          type="button"
          className={`update-trigger-btn ${className}`.trim()}
          onClick={handleClick}
          aria-label={ariaLabel}
          data-testid="unified-update-btn"
        >
          {icon}
          {label && <span>{label}</span>}
        </button>
      </ToolTip>
    </div>
  )
})

UpdateButton.displayName = 'UpdateButton'
export default UpdateButton
