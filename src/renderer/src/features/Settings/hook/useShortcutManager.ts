import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { buildShortcutGroups, DEFAULT_SHORTCUTS, ShortcutItem, ShortcutGroup } from '../../../core/shortcuts/defaultShortcuts'
import { useSettingsStore } from '../../../core/store/SettingStore'

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent)

interface WindowApiWithShortcuts {
  pauseGlobalShortcuts?: () => Promise<void>
  resumeGlobalShortcuts?: () => Promise<void>
}

/**
 * Normalizes a shortcut key combination string for accurate comparison.
 */
export function normalizeCombo(str: string): string {
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
    if (p === '?') {
      mainKey = '/'
    } else if (p === '/') {
      mainKey = '/'
    } else if (p === '>') {
      mainKey = '.'
    } else if (p === '.') {
      mainKey = '.'
    } else if (p === '<') {
      mainKey = ','
    } else if (p === ',') {
      mainKey = ','
    } else if (p === ':') {
      mainKey = ';'
    } else if (p === ';') {
      mainKey = ';'
    } else if (p === '|') {
      mainKey = '\\'
    } else if (p === '\\') {
      mainKey = '\\'
    } else if (p === 'space' || p === ' ') {
      mainKey = 'space'
    } else {
      mainKey = p
    }
  }

  const result: string[] = []
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
export function findConflict(combo: string, currentId: string, allShortcuts: ShortcutItem[]): boolean {
  if (!combo) return false
  const normalized = normalizeCombo(combo)
  if (!normalized) return false

  const combined = [...(allShortcuts || []), ...DEFAULT_SHORTCUTS]
  const seenIds = new Set<string>()

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
export function formatDisplayCombo(canonicalCombo: string): string {
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
export function getModifiers(e: KeyboardEvent): string[] {
  const parts: string[] = []
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
export function getMainKey(e: KeyboardEvent): string | null {
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

/**
 * Custom hook to manage keyboard shortcut groups, search filtering, inline key combo recording,
 * conflict validation, and persistence to SettingStore.
 */
export function useShortcutManager() {
  const [filterQuery, setFilterQuery] = useState('')
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null)
  const [recordingDisplay, setRecordingDisplay] = useState('')
  const [committedKey, setCommittedKey] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [isTaken, setIsTaken] = useState(false)

  const isCompleteRef = useRef(isComplete)
  const committedKeyRef = useRef(committedKey)
  const isTakenRef = useRef(isTaken)
  const inlineInputRef = useRef<HTMLInputElement | null>(null)

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
  const groups: ShortcutGroup[] = useMemo(() => buildShortcutGroups(shortcuts), [shortcuts])

  // Flatten all items for conflict checking
  const allShortcuts: ShortcutItem[] = useMemo(() => {
    return groups.flatMap((g) => g.items)
  }, [groups])

  // Save updated shortcut (cleans up app_config.json if restored to default)
  const handleSaveShortcut = useCallback(
    (shortcutId: string, newKey: string) => {
      const updated = { ...shortcuts }
      const defaultDef = DEFAULT_SHORTCUTS.find((s) => s.id === shortcutId)
      if (defaultDef && newKey === defaultDef.defaultKey) {
        delete updated[shortcutId]
      } else {
        updated[shortcutId] = newKey
      }
      updateSetting('shortcuts', updated)
    },
    [shortcuts, updateSetting]
  )

  // Cancel inline editing
  const cancelEditing = useCallback(() => {
    setEditingShortcutId(null)
    setRecordingDisplay('')
    setCommittedKey('')
    setIsComplete(false)
    setIsTaken(false)
    ;(window as unknown as { __isRecordingShortcut?: boolean }).__isRecordingShortcut = false

    const api = (window as unknown as { api?: WindowApiWithShortcuts }).api
    if (api?.resumeGlobalShortcuts) {
      api.resumeGlobalShortcuts().catch(() => {})
    }
  }, [])

  // Start editing a shortcut inline
  const startEditing = useCallback(
    (item: ShortcutItem) => {
      const currentKey = item.key || item.defaultKey || ''
      setEditingShortcutId(item.id)
      setRecordingDisplay(currentKey)
      setCommittedKey(currentKey)
      setIsComplete(Boolean(currentKey))
      setIsTaken(false)

      const api = (window as unknown as { api?: WindowApiWithShortcuts }).api
      if (api?.pauseGlobalShortcuts) {
        api.pauseGlobalShortcuts().catch(() => {})
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
    },
    []
  )

  // Click outside listener to cancel editing
  useEffect(() => {
    if (!editingShortcutId) return

    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.shortcut-inline-container')) {
        cancelEditing()
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [editingShortcutId, cancelEditing])

  // Key recording listener while inline editing is active
  useEffect(() => {
    if (!editingShortcutId) return

    if (typeof window !== 'undefined') {
      ;(window as unknown as { __isRecordingShortcut?: boolean }).__isRecordingShortcut = true
    }

    const handleKeyDown = (e: KeyboardEvent) => {
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

    const handleKeyUp = (e: KeyboardEvent) => {
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
        ;(window as unknown as { __isRecordingShortcut?: boolean }).__isRecordingShortcut = false
      }
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('keyup', handleKeyUp, { capture: true })
    }
  }, [editingShortcutId, allShortcuts, cancelEditing, handleSaveShortcut])

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

  return {
    filterQuery,
    setFilterQuery,
    editingShortcutId,
    recordingDisplay,
    committedKey,
    isTaken,
    inlineInputRef,
    filteredGroups,
    startEditing,
    cancelEditing,
    handleSaveShortcut
  }
}
