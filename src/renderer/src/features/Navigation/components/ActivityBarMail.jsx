import React, { useState, useEffect, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import { Mail } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { useCurrentUser } from '../../../core/hooks/useCurrentUser'
import { EmailContainer, playNewEmailTone } from '../../email'

export const ActivityBarMail = memo(() => {
  const [isMailOpen, setIsMailOpen] = useState(false)
  const [unreadEmailCount, setUnreadEmailCount] = useState(0)
  const prevUnreadCountRef = useRef(-1)
  const { isLoggedIn } = useCurrentUser()

  // Poll for unread emails and trigger desktop notifications if new mail arrives
  useEffect(() => {
    if (!isLoggedIn) {
      setUnreadEmailCount(0)
      prevUnreadCountRef.current = -1
      return
    }

    let isMounted = true

    // Request Web Notification permission if needed
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission()
      } catch {}
    }

    const checkUnread = async () => {
      try {
        if (window.api?.getUnreadEmailCount) {
          const res = await window.api.getUnreadEmailCount()
          if (!isMounted) return
          const newCount = res?.count || 0
          setUnreadEmailCount(newCount)

          // If new unread mail arrived and increased count, trigger notification if not muted
          if (prevUnreadCountRef.current >= 0 && newCount > prevUnreadCountRef.current) {
            const isMuted = localStorage.getItem('lumina_email_notifications') === 'false'
            if (!isMuted) {
              const title = 'New Email'
              const body = 'New Email'

              playNewEmailTone()

              if (window.api?.showEmailNotification) {
                window.api.showEmailNotification({ title, body })
              }
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                  new Notification(title, { body })
                } catch {}
              }
              window.dispatchEvent(
                new CustomEvent('show-toast', {
                  detail: { message: '📬 New Email', type: 'info', duration: 3500 }
                })
              )
            }
          }
          prevUnreadCountRef.current = newCount
        }
      } catch (err) {
        // Silently catch in polling loop
      }
    }

    checkUnread()
    const interval = setInterval(checkUnread, 15000)

    const handleEmailRefresh = () => checkUnread()
    window.addEventListener('refresh-unread-count', handleEmailRefresh)

    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener('refresh-unread-count', handleEmailRefresh)
    }
  }, [isLoggedIn])

  // Listen for open/close email events triggered from shortcuts or notifications
  useEffect(() => {
    const handleOpenEmail = () => setIsMailOpen(true)
    const handleCloseEmail = () => setIsMailOpen(false)
    window.addEventListener('open-email', handleOpenEmail)
    window.addEventListener('close-email', handleCloseEmail)
    return () => {
      window.removeEventListener('open-email', handleOpenEmail)
      window.removeEventListener('close-email', handleCloseEmail)
    }
  }, [])

  return (
    <div className="activity-bar-mail-wrapper" style={{ position: 'relative' }}>
      <ToolTip
        text={unreadEmailCount > 0 ? `Lumina Mail (${unreadEmailCount} unread)` : 'Lumina Mail'}
        position="right"
      >
        <button
          type="button"
          className={`activity-bar-btn mail-btn ${isMailOpen ? 'active' : ''}`}
          onClick={() => setIsMailOpen((prev) => !prev)}
          aria-label="Open Lumina Mail"
        >
          <Mail size={16} />
          {unreadEmailCount > 0 && <span className="mail-unread-badge" />}
        </button>
      </ToolTip>
      {isMailOpen &&
        createPortal(
          <EmailContainer
            isOpen={isMailOpen}
            onClose={() => setIsMailOpen(false)}
            anchor="left"
          />,
          document.body
        )}
    </div>
  )
})

ActivityBarMail.displayName = 'ActivityBarMail'
export default ActivityBarMail
