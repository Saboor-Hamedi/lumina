import React, { useEffect, useState } from 'react'
import { Zap, Brain, Palette, Image as ImageIcon, Code, Eraser } from 'lucide-react'
import './SlashCommandMenu.css'

export const SLASH_COMMANDS = [
  { 
    id: 'fast', 
    label: 'Fast Mode', 
    desc: 'Short, concise answers.', 
    icon: <Zap size={14} />,
    action: (setMode) => setMode('Fast')
  },
  { 
    id: 'think', 
    label: 'Thinking Mode', 
    desc: 'Step-by-step reasoning (CoT).', 
    icon: <Brain size={14} />,
    action: (setMode) => setMode('Thinking')
  },
  { 
    id: 'creative', 
    label: 'Creative', 
    desc: 'Storytelling and metaphors.', 
    icon: <Palette size={14} />,
    action: (setMode) => setMode('Creative')
  },
  { 
    id: 'code', 
    label: 'Coder', 
    desc: 'Specialized for programming.', 
    icon: <Code size={14} />,
    action: (setMode) => setMode('Coder')
  },
  { 
    id: 'image', 
    label: 'Generate Image', 
    desc: 'Create visuals locally or via API.', 
    icon: <ImageIcon size={14} />,
    action: (setMode, setInput) => {
       // Just pre-fill input prefix
       setInput('/image ')
    }
  },
  {
    id: 'clear',
    label: 'Clear Chat',
    desc: 'Start a fresh context.',
    icon: <Eraser size={14} />,
    action: () => {
       window.dispatchEvent(new CustomEvent('clear-chat-context'))
    }
  }
]

export const SlashCommandMenu = ({ isOpen, filterText, onSelect, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filteredCommands = SLASH_COMMANDS.filter(cmd => 
    cmd.id.includes(filterText.toLowerCase()) || 
    cmd.label.toLowerCase().includes(filterText.toLowerCase())
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [filterText])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex, onSelect, onClose])

  if (!isOpen || filteredCommands.length === 0) return null

  return (
    <div className="slash-menu-container">
      {filteredCommands.map((cmd, index) => (
        <div 
          key={cmd.id} 
          className={`slash-menu-item ${index === selectedIndex ? 'active' : ''}`}
          onClick={() => onSelect(cmd)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="slash-icon">{cmd.icon}</div>
          <div className="slash-content">
            <span className="slash-label">{cmd.label}</span>
            <span className="slash-desc">{cmd.desc}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
