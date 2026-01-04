import { useState } from 'react'

export const useToast = () => {
  // State now stores an object { message, type }
  const [toast, setToast] = useState(null)

  /**
   * Displays a toast notification.
   * @param {string} message - The content of the toast.
   * @param {'success' | 'error' | 'info'} [type='info'] - The type of toast.
   */
  const showToast = (message, type = 'info') => {
    // Set the state with the message and type
    setToast({ message, type })

    // Clear the toast after 3 seconds
    setTimeout(() => setToast(null), 3000)
  }

  // Return the toast object and the function
  return { toast, showToast }
}
