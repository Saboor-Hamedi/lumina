import { useState, useCallback, RefObject, ChangeEvent } from 'react'
import { SLASH_COMMANDS } from '../LuminaSlash'

/**
 * Command item representation for slash commands (e.g., /plan, /code, /web).
 */
export interface SlashCommandItem {
  id?: string
  name?: string
  label?: string
  description?: string
  desc?: string
  icon?: React.ReactNode
  insertText?: string
  isAction?: boolean
  aliases?: string[]
  action?: (setMode?: any, context?: any) => void
  [key: string]: unknown
}

/**
 * File / note snippet representation for @ mentions.
 */
export interface MentionSnippetItem {
  id: string | number
  title?: string
  path?: string
  content?: string
  [key: string]: unknown
}

export interface UseComposerAutocompleteProps {
  input: string
  setInput: (value: string | ((prev: string) => string)) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  setMode?: (mode: string) => void
  mode?: string
  onSend?: (text: string, mode: string, attachedMentions: any[]) => void
}

export interface UseComposerAutocompleteReturn {
  showSlashMenu: boolean
  setShowSlashMenu: React.Dispatch<React.SetStateAction<boolean>>
  slashFilter: string
  showMentionMenu: boolean
  setShowMentionMenu: React.Dispatch<React.SetStateAction<boolean>>
  mentionFilter: string
  attachedMentions: MentionSnippetItem[]
  setAttachedMentions: React.Dispatch<React.SetStateAction<MentionSnippetItem[]>>
  handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  handleCommandSelect: (cmd: any) => void
  handleMentionSelect: (snippet: any) => void
  removeMention: (snippetId: string | number) => void
}

/**
 * Hook for managing slash command (`/`) and file mention (`@`) autocomplete menus in Composer.
 * Detects trigger keystrokes, tracks query filters, and manages injected context chips.
 */
export const useComposerAutocomplete = ({
  input,
  setInput,
  textareaRef,
  setMode,
  mode,
  onSend
}: UseComposerAutocompleteProps): UseComposerAutocompleteReturn => {
  const [showSlashMenu, setShowSlashMenu] = useState<boolean>(false)
  const [slashFilter, setSlashFilter] = useState<string>('')
  const [showMentionMenu, setShowMentionMenu] = useState<boolean>(false)
  const [mentionFilter, setMentionFilter] = useState<string>('')
  const [attachedMentions, setAttachedMentions] = useState<MentionSnippetItem[]>([])

  /**
   * Evaluates current input changes to trigger slash or mention menus.
   */
  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value
      setInput(newVal)

      // Detect /command trigger at start of text or following whitespace
      const slashMatch = newVal.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/)
      if (slashMatch) {
        const filter = slashMatch[1].toLowerCase()
        setSlashFilter(filter)
        const hasMatches = SLASH_COMMANDS.some(
          (cmd) =>
            cmd.id.toLowerCase().includes(filter) ||
            cmd.label.toLowerCase().includes(filter) ||
            (cmd.aliases && cmd.aliases.some((a) => a.toLowerCase().includes(filter)))
        )
        setShowSlashMenu(hasMatches)
      } else {
        setShowSlashMenu(false)
      }

      // Detect @mention trigger at start of text or following whitespace
      const mentionMatch = newVal.match(/(?:^|\s)@([^\s]*)$/)
      if (mentionMatch) {
        setMentionFilter(mentionMatch[1])
        setShowMentionMenu(true)
      } else {
        setShowMentionMenu(false)
      }
    },
    [setInput]
  )

  /**
   * Executes command selection and strips the slash command prefix from the input.
   */
  const handleCommandSelect = useCallback(
    (cmd: SlashCommandItem) => {
      setShowSlashMenu(false)

      if (cmd?.isAction && onSend) {
        setInput('')
        setAttachedMentions([])
        onSend(cmd.insertText || `/${cmd.id}`, mode || 'Code', attachedMentions)
        return
      }

      if (cmd && cmd.action && setMode) {
        cmd.action(setMode, { setInput })
      }
      if (cmd?.insertText !== undefined) {
        const textToInsert = cmd.insertText
        const match = input.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/)
        if (match && match.index !== undefined) {
          const matchIndex = match.index + (match[0].startsWith(' ') ? 1 : 0)
          const preserved = input.slice(0, matchIndex)
          const newText = preserved + textToInsert
          setInput(newText)
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus()
              textareaRef.current.setSelectionRange(newText.length, newText.length)
            }
          }, 0)
        } else {
          setInput(textToInsert)
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus()
              textareaRef.current.setSelectionRange(textToInsert.length, textToInsert.length)
            }
          }, 0)
        }
      } else {
        const match = input.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/)
        if (match && match.index !== undefined) {
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
      }
    },
    [input, setInput, textareaRef, setMode, mode, onSend, attachedMentions, setAttachedMentions]
  )

  /**
   * Inserts the @mention tag at the cursor and registers the file in attachedMentions.
   */
  const handleMentionSelect = useCallback(
    (snippet: MentionSnippetItem) => {
      const textarea = textareaRef.current
      const cursor = textarea ? textarea.selectionStart : input.length
      const textBeforeCursor = input.slice(0, cursor)
      const textAfterCursor = input.slice(cursor)

      const match = textBeforeCursor.match(/(?:^|\s)@([^\s]*)$/)
      const mentionTitle = snippet.title || 'Untitled'
      const mentionText = `@${mentionTitle} `

      let newVal = ''
      let newCursorPos = 0

      if (match && match.index !== undefined) {
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
    },
    [input, setInput, textareaRef]
  )

  /**
   * Removes an attached mention badge.
   */
  const removeMention = useCallback((snippetId: string | number) => {
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
