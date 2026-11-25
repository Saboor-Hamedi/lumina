import React, { useEffect, useRef } from 'react'
import { ToolTip } from '../../../ui/Tooltip'

export const NATIVE_EMOJI_GROUPS: Array<{ label: string; emojis: string[] }> = [
  {
    label: 'Work & Ideas',
    emojis: ['📝', '💡', '🚀', '⚡', '🎯', '📌', '📚', '🧠', '💻', '🛠️', '📊', '🗂️', '🔬', '🎨', '✨', '🔥']
  },
  {
    label: 'Smileys',
    emojis: ['😊', '😎', '🤩', '🤔', '🥳', '😌', '🙌', '👋', '💪', '👀', '🫶', '🫡', '🤖', '👾', '🦊', '🐱']
  },
  {
    label: 'Nature & Travel',
    emojis: ['🌿', '🌸', '🌊', '🌙', '☀️', '⛰️', '🌲', '🍀', '🪐', '🌈', '☕', '🍵', '🧭', '✈️', '🏝️', '🏡']
  },
  {
    label: 'Symbols',
    emojis: ['✅', '⭐', '💎', '🔖', '🏷️', '🔒', '🔑', '🧩', '🎵', '🎬', '📸', '🎮', '🏆', '❤️', '💜', '💙']
  }
]

export interface MetaProfileProps {
  emoji: string | null
  hasCover: boolean
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onSelect: (emoji: string | null) => void
}

/**
 * MetaProfile — Notion-style native emoji profile avatar & lightweight picker.
 */
export const MetaProfile: React.FC<MetaProfileProps> = React.memo(
  ({ emoji, hasCover, isOpen, onToggle, onClose, onSelect }) => {
    const pickerRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
      if (!isOpen) return
      const onPointerDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null
        if (
          pickerRef.current &&
          target &&
          !pickerRef.current.contains(target) &&
          !target.closest('.note-profile-emoji-btn') &&
          !target.closest('[data-meta-profile-trigger]')
        ) {
          onClose()
        }
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      document.addEventListener('mousedown', onPointerDown, true)
      window.addEventListener('keydown', onKeyDown)
      return () => {
        document.removeEventListener('mousedown', onPointerDown, true)
        window.removeEventListener('keydown', onKeyDown)
      }
    }, [isOpen, onClose])

    return (
      <>
        {emoji && (
          <div className={`note-profile-emoji-row ${hasCover ? 'overlaps-cover' : ''}`}>
            <ToolTip text="Change icon" position="top">
              <button
                type="button"
                className="note-profile-emoji-btn"
                onClick={onToggle}
                aria-label="Change note icon"
              >
                <span className="note-profile-emoji-glyph">{emoji}</span>
              </button>
            </ToolTip>
          </div>
        )}

        {isOpen && (
          <div
            ref={pickerRef}
            className="note-emoji-popover"
            role="dialog"
            aria-label="Choose note icon"
          >
            <div className="note-emoji-popover-header">
              <span>Note Icon</span>
              {emoji && (
                <button
                  type="button"
                  className="note-emoji-remove-btn"
                  onClick={() => onSelect(null)}
                >
                  Remove
                </button>
              )}
            </div>
            <div className="note-emoji-groups">
              {NATIVE_EMOJI_GROUPS.map((group) => (
                <div key={group.label} className="note-emoji-group">
                  <div className="note-cover-section-label">{group.label}</div>
                  <div className="note-emoji-grid">
                    {group.emojis.map((em) => (
                      <button
                        key={em}
                        type="button"
                        className={`note-emoji-item ${emoji === em ? 'is-selected' : ''}`}
                        onClick={() => onSelect(em)}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )
  }
)

MetaProfile.displayName = 'MetaProfile'
export default MetaProfile
