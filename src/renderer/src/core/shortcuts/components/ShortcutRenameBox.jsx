import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DEFAULT_SHORTCUTS } from '../defaultShortcuts'
import '../css/shortcut.css'

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent)

/**
 * Normalizes a shortcut key combination string for accurate comparison.
 */
function normalizeCombo(str) {
  if (!str) return ''
  const parts = str.split('+').map((s) => s.trim().toLowerCase()).filter(Boolean)
  const ctrl = parts.includes('ctrl') || parts.includes('control') || parts.includes('cmd') || parts.includes('command')
  const alt = parts.includes('alt') || parts.includes('option')
  const shift = parts.includes('shift')
  const win = parts.includes('win') || parts.includes('meta') || parts.includes('super')

  let mainKey = ''
  for (const p of parts) {
    if (['ctrl', 'control', 'cmd', 'command', 'alt', 'option', 'shift', 'win', 'meta', 'super'].includes(p)) {
      continue
    }
    if (p === '?' || p === '/') mainKey = '/'
    else if (p === '>' || p === '.') mainKey = '.'
    else if (p === '<' || p === ',') mainKey = ','
    else if (p === ':' || p === ';') mainKey = ';'
    else if (p === '|' || p === '\\') mainKey = '\\'
    else if (p === 'space' || p === ' ') mainKey = 'space'
    else mainKey = p
  }

  const result = []
  if (ctrl) result.push('ctrl')
  if (alt) result.push('alt')
  if (shift) result.push('shift')
  if (win) result.push('win')
  if (mainKey) result.push(mainKey)

  return result.join('+')
}

/**
 * Finds whether a shortcut combo conflicts with an existing assigned shortcut.
 */
function findConflict(combo, currentId, allShortcuts) {
  if (!combo) return false
  const normalized = normalizeCombo(combo)
  if (!normalized) return false

  const combined = [...(allShortcuts || []), ...DEFAULT_SHORTCUTS]
  const seenIds = new Set()

  for (const s of combined) {
    if (!s || s.id === currentId || seenIds.has(s.id)) continue
    seenIds.add(s.id)

    const candidateKey = s.key || s.defaultKey
    if (candidateKey && normalizeCombo(candidateKey) === normalized) {
      return true
    }
  }
  return false
}

/**
 * Formats a canonical combo string for display depending on OS.
 * (e.g. on macOS "Ctrl + Shift + F" -> "⌘ + ⇧ + F")
 */
function formatDisplayCombo(canonicalCombo) {
  if (!canonicalCombo) return ''
  if (!isMac) return canonicalCombo
  return canonicalCombo
    .replace(/\bCtrl\b/g, '⌘')
    .replace(/\bShift\b/g, '⇧')
    .replace(/\bAlt\b/g, '⌥')
    .replace(/\bWin\b/g, '⌃')
}

/**
 * Extracts active modifier keys from KeyboardEvent.
 */
function getModifiers(e) {
  const parts = []
  const isPrimary = isMac ? e.metaKey : e.ctrlKey
  const isSecondary = isMac ? e.ctrlKey : e.metaKey

  if (isPrimary) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (isSecondary) parts.push('Win')
  return parts
}

/**
 * Extracts normalized non-modifier main key from KeyboardEvent.
 */
function getMainKey(e) {
  const key = e.key
  const code = e.code

  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
    return null
  }

  // Format special keys
  if (code === 'Space' || key === ' ') return 'Space'
  if (code === 'Tab' || key === 'Tab') return 'Tab'
  if (code === 'Slash' || key === '/' || key === '?') return '/'
  if (code === 'Period' || key === '.' || key === '>') return '.'
  if (code === 'Comma' || key === ',' || key === '<') return ','
  if (code === 'Semicolon' || key === ';' || key === ':') return ';'
  if (code === 'Backslash' || key === '\\' || key === '|') return '\\'
  if (code.startsWith('Key')) return code.slice(3).toUpperCase()
  if (code.startsWith('Digit')) return code.slice(5)
  if (key.length === 1) return key.toUpperCase()

  return key
}

/**
 * Shortcut Modal Component
 * Styled identically to Rename.jsx modal with key recording and collision detection.
 */
