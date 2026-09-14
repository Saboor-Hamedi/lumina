import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import './css/notification.css'

const Notification = ({ toast, onClose }) => {
  const [activeToast, setActiveToast] = useState(toast)
  const [isVisible, setIsVisible] = useState(!!toast)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (toast) {
      setActiveToast(toast)
      setIsVisible(true)
      setIsExiting(false)
    } else if (activeToast) {
      setIsExiting(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        setActiveToast(null)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleClose = () => {
    if (onClose) {
      onClose()
    }
  }

  if (!activeToast || !isVisible) return null

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={15} />
      case 'error':
        return <XCircle size={15} />
      default:
        return <Info size={15} />
    }
  }

  return createPortal(
    <div
      className={`toast-notification horizontal toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}
      style={{
        color: 'var(--text-main)',
        backgroundColor: 'var(--bg-panel)'
      }}
    >
      <div className="toast-content" style={{ color: 'var(--text-main)' }}>
        <div className="toast-icon-wrapper">{getIcon()}</div>
        <span className="toast-message" style={{ color: 'var(--text-main)' }}>
          {toast.message}
        </span>
        <button className="toast-close" onClick={handleClose} aria-label="Close notification">
          <X size={14} />
        </button>
      </div>
    </div>,
    document.body
  )
}

export { Notification }
export default Notification
