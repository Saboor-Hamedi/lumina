import { useState, useEffect, useCallback, useRef } from 'react'
import { useCurrentUser } from '../../../core/hooks/useCurrentUser'
import { EmailFolder, EmailMessageSummary, EmailMessageDetails, EmailComposeDraft, EmailAttachment } from '../types'

export function useEmailClient() {
  const { user: googleUser, isLoggedIn } = useCurrentUser()
  const [currentFolder, setCurrentFolder] = useState<EmailFolder>('INBOX')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [emails, setEmails] = useState<EmailMessageSummary[]>([])
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
        if ((res?.messages || []).length > 0 && !selectedEmailId) {
          setSelectedEmailId(res.messages[0].id)
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to fetch emails')
    } finally {
      setIsLoadingList(false)
    }
  }, [currentFolder, searchQuery, selectedEmailId])

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
  }, [activeEmailDetails])

  // Delete / Trash email
  const deleteEmail = useCallback(async (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!window.api?.trashEmail) return

    // Immediately remove from local email list
    setEmails((prev) => prev.filter((m) => m.id !== msgId))

    // If currently viewing this email, clear or pick next
    if (selectedEmailId === msgId) {
      setSelectedEmailId((prevSelected) => {
        const remaining = emails.filter((m) => m.id !== msgId)
        return remaining.length > 0 ? remaining[0].id : null
      })
      setActiveEmailDetails(null)
    }

    try {
      const res = await window.api.trashEmail({ id: msgId })
      if (res?.error) {
        setErrorMessage(`Failed to delete email: ${res.error}`)
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete email')
    }
  }, [selectedEmailId, emails])

  // Send draft email
  const sendCurrentDraft = useCallback(async () => {
    if (!window.api?.sendEmail) return
    if (!draft.to.trim()) {
      setErrorMessage('Please specify at least one recipient.')
      return
    }

    setIsSending(true)
    setErrorMessage(null)

    try {
      const res = await window.api.sendEmail({
        to: draft.to,
        cc: draft.cc,
        bcc: draft.bcc,
        subject: draft.subject || '(No Subject)',
        bodyHtml: draft.bodyHtml.replace(/\n/g, '<br/>'),
        attachments: draft.attachments
      })

      if (res?.error) {
        setErrorMessage(res.error)
      } else {
        setIsComposeOpen(false)
        setDraft({
          to: '',
          cc: '',
          bcc: '',
          subject: '',
          bodyHtml: '',
          attachments: []
        })
        setSuccessToast('Email sent successfully!')
        setTimeout(() => setSuccessToast(null), 3000)
        // Refresh Sent folder or current list
        if (currentFolder === 'SENT') {
          fetchEmails('SENT')
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send email')
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

  // Remove attachment
  const removeAttachment = useCallback((index: number) => {
    setDraft((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }, [])

  // Initial load
  useEffect(() => {
    if (isLoggedIn) {
      fetchEmails(currentFolder, searchQuery)
    }
  }, [isLoggedIn, currentFolder, fetchEmails])

  return {
    googleUser,
    isLoggedIn,
    currentFolder,
    setCurrentFolder,
    searchQuery,
    setSearchQuery,
    emails,
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
    sendCurrentDraft,
    addAttachments,
    attachNote,
    removeAttachment
  }
}
