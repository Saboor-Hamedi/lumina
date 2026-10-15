/**
 * ============================================================================
 * Lumina Toast Notification Component (`Notification.tsx`)
 * ============================================================================
 * Clean, lightweight, floating system toast notification.
 * - Hardware-accelerated entrance and exit transitions.
 * - Supports action buttons, custom toast types, and portal rendering.
 * - TypeScript typed with zero stale timer cache.
 * ============================================================================
 */

import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import type { ToastItem } from './hooks/useNotification'
import './css/notification.css'

export interface NotificationProps {
  toast?: ToastItem | null
  onClose?: () => void
}

export const Notification: React.FC<NotificationProps> = ({ toast, onClose }) => {
  const [activeToast, setActiveToast] = useState<ToastItem | null>(toast || null)
  const [isVisible, setIsVisible] = useState<boolean>(Boolean(toast))
  const [isExiting, setIsExiting] = useState<boolean>(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (toast) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
      setActiveToast(toast)
      setIsVisible(true)
      setIsExiting(false)
    } else if (activeToast && isVisible && !isExiting) {
      setIsExiting(true)
      exitTimerRef.current = setTimeout(() => {
        setIsVisible(false)
        setActiveToast(null)
        setIsExiting(false)
        exitTimerRef.current = null
      }, 250)
    }
  }, [toast])

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
      }
    }
  }, [])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      setIsVisible(false)
      setActiveToast(null)
      setIsExiting(false)
      onClose?.()
    }, 200)
  }

  if (!activeToast || !isVisible) return null

  const getIcon = () => {
    switch (activeToast.type) {
      case 'success':
        return <CheckCircle2 size={15} />
      case 'error':
        return <XCircle size={15} />
      case 'warning':
        return <AlertTriangle size={15} />
      default:
        return <Info size={15} />
    }
  }

  const toastType = activeToast.type || 'info'

  return createPortal(
    <div
      role="alert"
      aria-live="polite"
      className={`toast-notification horizontal toast-${toastType} ${isExiting ? 'toast-exit' : ''}`}
      style={{
        color: 'var(--text-main)',
        backgroundColor: 'var(--bg-panel)'
      }}
    >
      <div className="toast-content" style={{ color: 'var(--text-main)' }}>
        <div className="toast-icon-wrapper">{getIcon()}</div>
        <span className="toast-message" style={{ color: 'var(--text-main)' }}>
          {activeToast.message}
        </span>
        {activeToast.action && (
          <button
            type="button"
            className="toast-action-btn"
            onClick={() => {
              activeToast.action?.onClick()
              handleClose()
            }}
          >
            {activeToast.action.label}
          </button>
        )}
        <button
          type="button"
          className="toast-close"
          onClick={handleClose}
          aria-label="Close notification"
        >
          <X size={14} />
        </button>
      </div>
    </div>,
    document.body
  )
}

export default Notification
