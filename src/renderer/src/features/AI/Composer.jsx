import React, { useState, useRef, useEffect } from 'react'
import {
  Send, Zap, Brain, Palette, Code, Square,
  ChevronDown
} from 'lucide-react'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import './Composer.css'
import { SlashCommandMenu } from './SlashCommandMenu'

export const Composer = ({ onSend, isLoading, onCancel }) => {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('Standard')
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const textareaRef = useRef(null)

  const { settings } = useSettingsStore()

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
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
      if (e.key === 'Enter') { e.preventDefault(); return }
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
    setMode('Standard')
  }

  const getProviderLabel = () => {
    switch (settings.activeProvider) {
      case 'openai':    return '🤖 GPT-4o'
      case 'anthropic': return '🧠 Claude'
      case 'ollama':    return '🦙 Ollama'
      default:          return '🐋 DeepSeek'
    }
  }

  const toggleProvider = () => window.dispatchEvent(new CustomEvent('open-ai-settings'))

  const modes = [
    { id: 'Fast',     icon: <Zap size={13} />,    title: 'Fast mode' },
    { id: 'Thinking', icon: <Brain size={13} />,  title: 'Thinking mode' },
    { id: 'Creative', icon: <Palette size={13} />, title: 'Creative mode' },
    { id: 'Coder',    icon: <Code size={13} />,   title: 'Coder mode' },
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
          placeholder={`Ask ${getProviderLabel()}… (/ for commands)`}
          rows={1}
          disabled={isLoading}
        />

        {/* Inner Footer — model, modes, char count, send */}
        <div className="composer-inner-footer">

          {/* Left: model pill + mode toggles */}
          <div className="composer-left">
            <button
              className="model-pill"
              onClick={toggleProvider}
              title="Change AI model"
            >
              {getProviderLabel()}
              <ChevronDown size={10} />
            </button>

            <div className="composer-modes">
              {modes.map(m => (
                <button
                  key={m.id}
                  className={`mode-btn ${mode === m.id ? 'active' : ''}`}
                  onClick={() => setMode(mode === m.id ? 'Standard' : m.id)}
                  title={m.title}
                >
                  {m.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Right: char count + send/stop */}
          <div className="composer-right">
            {input.length > 0 && (
              <span className="char-count">{input.length}</span>
            )}
            {mode !== 'Standard' && (
              <span className="mode-badge">{mode}</span>
            )}

            {isLoading ? (
              <button className="send-btn stop" onClick={onCancel} title="Stop generation">
                <Square size={12} />
                <span>Stop</span>
              </button>
            ) : (
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={!input.trim()}
                title="Send (Enter)"
              >
                <Send size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
