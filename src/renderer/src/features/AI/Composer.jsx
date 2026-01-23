import React, { useState, useRef, useEffect } from 'react'
import { 
  Send, Zap, Brain, Palette, Code, Sparkles, 
  ChevronDown, Paperclip, Image as ImageIcon
} from 'lucide-react'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useAIStore } from '../../core/store/useAIStore'
import './Composer.css'
import { SlashCommandMenu } from './SlashCommandMenu'

export const Composer = ({ onSend, isLoading, onCancel }) => {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('Standard')
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashFilter, setSlashFilter] = useState('')
  const textareaRef = useRef(null)
  
  const { settings } = useSettingsStore()
  const { generateImage } = useAIStore()

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleOnChange = (e) => {
    const newVal = e.target.value
    setInput(newVal)
    
    // Slash Command Detection
    if (newVal.startsWith('/')) {
      setShowSlashMenu(true)
      setSlashFilter(newVal.slice(1)) // Remove '/'
    } else {
      setShowSlashMenu(false)
    }
  }

  const handleCommandSelect = (cmd) => {
    cmd.action(setMode, setInput)
    // Clear input command text if it was a mode switch
    if (cmd.id !== 'image') {
       setInput('')
    }
    setShowSlashMenu(false)
  }

  const handleKeyDown = (e) => {
    // Let SlashMenu handle its own keys if open
    if (showSlashMenu) {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
        // Prevent default only if we want to block textarea behavior, 
        // but SlashMenu event listener is global window, so we might duplicate events.
        // Actually SlashMenu usage of window listener is risky if multiple composers exist.
        // Better to handle keys here if possible, but for now let's rely on the menu's listener 
        // OR pass the event down.
        // Since SlashMenu uses window listener, we don't need to do much here, 
        // EXCEPT prevent 'Enter' from sending the message.
        if (e.key === 'Enter') {
          e.preventDefault() 
          return
        }
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    
    let finalPrompt = input
    
    // Image Generation Check
    if (input.startsWith('/image') || input.startsWith('/img')) {
       // Handled by parent or store, but we pass it through
    }
    
    onSend(finalPrompt, mode)
    setInput('')
    setMode('Standard')
  }

  const getProviderIcon = () => {
    switch (settings.activeProvider) {
      case 'openai': return '🤖 GPT-4o'
      case 'anthropic': return '🧠 Claude'
      case 'ollama': return '🦙 Ollama'
      default: return '🐋 DeepSeek'
    }
  }
  
  const toggleProvider = () => {
    window.dispatchEvent(new CustomEvent('open-ai-settings'))
  }

  return (
    <div className="composer-container">
      <SlashCommandMenu 
        isOpen={showSlashMenu} 
        filterText={slashFilter}
        onSelect={handleCommandSelect}
        onClose={() => setShowSlashMenu(false)}
      />

      {/* 1. Control Bar */}
      <div className="composer-controls">
        <div 
          className="model-selector" 
          onClick={toggleProvider}
          title="Click to change AI Brain"
        >
          <span>{getProviderIcon()}</span>
          <ChevronDown size={10} />
        </div>

        <div className="composer-modes">
          <button 
            className={`mode-toggle ${mode === 'Fast' ? 'active' : ''}`}
            onClick={() => setMode(mode === 'Fast' ? 'Standard' : 'Fast')}
            title="Fast Mode (Concise)"
          >
            <Zap size={14} />
          </button>
          <button 
            className={`mode-toggle ${mode === 'Thinking' ? 'active' : ''}`}
            onClick={() => setMode(mode === 'Thinking' ? 'Standard' : 'Thinking')}
            title="Thinking Mode (CoT)"
          >
            <Brain size={14} />
          </button>
          <button 
            className={`mode-toggle ${mode === 'Creative' ? 'active' : ''}`}
            onClick={() => setMode(mode === 'Creative' ? 'Standard' : 'Creative')}
            title="Creative Mode"
          >
            <Palette size={14} />
          </button>
          <button 
            className={`mode-toggle ${mode === 'Coder' ? 'active' : ''}`}
            onClick={() => setMode(mode === 'Coder' ? 'Standard' : 'Coder')}
            title="Coder Mode"
          >
            <Code size={14} />
          </button>
        </div>
      </div>

      {/* 2. Input Area */}
      <div className="composer-input-wrapper">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          value={input}
          onChange={handleOnChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${getProviderIcon()} (Type '/' for commands)...`}
          rows={1}
          disabled={isLoading}
        />
      </div>

      {/* 3. Footer */}
      <div className="composer-footer">
        <div className="token-count">
           {input.length > 0 && `${input.length} chars`} {mode !== 'Standard' && `• ${mode} Mode`}
        </div>
        
        {isLoading ? (
          <button className="send-btn" onClick={onCancel} style={{ background: '#ef4444' }}>
            <span style={{ fontSize: '12px' }}>⏹ Stop</span>
          </button>
        ) : (
          <button 
            className="send-btn" 
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <span>Send</span>
            <Send size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
