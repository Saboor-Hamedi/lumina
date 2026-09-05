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
  Check,
  Plus,
  X
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

  const { settings, updateSetting } = useSettingsStore()
  const mode = settings.activeAIMode || 'Code'
  const setMode = (newMode) => updateSetting('activeAIMode', newMode)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return

    // Keep height completely steady on initial typing
    el.style.height = 'auto'
    const newHeight = Math.min(Math.max(el.scrollHeight, 44), 160)
    el.style.height = `${newHeight}px`
    el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden'
  }, [input])

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
  }

  const handleCommandSelect = (cmd) => {
    if (cmd && cmd.action) {
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
      if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
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
        return 'GPT-4o'
      case 'anthropic':
        return 'Claude'
      case 'ollama':
        return 'Ollama'
      default:
        return 'DeepSeek'
    }
  }

  const toggleProvider = () => window.dispatchEvent(new CustomEvent('open-ai-settings'))

  return (
    <div className="composer-container">
      <LuminaSlash
        isOpen={showSlashMenu}
        filterText={slashFilter}
        activeMode={mode}
        onSelect={handleCommandSelect}
        onClose={() => setShowSlashMenu(false)}
      />

      <LuminaMention
        isOpen={showMentionMenu}
        filterText={mentionFilter}
        onSelect={handleMentionSelect}
        onClose={() => setShowMentionMenu(false)}
      />

      <div className="composer-card" onClick={() => textareaRef.current?.focus()}>
        <div className="composer-input-area-wrapper">
          <textarea
            ref={textareaRef}
            className="composer-textarea"
            value={input}
            onChange={handleOnChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask Lumina AI... ('@' note, '/' cmd)"
            rows={1}
            disabled={isLoading}
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>

        <div className="composer-inner-footer">
          <div className="composer-left">
            <ToolTip text="Commands & Modes (/)" position="top">
              <button
                type="button"
                className="composer-plus-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowSlashMenu((prev) => !prev)
                  setSlashFilter('')
                  if (textareaRef.current) textareaRef.current.focus()
                }}
                title="Commands & Modes"
              >
                <Plus size={13} />
              </button>
            </ToolTip>

            <ToolTip text="Change AI mode (/)" position="top">
              <button
                type="button"
                className="model-pill"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowSlashMenu((prev) => !prev)
                  setSlashFilter('')
                  if (textareaRef.current) textareaRef.current.focus()
                }}
                style={{
                  color: 'var(--text-accent)',
                  borderColor: 'rgba(var(--text-accent-rgb, 64, 186, 250), 0.25)',
                  background: 'rgba(var(--text-accent-rgb, 64, 186, 250), 0.08)'
                }}
              >
                <span className="model-pill-name">{mode}</span>
                <ChevronDown size={10} className="model-pill-chevron" />
              </button>
            </ToolTip>

            <ToolTip text="Change AI model" position="top">
              <button className="model-pill" onClick={toggleProvider}>
                <span className="model-pill-name">{getProviderLabel()}</span>
                <ChevronDown size={10} className="model-pill-chevron" />
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
