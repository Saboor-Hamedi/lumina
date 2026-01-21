import React, { useEffect, useState } from 'react'
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
        return <CheckCircle2 size={16} className="toast-icon" />
      case 'error':
        return <XCircle size={16} className="toast-icon" />
      default:
        return <Info size={16} className="toast-icon" />
    }
  }

  return (
    <div className={`toast-notification toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}>
      <div className="toast-content">
        {getIcon()}
        <span className="toast-message">{toast.message}</span>
        <button className="toast-close" onClick={handleClose}><X size={14} /></button>
      </div>
    </div>
  )
}

export default ToastNotification
