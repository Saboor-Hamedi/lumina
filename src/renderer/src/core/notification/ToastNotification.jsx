import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import './ToastNotification.css'

const ToastNotification = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (toast) {
      setIsVisible(true)
      setIsExiting(false)
    } else {
      setIsExiting(true)
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleClose = () => {
    if (onClose) {
      onClose()
    }
  }

  if (!toast || !isVisible) return null

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
    >
      <div className="toast-content">
        <div className="toast-icon-wrapper">{getIcon()}</div>
        <span className="toast-message">{toast.message}</span>
        <button className="toast-close" onClick={handleClose} aria-label="Close notification">
          <X size={14} />
        </button>
      </div>
    </div>,
    document.body
  )
}

export default ToastNotification
