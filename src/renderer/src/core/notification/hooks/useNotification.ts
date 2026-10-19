import { useState, useCallback, useRef, useEffect } from 'react'

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Displays a toast notification.
   */
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setToast({ message, type })
    timerRef.current = setTimeout(() => {
      setToast(null)
      timerRef.current = null
    }, 3000)
  }, [])

  /**
   * Clears the current toast notification.
   */
  const clearToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setToast(null)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return { toast, showToast, clearToast }
}

export const useToast = useNotification
export default useNotification