const ShortcutRenameBox = ({
  isOpen,
  onClose,
  shortcutItem,
  onSave,
  allShortcuts = []
}) => {
  const inputRef = useRef(null)
  const [currentDisplay, setCurrentDisplay] = useState('')
  const [committedKey, setCommittedKey] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [isTaken, setIsTaken] = useState(false)

  const isCompleteRef = useRef(isComplete)
  const committedKeyRef = useRef(committedKey)

  useEffect(() => {
    isCompleteRef.current = isComplete
  }, [isComplete])

  useEffect(() => {
    committedKeyRef.current = committedKey
  }, [committedKey])

  // On modal open, start clean and focus
  useEffect(() => {
    if (isOpen && shortcutItem) {
      if (typeof window !== 'undefined') {
        window.__isRecordingShortcut = true
      }

      // Keep Electron global shortcuts from consuming keys while recording.
      if (window.api?.pauseGlobalShortcuts) {
        window.api.pauseGlobalShortcuts().catch(() => {})
      }

      setCurrentDisplay('')
      setCommittedKey('')
      setIsComplete(false)
      setIsTaken(false)
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 50)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.__isRecordingShortcut = false
      }
      if (window.api?.resumeGlobalShortcuts) {
        window.api.resumeGlobalShortcuts().catch(() => {})
      }
    }
  }, [isOpen, shortcutItem])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      // 1. Esc to close
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        onClose()
        return
      }

      // 2. Enter to save
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        if (isCompleteRef.current && !isTaken && committedKeyRef.current) {
          onSave(shortcutItem.id, committedKeyRef.current)
          onClose()
        }
        return
      }

      // 3. Backspace / Delete resets to default
      if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        !e.metaKey
      ) {
        e.preventDefault()
        e.stopPropagation()
        const defaultKey = shortcutItem.defaultKey
        setCurrentDisplay(defaultKey)
        setCommittedKey(defaultKey)
        setIsComplete(true)

        const conflict = findConflict(defaultKey, shortcutItem.id, allShortcuts)
        setIsTaken(conflict)
        return
      }

      // Intercept all other key presses for shortcut recording
      e.preventDefault()
      e.stopPropagation()

      const mainKey = getMainKey(e)
      const modifiers = getModifiers(e)

      if (!mainKey) {
        // Only modifier key(s) are currently held down
        if (modifiers.length > 0) {
          setCurrentDisplay(modifiers.join(' + '))
          setIsComplete(false)
          setIsTaken(false)
        }
        return
      }

      // A complete combo has been pressed (modifiers + mainKey)
      const comboParts = [...modifiers, mainKey]
      const canonical = comboParts.join(' + ')

      setCurrentDisplay(canonical)
      setCommittedKey(canonical)
      setIsComplete(true)

      // Check conflict across all existing & default shortcuts
      const conflict = findConflict(canonical, shortcutItem.id, allShortcuts)
      setIsTaken(conflict)
    }

    const handleKeyUp = (e) => {
      // If user released modifier keys without pressing a main key,
      // revert back to the last valid committed shortcut if any
      if (!isCompleteRef.current) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          if (committedKeyRef.current) {
            setCurrentDisplay(committedKeyRef.current)
            setIsComplete(true)
            const conflict = findConflict(committedKeyRef.current, shortcutItem.id, allShortcuts)
            setIsTaken(conflict)
          } else {
            setCurrentDisplay('')
            setIsComplete(false)
            setIsTaken(false)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('keyup', handleKeyUp, { capture: true })

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('keyup', handleKeyUp, { capture: true })
    }
  }, [isOpen, onClose, onSave, shortcutItem, isTaken, allShortcuts])

  if (!isOpen || !shortcutItem) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isComplete && !isTaken && committedKey) {
      onSave(shortcutItem.id, committedKey)
      onClose()
    }
  }

  const currentOriginal = shortcutItem.key || shortcutItem.defaultKey

  return createPortal(
    <div className="modal-overlay shortcut-modal-overlay" onClick={onClose}>
      <div className="modal-container shortcut-modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="shortcut-form">
          <div className="shortcut-title">{shortcutItem.label}</div>
          <input
            ref={inputRef}
            className="shortcut-input"
            type="text"
            readOnly
            value={formatDisplayCombo(currentDisplay)}
            placeholder=""
          />
          <div className="shortcut-feedback-container">
            {isTaken && (
              <div
                className="shortcut-taken-message"
                style={{
                  fontSize: '10px',
                  color: 'var(--text-accent, #40bafa)',
                  fontWeight: 600,
                  textAlign: 'center',
                  letterSpacing: '0.02em',
                  textTransform: 'lowercase'
                }}
              >
                shortcut is already taken
              </div>
            )}
          </div>
          <div className="shortcut-hint">
            Press Enter to save, Backspace to reset, Esc to cancel
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default React.memo(ShortcutRenameBox)
