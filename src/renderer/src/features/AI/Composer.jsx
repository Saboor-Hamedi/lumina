import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  Send,
  Square,
  Sparkles,
  ChevronDown,
  Brain,
  Zap,
  Palette,
  Code,
  Globe,
  Sliders,
  Paperclip,
  Check
} from 'lucide-react'
import { LuminaSlash } from './LuminaSlash'
import LuminaMention from './LuminaMention'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useVaultStore } from '../../core/store/workspaceStore'
import ToolTip from '../../components/atoms/ToolTip'
import './Composer.css'

export const Composer = ({ onSend, onStop, onCancel, isLoading = false }) => {
  const [input, setInput] = useState('')
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [showMentionMenu, setShowMentionMenu] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [attachedMentions, setAttachedMentions] = useState([])

  const handleStop = onStop || onCancel

  const textareaRef = useRef(null)
  const backdropRef = useRef(null)

  const snippets = useVaultStore((state) => state.snippets) || []

  const mentionRegex = useMemo(() => {
    const titles = snippets
      .map((s) => s.title)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

    if (titles.length > 0) {
      return new RegExp(`(@(?:${titles.join('|')}|[a-zA-Z0-9_\\-./]+))`, 'gi')
    }
    return /(@[a-zA-Z0-9_\-./]+)/g
  }, [snippets])

  const { settings, updateSettings } = useSettingsStore()
  const mode = settings.activeAIMode || 'Standard'
  const setMode = (newMode) => updateSettings({ activeAIMode: newMode })

  // Auto-resize textarea with requestAnimationFrame
  useEffect(() => {
    if (!textareaRef.current) return

    let rafId = requestAnimationFrame(() => {
      if (!textareaRef.current) return
      textareaRef.current.style.height = 'auto'
      const nextHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 44), 160)
      textareaRef.current.style.height = `${nextHeight}px`
      textareaRef.current.style.overflowY =
        textareaRef.current.scrollHeight > 160 ? 'auto' : 'hidden'
      if (backdropRef.current) {
        backdropRef.current.style.height = `${nextHeight}px`
      }
    })

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [input])

  const handleScroll = useCallback(() => {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  const prevIsLoading = useRef(isLoading)
  useEffect(() => {
    if (prevIsLoading.current === true && isLoading === false) {
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 10)
    }
    prevIsLoading.current = isLoading
  }, [isLoading])

  // Focus textarea on Ctrl+Shift+\ or focus-ai-composer event
  useEffect(() => {
    const handleFocusShortcut = (e) => {
      const key = e.key && e.key.toLowerCase()
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (key === '\\' || key === '|' || e.code === 'Backslash')
      ) {
        e.preventDefault()
        if (textareaRef.current) {
          textareaRef.current.focus()
          const len = textareaRef.current.value.length
          textareaRef.current.setSelectionRange(len, len)
        }
      }
    }

    const handleCustomFocus = () => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const len = textareaRef.current.value.length
        textareaRef.current.setSelectionRange(len, len)
      }
    }

    window.addEventListener('keydown', handleFocusShortcut, { capture: true })
    window.addEventListener('focus-ai-composer', handleCustomFocus)

    // Autofocus on mount
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }, 80)

    return () => {
      window.removeEventListener('keydown', handleFocusShortcut, { capture: true })
      window.removeEventListener('focus-ai-composer', handleCustomFocus)
      clearTimeout(timer)
    }
  }, [])

  const handleOnChange = (e) => {
    const newVal = e.target.value
    setInput(newVal)

    // Check for slash command at the very start
    if (newVal.startsWith('/')) {
      setSlashFilter(newVal.slice(1))
      setShowSlashMenu(true)
    } else {
      setShowSlashMenu(false)
    }

    // Check for @mention trigger
    const mentionMatch = newVal.match(/(?:^|\s)@([^\s]*)$/)
    if (mentionMatch) {
      setMentionFilter(mentionMatch[1])
      setShowMentionMenu(true)
    } else {
      setShowMentionMenu(false)
    }
  }

  const handleCommandSelect = (cmd) => {
    cmd.action(setMode, setInput)
    if (cmd.id !== 'image') setInput('')
    setShowSlashMenu(false)
  }

  const handleMentionSelect = (snippet) => {
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

    if (!attachedMentions.find((s) => s.id === snippet.id)) {
      setAttachedMentions((prev) => [...prev, snippet])
    }

    setShowMentionMenu(false)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }

  const handleKeyDown = (e) => {
    if (showSlashMenu || showMentionMenu) {
      if (e.key === 'Enter') {
        e.preventDefault()
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    onSend(input, mode, attachedMentions)
    setInput('')
    setAttachedMentions([])
  }

  const getProviderLabel = () => {
    switch (settings.activeProvider) {
      case 'openai':
        return '🤖 GPT-4o'
      case 'anthropic':
        return '🧠 Claude'
      case 'ollama':
        return '🦙 Ollama'
      default:
        return '🐋 DeepSeek'
    }
  }

  const toggleProvider = () => window.dispatchEvent(new CustomEvent('open-ai-settings'))

  const modes = [
    { id: 'Fast', icon: <Zap size={13} />, title: 'Fast mode' },
    { id: 'Thinking', icon: <Brain size={13} />, title: 'Thinking mode' },
    { id: 'Creative', icon: <Palette size={13} />, title: 'Creative mode' },
    { id: 'Coder', icon: <Code size={13} />, title: 'Coder mode' }
  ]

  return (
    <div className="composer-container">
      <LuminaSlash
        isOpen={showSlashMenu}
        filterText={slashFilter}
        onSelect={handleCommandSelect}
        onClose={() => setShowSlashMenu(false)}
      />

      <LuminaMention
        isOpen={showMentionMenu}
        filterText={mentionFilter}
        onSelect={handleMentionSelect}
        onClose={() => setShowMentionMenu(false)}
      />

      {/* Unified Card */}
      <div className="composer-card" onClick={() => textareaRef.current?.focus()}>
        <div className="composer-input-area-wrapper">
          {/* Synchronized color backdrop for colored @mentions */}
          <div ref={backdropRef} className="composer-backdrop" aria-hidden="true">
            {(() => {
              if (!input) return null
              const parts = input.split(mentionRegex)
              const rendered = parts.map((part, idx) => {
                if (part.startsWith('@') && part.length > 1) {
                  return (
                    <span key={idx} className="composer-mention-token">
                      {part}
                    </span>
                  )
                }
                return part
              })
              if (input.endsWith('\n')) {
                return (
                  <>
                    {rendered}
                    {' '}
                  </>
                )
              }
              return rendered
            })()}
          </div>

          <textarea
            ref={textareaRef}
            className="composer-textarea"
            value={input}
            onChange={handleOnChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            placeholder="Ask AI... type '@' to mention notes, '/' for commands"
            rows={1}
            disabled={isLoading}
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>

        {/* Inner Footer — model, modes, char count, send */}
        <div className="composer-inner-footer">
          {/* Left: model pill + mode toggles */}
          <div className="composer-left">
            <ToolTip text="Change AI model" position="top">
              <button className="model-pill" onClick={toggleProvider}>
                {getProviderLabel()}
                <ChevronDown size={10} />
              </button>
            </ToolTip>
          </div>

          <div className="composer-right">
            {input.trim().length > 0 && (
              <span className="composer-char-count">
                {(() => {
                  const words = input.trim().split(/\s+/).filter(Boolean).length
                  return `${words} ${words === 1 ? 'word' : 'words'}`
                })()}
              </span>
            )}

            {isLoading ? (
              <ToolTip text="Stop generation" position="top">
                <button
                  className="composer-stop-btn"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (handleStop) handleStop()
                  }}
                >
                  <Square size={11} fill="currentColor" />
                </button>
              </ToolTip>
            ) : (
              <ToolTip text="Send (Enter)" position="top">
                <button
                  className="composer-send-btn"
                  onClick={handleSend}
                  disabled={!input.trim()}
                >
                  <Send size={13} />
                </button>
              </ToolTip>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Composer
