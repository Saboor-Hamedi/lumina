import { useState, useCallback } from 'react'

/**
 * Hook for managing slash command (`/`) and file mention (`@`) autocomplete menus in Composer.
 */
export const useComposerAutocomplete = ({ input, setInput, textareaRef, setMode }) => {
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [showMentionMenu, setShowMentionMenu] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [attachedMentions, setAttachedMentions] = useState([])

  const handleInputChange = useCallback((e) => {
    const newVal = e.target.value
    setInput(newVal)

    const slashMatch = newVal.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/)
    if (slashMatch) {
      setSlashFilter(slashMatch[1])
      setShowSlashMenu(true)
    } else {
      setShowSlashMenu(false)
    }

    const mentionMatch = newVal.match(/(?:^|\s)@([^\s]*)$/)
    if (mentionMatch) {
      setMentionFilter(mentionMatch[1])
      setShowMentionMenu(true)
    } else {
      setShowMentionMenu(false)
    }
  }, [setInput])

  const handleCommandSelect = useCallback((cmd) => {
    if (cmd && cmd.action && setMode) {
      cmd.action(setMode)
    }
    const match = input.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/)
    if (match) {
      const matchIndex = match.index + (match[0].startsWith(' ') ? 1 : 0)
      const preserved = input.slice(0, matchIndex)
      setInput(preserved)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(preserved.length, preserved.length)
        }
      }, 0)
    } else {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          const len = textareaRef.current.value.length
          textareaRef.current.setSelectionRange(len, len)
        }
      }, 0)
    }
    setShowSlashMenu(false)
  }, [input, setInput, textareaRef, setMode])

  const handleMentionSelect = useCallback((snippet) => {
    const textarea = textareaRef.current
    const cursor = textarea ? textarea.selectionStart : input.length
    const textBeforeCursor = input.slice(0, cursor)
    const textAfterCursor = input.slice(cursor)

    const match = textBeforeCursor.match(/(?:^|\s)@([^\s]*)$/)
    const mentionTitle = snippet.title || 'Untitled'
    const mentionText = `@${mentionTitle} `

    let newVal = ''
    let newCursorPos = 0

    if (match) {
      const matchIndex = match.index + (match[0].startsWith(' ') ? 1 : 0)
      newVal = input.slice(0, matchIndex) + mentionText + textAfterCursor
      newCursorPos = matchIndex + mentionText.length
    } else {
      newVal = input + mentionText
      newCursorPos = newVal.length
    }

    setInput(newVal)

    setAttachedMentions((prev) => {
      if (!prev.find((s) => s.id === snippet.id)) {
        return [...prev, snippet]
      }
      return prev
    })

    setShowMentionMenu(false)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }, [input, setInput, textareaRef])

  const removeMention = useCallback((snippetId) => {
    setAttachedMentions((prev) => prev.filter((s) => s.id !== snippetId))
  }, [])

  return {
    showSlashMenu,
    setShowSlashMenu,
    slashFilter,
    showMentionMenu,
    setShowMentionMenu,
    mentionFilter,
    attachedMentions,
    setAttachedMentions,
    handleInputChange,
    handleCommandSelect,
    handleMentionSelect,
    removeMention
  }
}
