import React, { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const ToastNotification = ({ toast }) => {
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

  if (!toast || !isVisible) return null

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={18} className="toast-icon" />
      case 'error':
        return <XCircle size={18} className="toast-icon" />
      default:
        return <Info size={18} className="toast-icon" />
    }
  }

  return (
    <div className={`toast toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}>
      <div className="toast-content">
        {getIcon()}
        <span className="toast-message">{toast.message}</span>
      </div>
    </div>
  )
}

export default ToastNotification
