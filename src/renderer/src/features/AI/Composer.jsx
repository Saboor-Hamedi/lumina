import React, { useState, useRef, useEffect } from 'react'
import { Send, Zap, Brain, Palette, Code, Square, ChevronDown, Loader2 } from 'lucide-react'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import './Composer.css'
import { SlashCommandMenu } from './SlashCommandMenu'

export const Composer = ({ onSend, isLoading, onCancel }) => {
  const [input, setInput] = useState('')
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const textareaRef = useRef(null)

  const { settings, updateSettings } = useSettingsStore()
  const mode = settings.activeAIMode || 'Standard'
  const setMode = (newMode) => updateSettings({ activeAIMode: newMode })

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      if (!input.trim()) {
        textareaRef.current.style.height = '38px'
        textareaRef.current.style.overflowY = 'hidden'
      } else {
        textareaRef.current.style.height = 'auto'
        const nextHeight = Math.min(textareaRef.current.scrollHeight, 140)
        textareaRef.current.style.height = `${nextHeight}px`
        textareaRef.current.style.overflowY =
          textareaRef.current.scrollHeight > 140 ? 'auto' : 'hidden'
      }
    }
  }, [input])

  const handleOnChange = (e) => {
    const newVal = e.target.value
    setInput(newVal)
    if (newVal.startsWith('/')) {
      setShowSlashMenu(true)
      setSlashFilter(newVal.slice(1))
    } else {
      setShowSlashMenu(false)
    }
  }

  const handleCommandSelect = (cmd) => {
    cmd.action(setMode, setInput)
    if (cmd.id !== 'image') setInput('')
    setShowSlashMenu(false)
  }

  const handleKeyDown = (e) => {
    if (showSlashMenu) {
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
    onSend(input, mode)
    setInput('')
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
      <SlashCommandMenu
        isOpen={showSlashMenu}
        filterText={slashFilter}
        onSelect={handleCommandSelect}
        onClose={() => setShowSlashMenu(false)}
      />

      {/* Unified Card */}
      <div className="composer-card">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          value={input}
          onChange={handleOnChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI... or type '/' for commands"
          rows={1}
          disabled={isLoading}
        />

        {/* Inner Footer — model, modes, char count, send */}
        <div className="composer-inner-footer">
          {/* Left: model pill + mode toggles */}
          <div className="composer-left">
            <button className="model-pill" onClick={toggleProvider} title="Change AI model">
              {getProviderLabel()}
              <ChevronDown size={10} />
            </button>


          </div>

          {/* Right: char count + send/stop */}
          <div className="composer-right">
            {input.length > 0 && <span className="char-count">{input.length}</span>}
            {mode !== 'Standard' && <span className="mode-badge">{mode}</span>}

            <button
              className={`send-btn ${isLoading ? 'stop' : ''}`}
              onClick={isLoading ? onCancel : handleSend}
              disabled={!isLoading && !input.trim()}
              title={isLoading ? 'Stop generation' : 'Send (Enter)'}
            >
              {isLoading ? (
                <Loader2 size={13} strokeWidth={2.5} className="spin-icon" />
              ) : (
                <Send size={12} strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
