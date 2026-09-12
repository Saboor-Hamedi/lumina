import { useState, useEffect, useCallback, useRef } from 'react'
import { useCurrentUser } from '../../../core/hooks/useCurrentUser'
import { EmailFolder, EmailMessageSummary, EmailMessageDetails, EmailComposeDraft, EmailAttachment, EmailLabelItem } from '../types'
import { compileDraftToHtml } from '../services/emailMarkdownService'

export function useEmailClient() {
  const { user: googleUser, isLoggedIn, login } = useCurrentUser()
  const [currentFolder, setCurrentFolder] = useState<EmailFolder>('INBOX')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [emails, setEmails] = useState<EmailMessageSummary[]>([])
  const [userLabels, setUserLabels] = useState<EmailLabelItem[]>([])
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [activeEmailDetails, setActiveEmailDetails] = useState<EmailMessageDetails | null>(null)
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false)
  const [isSending, setIsSending] = useState<boolean>(false)
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  // Draft state
  const [draft, setDraft] = useState<EmailComposeDraft>({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    bodyHtml: '',
    attachments: []
  })

  // Refetch emails list
  const fetchEmails = useCallback(async (folder: EmailFolder = currentFolder, query: string = searchQuery) => {
    if (!window.api?.listEmails) return
    setIsLoadingList(true)
    setErrorMessage(null)

    try {
      const res = await window.api.listEmails({
        labelIds: [folder],
        q: query || undefined,
        maxResults: 30
      })

      if (res?.error) {
        setErrorMessage(res.error)
        setEmails([])
      } else {
        setEmails(res?.messages || [])
        // Auto-select first email if none selected
        setSelectedEmailId((curr) => {
          if (!curr && (res?.messages || []).length > 0) {
            return res.messages[0].id
          }
          return curr
        })
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to fetch emails')
    } finally {
      setIsLoadingList(false)
    }
  }, [currentFolder, searchQuery])

  // Fetch full details of selected email
  useEffect(() => {
    if (!selectedEmailId || !window.api?.getEmailDetails) {
      setActiveEmailDetails(null)
      return
    }

    let isMounted = true
    setIsLoadingDetails(true)
    setErrorMessage(null)

    window.api.getEmailDetails({ id: selectedEmailId }).then((res: any) => {
      if (!isMounted) return
      setIsLoadingDetails(false)
      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setActiveEmailDetails(res)
        // Auto mark as read in local list if it was unread
        setEmails((prev) =>
          prev.map((m) => (m.id === selectedEmailId ? { ...m, isUnread: false } : m))
        )
        // Mark as read on Gmail server
        if (res?.isUnread && window.api?.modifyEmailLabels) {
          window.api.modifyEmailLabels({
            id: selectedEmailId,
            removeLabelIds: ['UNREAD']
          }).then(() => {
            window.dispatchEvent(new CustomEvent('refresh-unread-count'))
          })
        }
      }
    }).catch((err: any) => {
      if (isMounted) {
        setIsLoadingDetails(false)
        setErrorMessage(err?.message || 'Failed to load email')
      }
    })

    return () => {
      isMounted = false
    }
  }, [selectedEmailId])

  // Toggle starred status
  const toggleStar = useCallback(async (msg: EmailMessageSummary, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!window.api?.modifyEmailLabels) return

    const newStarred = !msg.isStarred
    setEmails((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, isStarred: newStarred } : m))
    )
    if (activeEmailDetails?.id === msg.id) {
      setActiveEmailDetails((prev) => prev ? { ...prev, isStarred: newStarred } : null)
    }

    await window.api.modifyEmailLabels({
      id: msg.id,
      addLabelIds: newStarred ? ['STARRED'] : [],
      removeLabelIds: newStarred ? [] : ['STARRED']
    })
  }, [activeEmailDetails])

  // Mark as unread/read
  const toggleUnread = useCallback(async (msg: EmailMessageSummary, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!window.api?.modifyEmailLabels) return

    const newUnread = !msg.isUnread
    setEmails((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, isUnread: newUnread } : m))
    )
    if (activeEmailDetails?.id === msg.id) {
      setActiveEmailDetails((prev) => prev ? { ...prev, isUnread: newUnread } : null)
    }

    await window.api.modifyEmailLabels({
      id: msg.id,
      addLabelIds: newUnread ? ['UNREAD'] : [],
      removeLabelIds: newUnread ? [] : ['UNREAD']
    })
    window.dispatchEvent(new CustomEvent('refresh-unread-count'))
  }, [activeEmailDetails])

  // Delete / Trash email
  const deleteEmail = useCallback(async (msgId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (!window.api?.trashEmail) return

    // Optimistically remove from local email list and select adjacent email
    setEmails((prev) => {
      const idx = prev.findIndex((m) => m.id === msgId)
      const remaining = prev.filter((m) => m.id !== msgId)

      setSelectedEmailId((curr) => {
        if (curr !== msgId) return curr
        if (remaining.length === 0) return null
        const nextIdx = Math.min(idx, remaining.length - 1)
        return remaining[nextIdx]?.id || null
      })

      return remaining
    })

    try {
      const res = await window.api.trashEmail({ id: msgId })
      if (res?.error) {
        setErrorMessage(`Failed to delete email: ${res.error}`)
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete email')
    }
  }, [])

  // Send draft email
  const sendCurrentDraft = useCallback(async () => {
    if (!window.api?.sendEmail) return
    if (!draft.to.trim()) {
      const msg = 'Please specify at least one recipient.'
      setErrorMessage(msg)
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: { message: msg, type: 'error' }
        })
      )
      return
    }

    setIsSending(true)
    setErrorMessage(null)

    try {
      const finalBody = compileDraftToHtml(draft.bodyHtml, draft.quotedText)

      const recipient = draft.to
      const subject = draft.subject ? `"${draft.subject}"` : 'Email'

      const res = await window.api.sendEmail({
        to: draft.to,
        cc: draft.cc,
        bcc: draft.bcc,
        subject: draft.subject || '(No Subject)',
        bodyHtml: finalBody,
        attachments: draft.attachments,
        threadId: draft.threadId || undefined,
        inReplyTo: draft.inReplyTo || undefined,
        references: draft.references || undefined
      })

      if (res?.error) {
        const errorMsg = res.error || 'Failed to send email'
        setErrorMessage(errorMsg)
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: { message: `Email failed to send: ${errorMsg}`, type: 'error' }
          })
        )
        if (window.api?.showEmailNotification) {
          window.api.showEmailNotification({
            title: 'Email Failed to Send',
            body: errorMsg
          })
        } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('Email Failed to Send', { body: errorMsg })
          } catch {}
        }
      } else {
        setIsComposeOpen(false)
        setDraft({
          to: '',
          cc: '',
          bcc: '',
          subject: '',
          bodyHtml: '',
          attachments: [],
          threadId: null,
          inReplyTo: '',
          references: ''
        })
        setSuccessToast('Email sent successfully!')
        setTimeout(() => setSuccessToast(null), 3000)

        // Show success notification (toast + native notification)
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: { message: 'Email sent successfully', type: 'success' }
          })
        )
        if (window.api?.showEmailNotification) {
          window.api.showEmailNotification({
            title: 'Email Sent',
            body: `Your message ${subject} to ${recipient} was sent successfully.`
          })
        } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('Email Sent', { body: `Your message ${subject} to ${recipient} was sent successfully.` })
          } catch {}
        }

        // Refresh Sent folder or current list
        if (currentFolder === 'SENT') {
          fetchEmails('SENT')
        }
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to send email'
      setErrorMessage(errorMsg)
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: { message: `Email failed to send: ${errorMsg}`, type: 'error' }
        })
      )
      if (window.api?.showEmailNotification) {
        window.api.showEmailNotification({
          title: 'Email Failed to Send',
          body: errorMsg
        })
      } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Email Failed to Send', { body: errorMsg })
        } catch {}
      }
    } finally {
      setIsSending(false)
    }
  }, [draft, currentFolder, fetchEmails])

  // Attach local files via native dialog
  const addAttachments = useCallback(async () => {
    if (!window.api?.pickEmailAttachments) return
    const res = await window.api.pickEmailAttachments()
    if (res?.attachments && res.attachments.length > 0) {
      setDraft((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...res.attachments]
      }))
    }
  }, [])

  // Attach active note as markdown
  const attachNote = useCallback((noteTitle: string, noteContent: string) => {
    const filename = `${noteTitle || 'Note'}.md`
    const base64 = btoa(unescape(encodeURIComponent(noteContent || '')))
    const att: EmailAttachment = {
      filename,
      mimeType: 'text/markdown',
      size: noteContent.length,
      base64Content: base64
    }
    setDraft((prev) => ({
      ...prev,
      attachments: [...prev.attachments, att]
    }))
  }, [])

  // Reply to an email in the same thread
  const replyToEmail = useCallback((emailDetails: EmailMessageDetails) => {
    // Determine clean sender and recipient addresses
    const extractEmail = (str: string) => {
      if (!str) return ''
      const match = str.match(/<([^>]+)>/)
      return (match && match[1] ? match[1] : str).trim()
    }

    const senderEmail = extractEmail(emailDetails.from)
    const myEmail = (googleUser?.email || '').trim().toLowerCase()

    // If this message was sent by the user themselves, reply to the recipient in `to`, not to own self!
    let replyTo = senderEmail
    if (myEmail && senderEmail.toLowerCase() === myEmail && emailDetails.to) {
      replyTo = extractEmail(emailDetails.to)
    }

    const subjectPrefix = emailDetails.subject.toLowerCase().startsWith('re:') ? '' : 'Re: '
    const replySubject = `${subjectPrefix}${emailDetails.subject}`

    const inReplyTo = emailDetails.messageIdHeader || ''
    const references = emailDetails.referencesHeader 
      ? `${emailDetails.referencesHeader} ${inReplyTo}`.trim()
      : inReplyTo

    // Build clean quoted text
    const dateStr = emailDetails.date || ''
    const quoteHeader = `---------- On ${dateStr}, ${emailDetails.from} wrote: ----------`
    const quoteContent = emailDetails.snippet ? emailDetails.snippet : ''
    const quotedBlock = `${quoteHeader}\n${quoteContent}`

    setDraft({
      to: replyTo,
      cc: '',
      bcc: '',
      subject: replySubject,
      bodyHtml: '',
      quotedText: quotedBlock,
      attachments: [],
      threadId: emailDetails.threadId || null,
      inReplyTo,
      references
    })
    setIsComposeOpen(true)
  }, [googleUser])

  // Remove attachment
  const removeAttachment = useCallback((index: number) => {
    setDraft((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }, [])

  // Fetch all Gmail labels
  const fetchLabels = useCallback(async () => {
    if (!window.api?.listEmailLabels) return
    try {
      const res = await window.api.listEmailLabels()
      if (res?.labels) {
        const userOnly = res.labels
          .filter((l: any) => l.type === 'user')
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
        setUserLabels(userOnly)
      }
    } catch (err) {
      console.warn('Failed to fetch Gmail labels:', err)
    }
  }, [])

  // Track previously authenticated user email to prevent leaking emails across accounts
  const prevUserEmailRef = useRef<string | null>(null)

  // Reset all state when user logs out or account changes
  useEffect(() => {
    const currentEmail = googleUser?.email || null
    if (!isLoggedIn || (prevUserEmailRef.current && prevUserEmailRef.current !== currentEmail)) {
      setEmails([])
      setSelectedEmailId(null)
      setActiveEmailDetails(null)
      setUserLabels([])
      setCurrentFolder('INBOX')
      setSearchQuery('')
      setErrorMessage(null)
      setDraft({
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        bodyHtml: '',
        attachments: []
      })
    }
    prevUserEmailRef.current = currentEmail
  }, [isLoggedIn, googleUser?.email])

  // Initial and reactive load
  useEffect(() => {
    if (isLoggedIn) {
      fetchEmails(currentFolder, searchQuery)
      fetchLabels()
    }
  }, [isLoggedIn, currentFolder, fetchEmails, fetchLabels])

  return {
    googleUser,
    isLoggedIn,
    login,
    currentFolder,
    setCurrentFolder,
    searchQuery,
    setSearchQuery,
    emails,
    userLabels,
    fetchLabels,
    selectedEmailId,
    setSelectedEmailId,
    activeEmailDetails,
    isLoadingList,
    isLoadingDetails,
    isSending,
    isComposeOpen,
    setIsComposeOpen,
    errorMessage,
    setErrorMessage,
    successToast,
    draft,
    setDraft,
    fetchEmails,
    toggleStar,
    toggleUnread,
    deleteEmail,
    replyToEmail,
    sendCurrentDraft,
    addAttachments,
    attachNote,
    removeAttachment
  }
}
