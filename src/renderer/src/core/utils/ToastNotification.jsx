import React from 'react'
const ToastNotification = ({ toast }) => {
  // If toast is null, don't render anything
  if (!toast) return null
  // Apply dynamic classes based on the toast type
  return <div className={`toast toast-base toast-${toast.type}`}>{toast.message}</div>
}

export default ToastNotification
