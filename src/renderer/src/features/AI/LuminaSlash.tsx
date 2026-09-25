import React, { useEffect, useState, useRef } from 'react'
import { Zap, Brain, Palette, Code, Check, Search } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import './css/luminSlash.css'

export interface SlashCommand {
  id: string
  label: string
  desc: string
  icon: React.ReactNode
  insertText?: string
  isAction?: boolean
  aliases?: string[]
  action?: (setMode: (mode: string) => void, context?: { setInput?: (text: string) => void }) => void
}

export const SLASH_COMMANDS: SlashCommand[] = [
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
    id: 'research',
    label: 'Research',
    desc: 'Deep research, thesis guidance, academic writing, and analysis.',
    icon: <Search size={14} />,
    action: (setMode) => setMode('Research')
  },
  {
    id: 'creative',
    label: 'Creative',
    desc: 'Storytelling, expressive writing, and metaphors.',
    icon: <Palette size={14} />,
    action: (setMode) => setMode('Creative')
  },
  {
    id: 'code',
    label: 'Code',
    desc: 'Specialized for programming, scripts, and software engineering.',
    icon: <Code size={14} />,
    action: (setMode) => setMode('Code')
  }
]

export interface LuminaSlashProps {
  isOpen: boolean
  filterText: string
  activeMode?: string
  onSelect: (cmd: SlashCommand) => void
  onClose: () => void
}

/**
 * LuminaSlash provides a keyboard-navigable autocomplete overlay for `/` slash commands
 * to rapidly switch AI personas and operational modes.
 */
export const LuminaSlash: React.FC<LuminaSlashProps> = ({
  isOpen,
  filterText,
  activeMode = 'Code',
  onSelect,
  onClose
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

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
      cmd.label.toLowerCase().includes(filterText.toLowerCase()) ||
      (cmd.aliases && cmd.aliases.some((a) => a.toLowerCase().includes(filterText.toLowerCase())))
  )

  useEffect(() => {
    // If opening without filter, default selected index to the current active mode
    const activeIdx = filteredCommands.findIndex(
      (c) => !c.isAction && c.label.toLowerCase() === (activeMode || '').toLowerCase()
    )
    setSelectedIndex(activeIdx >= 0 ? activeIdx : 0)
  }, [filterText, isOpen, activeMode])

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!filteredCommands.length) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(
          (prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length
        )
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
          !cmd.isAction && cmd.label.toLowerCase() === (activeMode || '').toLowerCase()
        const isKeyboardSelected = index === selectedIndex

        return (
          <div
            key={cmd.id}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
            className={`slash-menu-item ${isKeyboardSelected ? 'highlighted' : ''} ${
              isCurrentActive ? 'is-active-mode' : ''
            }`}
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
