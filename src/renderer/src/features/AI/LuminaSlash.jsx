import React, { useEffect, useState } from 'react'
import { Zap, Brain, Palette, Image as ImageIcon, Code, Eraser, Check } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import './luminSlash.css'

export const SLASH_COMMANDS = [
  {
    id: 'plan',
    label: 'Plan',
    desc: 'Smart planning, outlines, and architectural design.',
    icon: <Zap size={14} />,
    action: (setMode) => setMode('Plan')
  },
  {
    id: 'deep',
    label: 'Deep',
    desc: 'Deep step-by-step reasoning (CoT).',
    icon: <Brain size={14} />,
    action: (setMode) => setMode('Deep')
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
    label: 'Code',
    desc: 'Specialized for programming and file execution.',
    icon: <Code size={14} />,
    action: (setMode) => setMode('Code')
  }
]

export const LuminaSlash = ({ isOpen, filterText, activeMode = 'Code', onSelect, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useKeyboardShortcuts({
    onEscape: isOpen
      ? (e) => {
          if (e) {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
          }
          onClose()
          return true
        }
      : null
  })

  const filteredCommands = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.id.includes(filterText.toLowerCase()) ||
      cmd.label.toLowerCase().includes(filterText.toLowerCase())
  )

  useEffect(() => {
    // If opening without filter, default selected index to the current active mode
    const activeIdx = filteredCommands.findIndex(
      (c) => c.label.toLowerCase() === (activeMode || '').toLowerCase()
    )
    setSelectedIndex(activeIdx >= 0 ? activeIdx : 0)
  }, [filterText, isOpen, activeMode])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (!filteredCommands.length) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        if (filteredCommands[selectedIndex]) {
          onSelect(filteredCommands[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isOpen, filteredCommands, selectedIndex, onSelect, onClose])

  if (!isOpen || filteredCommands.length === 0) return null

  return (
    <div className="slash-menu-container">
      {filteredCommands.map((cmd, index) => {
        const isCurrentActive =
          cmd.label.toLowerCase() === (activeMode || '').toLowerCase()
        const isKeyboardSelected = index === selectedIndex

        return (
          <div
            key={cmd.id}
            className={`slash-menu-item ${isKeyboardSelected ? 'highlighted' : ''} ${isCurrentActive ? 'is-active-mode' : ''}`}
            onClick={() => onSelect(cmd)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="slash-icon">{cmd.icon}</div>
            <div className="slash-content">
              <span className="slash-label">{cmd.label}</span>
              <span className="slash-desc">{cmd.desc}</span>
            </div>
            {isCurrentActive && (
              <div className="slash-active-check">
                <Check size={12} strokeWidth={2.5} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default LuminaSlash
