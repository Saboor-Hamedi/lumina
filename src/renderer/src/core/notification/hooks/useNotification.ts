import { useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  message: string
  type: ToastType
}

export interface UseNotificationReturn {
  toast: ToastItem | null
  showToast: (message: string, type?: ToastType) => void
  clearToast: () => void
}

export const useNotification = (): UseNotificationReturn => {
  const [toast, setToast] = useState<ToastItem | null>(null)

  /**
   * Displays a toast notification.
   */
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  /**
   * Clears the current toast notification.
   */
  const clearToast = useCallback(() => {
    setToast(null)
  }, [])

  return { toast, showToast, clearToast }
}

export const useToast = useNotification
export default useNotification
