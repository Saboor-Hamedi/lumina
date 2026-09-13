/**
 * ============================================================================
 * SettingShortcuts Component
 * ============================================================================
 * Dedicated Keyboard Shortcuts panel for Settings.
 * Displays all keybindings organized by category with live search/filtering.
 * Allows customizing shortcuts dynamically via inline recording with zero-blur.
 * ============================================================================
 */

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Search, X, Plus, Check } from 'lucide-react'
import { buildShortcutGroups, DEFAULT_SHORTCUTS } from '../../core/shortcuts/defaultShortcuts'
import { useSettingsStore } from '../../core/store/useSettingsStore'

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

const SettingShortcuts = () => {
  const [filterQuery, setFilterQuery] = useState('')
  const [editingShortcutId, setEditingShortcutId] = useState(null)
  const [recordingDisplay, setRecordingDisplay] = useState('')
  const [committedKey, setCommittedKey] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [isTaken, setIsTaken] = useState(false)

  const isCompleteRef = useRef(isComplete)
  const committedKeyRef = useRef(committedKey)
  const isTakenRef = useRef(isTaken)
  const inlineInputRef = useRef(null)

  useEffect(() => {
    isCompleteRef.current = isComplete
  }, [isComplete])

  useEffect(() => {
    committedKeyRef.current = committedKey
  }, [committedKey])

  useEffect(() => {
    isTakenRef.current = isTaken
  }, [isTaken])

  const shortcuts = useSettingsStore((state) => state.settings.shortcuts) || {}
  const updateSetting = useSettingsStore((state) => state.updateSetting)

  // Build groups using stored custom shortcuts
  const groups = useMemo(() => buildShortcutGroups(shortcuts), [shortcuts])

  // Flatten all items for conflict checking
  const allShortcuts = useMemo(() => {
    return groups.flatMap((g) => g.items)
  }, [groups])

  // Save updated shortcut (cleans up app_config.json if restored to default)
  const handleSaveShortcut = (shortcutId, newKey) => {
    const updated = { ...shortcuts }
    const defaultDef = DEFAULT_SHORTCUTS.find((s) => s.id === shortcutId)
    if (defaultDef && newKey === defaultDef.defaultKey) {
      delete updated[shortcutId]
    } else {
      updated[shortcutId] = newKey
    }
    updateSetting('shortcuts', updated)
  }

  // Start editing a shortcut inline
  const startEditing = (item) => {
    const currentKey = item.key || item.defaultKey || ''
    setEditingShortcutId(item.id)
    setRecordingDisplay(currentKey)
    setCommittedKey(currentKey)
    setIsComplete(Boolean(currentKey))
    setIsTaken(false)

    // Pause Electron global shortcuts so OS hooks don't swallow keys (e.g. Space)
    if (window.api?.pauseGlobalShortcuts) {
      window.api.pauseGlobalShortcuts().catch(() => {})
    }

    requestAnimationFrame(() => {
      if (inlineInputRef.current) {
        inlineInputRef.current.focus()
      }
    })
    setTimeout(() => {
      if (inlineInputRef.current) {
        inlineInputRef.current.focus()
      }
    }, 20)
  }

  // Cancel inline editing
  const cancelEditing = () => {
    setEditingShortcutId(null)
    setRecordingDisplay('')
    setCommittedKey('')
    setIsComplete(false)
    setIsTaken(false)

    // Resume Electron global shortcuts
    if (window.api?.resumeGlobalShortcuts) {
      window.api.resumeGlobalShortcuts().catch(() => {})
    }
  }

  // Click outside listener to cancel editing
  useEffect(() => {
    if (!editingShortcutId) return

    const handleOutsideClick = (e) => {
      if (!e.target.closest('.shortcut-inline-container')) {
        cancelEditing()
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [editingShortcutId])

  // Key recording listener while inline editing is active
  useEffect(() => {
    if (!editingShortcutId) return

    if (typeof window !== 'undefined') {
      window.__isRecordingShortcut = true
    }

    const handleKeyDown = (e) => {
      // 1. Esc cancels
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        cancelEditing()
        return
      }

      // 2. Enter saves if valid
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        if (!isTakenRef.current && committedKeyRef.current) {
          handleSaveShortcut(editingShortcutId, committedKeyRef.current)
          cancelEditing()
        }
        return
      }

      // 3. Backspace/Delete resets to default (only if no modifiers pressed)
      if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        !e.metaKey
      ) {
        e.preventDefault()
        e.stopPropagation()
        const def = DEFAULT_SHORTCUTS.find((s) => s.id === editingShortcutId)
        if (def) {
          setRecordingDisplay(def.defaultKey)
          setCommittedKey(def.defaultKey)
          setIsComplete(true)
          const conflict = findConflict(def.defaultKey, editingShortcutId, allShortcuts)
          setIsTaken(conflict)
        }
        return
      }

      // Capture all other key combinations
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()

      const mainKey = getMainKey(e)
      const modifiers = getModifiers(e)

      if (!mainKey) {
        if (modifiers.length > 0) {
          setRecordingDisplay(modifiers.join(' + '))
          setIsComplete(false)
          setIsTaken(false)
        }
        return
      }

      const combo = [...modifiers, mainKey].join(' + ')
      setRecordingDisplay(combo)
      setCommittedKey(combo)
      setIsComplete(true)

      const conflict = findConflict(combo, editingShortcutId, allShortcuts)
      setIsTaken(conflict)
    }

    const handleKeyUp = (e) => {
      if (!isCompleteRef.current) {
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          if (committedKeyRef.current) {
            setRecordingDisplay(committedKeyRef.current)
            setIsComplete(true)
            const conflict = findConflict(committedKeyRef.current, editingShortcutId, allShortcuts)
            setIsTaken(conflict)
          } else {
            setRecordingDisplay('')
            setIsComplete(false)
            setIsTaken(false)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('keyup', handleKeyUp, { capture: true })

    return () => {
      if (typeof window !== 'undefined') {
        window.__isRecordingShortcut = false
      }
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('keyup', handleKeyUp, { capture: true })
    }
  }, [editingShortcutId, allShortcuts])

  // Render individual keycap badge (e.g. "Ctrl" + "Shift" + "F")
  const renderKeycaps = (keyString) => {
    const rawKeys = keyString.split('+').map((k) => k.trim())
    const formattedKeys = rawKeys.map((k) => {
      if (!isMac) return k
      return k.replace(/^Ctrl$/i, '⌘').replace(/^Shift$/i, '⇧').replace(/^Alt$/i, '⌥').replace(/^Win$/i, '⌘')
    })

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {formattedKeys.map((k, index) => (
          <React.Fragment key={index}>
            <kbd
              style={{
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'inherit',
                color: 'var(--text-main, #f1f5f9)',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px',
                lineHeight: 1.2,
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                userSelect: 'none'
              }}
            >
              {k}
            </kbd>
            {index < formattedKeys.length - 1 && (
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--text-faint, #64748b)',
                  fontWeight: 500
                }}
              >
                +
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }

  // Filter shortcuts based on user search query
  const filteredGroups = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    if (!q) return groups

    return groups
      .map((group) => {
        const matchingItems = group.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.key.toLowerCase().includes(q)
        )
        return {
          ...group,
          items: matchingItems
        }
      })
      .filter((group) => group.items.length > 0)
  }, [filterQuery, groups])

  return (
    <div className="settings-pane">
      {/* Search Header */}
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%'
          }}
        >
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: '11px',
              color: 'var(--text-faint, #64748b)',
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            placeholder="Find a shortcut by name or key combination..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              width: '100%',
              height: '34px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '7px',
              padding: filterQuery ? '0 32px 0 32px' : '0 12px 0 32px',
              color: 'var(--text-main, #f8fafc)',
              fontSize: '12px',
              outline: 'none',
              transition: 'all 0.15s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(var(--text-accent-rgb, 139, 92, 246), 0.5)'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(var(--text-accent-rgb, 139, 92, 246), 0.12)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '4px'
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div
          style={{
            padding: '36px 16px',
            textAlign: 'center',
            color: 'var(--text-faint, #64748b)',
            fontSize: '12px'
          }}
        >
          No shortcuts found matching "{filterQuery}"
        </div>
      ) : (
        <div className="settings-block" style={{ padding: '0', background: 'transparent' }}>
          {filteredGroups.map((group, i) => (
            <div
              key={i}
              style={{ marginBottom: i < filteredGroups.length - 1 ? '28px' : '0' }}
            >
              <h4
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted, #94a3b8)',
                  marginBottom: '10px',
                  paddingBottom: '6px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  position: 'sticky',
                  top: '-40px',
                  background: 'var(--bg-app, #14141e)',
                  zIndex: 2
                }}
              >
                {group.title}
              </h4>
              {group.items.map((item, j) => {
                const isEditingThis = editingShortcutId === item.id

                return (
                  <div
                    className="settings-row shortcut-list-row"
                    key={j}
                    style={{
                      padding: '8px 8px',
                      margin: '2px 0',
                      borderBottom: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: '6px',
                      transition: 'all 0.12s ease',
                      cursor: 'default'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div
                      className="row-info"
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 450,
                        color: item.isDanger ? '#ef4444' : 'var(--text-main, #f1f5f9)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span>{item.label}</span>
                      {item.isCustom && !isEditingThis && (
                        <span
                          style={{
                            fontSize: '9px',
                            color: 'var(--text-accent)',
                            background: 'rgba(var(--text-accent-rgb, 139, 92, 246), 0.1)',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            fontWeight: 500
                          }}
                        >
                          custom
                        </span>
                      )}
                    </div>

                    {isEditingThis ? (
                      /* Beautiful inline recording box with zero-blur and side-by-side cancel button */
                      <div
                        className="shortcut-inline-container shortcut-recording"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: '2px'
                        }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            ref={inlineInputRef}
                            className="shortcut-inline-input"
                            type="text"
                            readOnly
                            value={formatDisplayCombo(recordingDisplay)}
                            placeholder=""
                            style={{
                              height: '24px',
                              width: '120px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              border: isTaken
                                ? '1px solid var(--text-accent, #40bafa)'
                                : '1px solid rgba(var(--text-accent-rgb, 139, 92, 246), 0.6)',
                              borderRadius: '4px',
                              color: 'var(--text-main, #f1f5f9)',
                              fontSize: '11px',
                              fontWeight: 600,
                              textAlign: 'center',
                              outline: 'none',
                              fontFamily: 'inherit',
                              letterSpacing: '0.02em',
                              boxShadow: isTaken
                                ? '0 0 0 2px rgba(var(--text-accent-rgb, 139, 92, 246), 0.25)'
                                : '0 0 0 2px rgba(var(--text-accent-rgb, 139, 92, 246), 0.12)',
                              userSelect: 'none',
                              cursor: 'pointer'
                            }}
                          />
                          {/* Save checkmark button */}
                          <button
                            type="button"
                            aria-label="Save shortcut"
                            title="Save shortcut (Enter)"
                            disabled={isTaken || !committedKey}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!isTaken && committedKey) {
                                handleSaveShortcut(item.id, committedKey)
                                cancelEditing()
                              }
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '22px',
                              height: '22px',
                              borderRadius: '4px',
                              background: isTaken || !committedKey ? 'rgba(255, 255, 255, 0.03)' : 'rgba(var(--text-accent-rgb, 139, 92, 246), 0.18)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: isTaken || !committedKey ? 'var(--text-faint, #64748b)' : 'var(--text-accent, #40bafa)',
                              cursor: isTaken || !committedKey ? 'default' : 'pointer',
                              padding: 0,
                              transition: 'all 0.12s ease'
                            }}
                          >
                            <Check size={11} />
                          </button>
                          {/* Cancel button side-by-side with plus/save button */}
                          <button
                            type="button"
                            aria-label="Cancel editing"
                            title="Cancel (Esc)"
                            onClick={(e) => {
                              e.stopPropagation()
                              cancelEditing()
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '22px',
                              height: '22px',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: 'var(--text-muted, #94a3b8)',
                              cursor: 'pointer',
                              padding: 0,
                              transition: 'all 0.12s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#ef4444'
                              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                            }}
                          >
                            <X size={11} />
                          </button>
                        </div>
                        {/* Clean 10px duplicate message with accent color right under the input */}
                        {isTaken && (
                          <span
                            style={{
                              fontSize: '10px',
                              color: 'var(--text-accent, #40bafa)',
                              fontWeight: 600,
                              letterSpacing: '0.02em',
                              textTransform: 'lowercase',
                              alignSelf: 'center',
                              marginTop: '2px',
                              animation: 'modal-fade-in 0.12s ease-out'
                            }}
                          >
                            shortcut is already taken
                          </span>
                        )}
                      </div>
                    ) : (
                      /* Normal Keycap View with Plus Button */
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        {renderKeycaps(item.key)}
                        {!item.readonly && (
                          <button
                            type="button"
                            aria-label={`Customize ${item.label}`}
                            title="Customize shortcut"
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditing(item)
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: 'var(--text-muted, #94a3b8)',
                              cursor: 'pointer',
                              padding: 0,
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(var(--text-accent-rgb, 139, 92, 246), 0.15)'
                              e.currentTarget.style.borderColor = 'var(--text-accent)'
                              e.currentTarget.style.color = 'var(--text-main, #fff)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                              e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'
                            }}
                          >
                            <Plus size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default React.memo(SettingShortcuts)
