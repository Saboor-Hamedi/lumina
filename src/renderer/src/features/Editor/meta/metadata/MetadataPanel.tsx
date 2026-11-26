import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlignLeft,
  Calendar,
  Check,
  CheckSquare,
  Columns2,
  Columns3,
  ExternalLink,
  GripVertical,
  Hash,
  Link2,
  Plus,
  Rows3,
  Tag,
  X
} from 'lucide-react'
import { handleExternalLinkClick } from '../../../links'
import type { Snippet } from '../../../../core/editor/types'
import {
  QUICK_PROPERTY_PRESETS,
  SELECT_PRESET_OPTIONS,
  type MetadataProperty,
  type MetadataPropertyType
} from './types'
import {
  extractCustomYamlProperties,
  formatPropertyLabel,
  inferPropertyType,
  isReservedMetadataKey,
  sanitizePropertyKey,
  toPropertyList
} from './yamlMetadata'
import {
  deleteNoteMetadata,
  fetchNoteMetadata,
  fetchNoteMetadataColumns,
  reorderNoteMetadata,
  saveNoteMetadataColumns,
  upsertNoteMetadata
} from './metadataClient'
import { CalendarDatePicker } from './CalendarDatePicker'
import './metadata.css'

export interface MetadataPanelProps {
  snippet: Snippet | null
  onSave?: (snippet: Snippet) => Promise<Snippet | void>
}

const PROPERTY_TYPE_CHOICES: Array<{ id: MetadataPropertyType; label: string }> = [
  { id: 'text', label: 'Text' },
  { id: 'select', label: 'Select' },
  { id: 'date', label: 'Date' },
  { id: 'checkbox', label: 'Checkbox' },
  { id: 'url', label: 'URL' },
  { id: 'number', label: 'Number' }
]

const STATUS_DOT_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  'in progress': '#3b82f6',
  review: '#f59e0b',
  done: '#10b981',
  low: '#94a3b8',
  medium: '#3b82f6',
  high: '#f97316',
  urgent: '#ef4444'
}

function PropertyTypeIcon({ type }: { type: MetadataPropertyType }) {
  switch (type) {
    case 'select':
      return <Tag size={12} className="meta-prop-type-icon" />
    case 'date':
      return <Calendar size={12} className="meta-prop-type-icon" />
    case 'checkbox':
      return <CheckSquare size={12} className="meta-prop-type-icon" />
    case 'url':
      return <Link2 size={12} className="meta-prop-type-icon" />
    case 'number':
      return <Hash size={12} className="meta-prop-type-icon" />
    default:
      return <AlignLeft size={12} className="meta-prop-type-icon" />
  }
}

/**
 * Isolated text/number/url input row with 0ms local typing and debounced SQLite flush.
 * Prevents parent re-renders and disk writes on every keystroke.
 */
const SmoothValueInput: React.FC<{
  prop: MetadataProperty
  onCommit: (key: string, type: MetadataPropertyType, value: string) => void
}> = React.memo(({ prop, onCommit }) => {
  const [draft, setDraft] = useState(prop.value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestDraftRef = useRef(prop.value)
  const isDirtyRef = useRef(false)

  useEffect(() => {
    if (!isDirtyRef.current) {
      setDraft(prop.value)
      latestDraftRef.current = prop.value
    }
  }, [prop.value])

  const flushNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (isDirtyRef.current) {
      isDirtyRef.current = false
      onCommit(prop.key, prop.type, latestDraftRef.current)
    }
  }, [onCommit, prop.key, prop.type])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (isDirtyRef.current) {
        isDirtyRef.current = false
        onCommit(prop.key, prop.type, latestDraftRef.current)
      }
    }
  }, [onCommit, prop.key, prop.type])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setDraft(next)
    latestDraftRef.current = next
    isDirtyRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      isDirtyRef.current = false
      onCommit(prop.key, prop.type, next)
    }, 320)
  }

  return (
    <>
      <input
        type={prop.type === 'number' ? 'number' : prop.type === 'url' ? 'url' : 'text'}
        className="meta-prop-input"
        value={draft}
        placeholder={prop.type === 'url' ? 'https://...' : 'Empty'}
        aria-label={formatPropertyLabel(prop.key)}
        onChange={handleChange}
        onBlur={flushNow}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
      />
      {prop.type === 'url' && /^https?:\/\/\S+$/i.test(draft.trim()) && (
        <button
          type="button"
          className="meta-prop-url-open"
          title="Open URL"
          aria-label={`Open ${prop.key} URL`}
          onClick={() => handleExternalLinkClick(draft.trim())}
        >
          <ExternalLink size={12} />
        </button>
      )}
    </>
  )
})
SmoothValueInput.displayName = 'SmoothValueInput'

/**
 * Refined Notion-style pill selector popover (replaces ugly native <select>).
 */
const SelectPillControl: React.FC<{
  prop: MetadataProperty
  options: string[]
  onSelect: (value: string) => void
}> = React.memo(({ prop, options, onSelect }) => {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (target && wrapRef.current && !wrapRef.current.contains(target)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const current = options.includes(prop.value) ? prop.value : options[0]
  const dotColor = STATUS_DOT_COLORS[current.toLowerCase()] || 'var(--accent-color, var(--text-accent))'

  return (
    <div className="meta-select-wrap" ref={wrapRef}>
      <button
        type="button"
        className="meta-select-pill"
        aria-label={formatPropertyLabel(prop.key)}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="meta-select-dot" style={{ background: dotColor }} />
        <span>{current}</span>
      </button>

      {open && (
        <div className="meta-select-menu" role="listbox" aria-label={formatPropertyLabel(prop.key)}>
          {options.map((opt) => {
            const c = STATUS_DOT_COLORS[opt.toLowerCase()] || 'var(--accent-color, var(--text-accent))'
            const active = opt === current
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={active}
                className={`meta-select-option ${active ? 'is-active' : ''}`}
                onClick={() => {
                  onSelect(opt)
                  setOpen(false)
                }}
              >
                <span className="meta-select-dot" style={{ background: c }} />
                <span>{opt}</span>
                {active && <Check size={12} className="meta-select-check" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})
SelectPillControl.displayName = 'SelectPillControl'

export const MetadataPanel: React.FC<MetadataPanelProps> = React.memo(({ snippet }) => {
  const noteId = snippet?.id || null
  const [properties, setProperties] = useState<MetadataProperty[]>([])
  const [columns, setColumns] = useState<1 | 2 | 3>(1)
  const [draggedKey, setDraggedKey] = useState<string | null>(null)
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newKeyInput, setNewKeyInput] = useState('')
  const [newPropType, setNewPropType] = useState<MetadataPropertyType>('text')
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const loadedNoteRef = useRef<string | null>(null)
  const dragCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.()
    }
  }, [])

  // Load metadata & column layout from Rust SQLite (and seed any existing YAML frontmatter properties once)
  useEffect(() => {
    if (!noteId) {
      setProperties([])
      setColumns(1)
      loadedNoteRef.current = null
      return
    }

    let cancelled = false
    loadedNoteRef.current = noteId

    const load = async () => {
      const [dbEntries, savedCols] = await Promise.all([
        fetchNoteMetadata(noteId),
        fetchNoteMetadataColumns(noteId)
      ])
      if (cancelled) return

      setColumns(savedCols)

      if (dbEntries.length > 0) {
        setProperties(
          dbEntries.map((e) => ({
            key: e.key,
            value: e.value,
            type: (e.propType as MetadataPropertyType) || inferPropertyType(e.key, e.value)
          }))
        )
        return
      }

      // Fallback: read any YAML frontmatter properties already on the note and seed SQLite
      const yamlProps = extractCustomYamlProperties(snippet)
      const list = toPropertyList(yamlProps)
      setProperties(list)
      for (let i = 0; i < list.length; i++) {
        void upsertNoteMetadata(noteId, list[i].key, list[i].type, list[i].value, i)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [noteId])

  useEffect(() => {
    if (!addOpen) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (target && popoverRef.current && !popoverRef.current.contains(target)) {
        setAddOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [addOpen])

  const handleCommitValue = useCallback(
    (key: string, type: MetadataPropertyType, value: string) => {
      if (!noteId) return
      setProperties((prev) =>
        prev.map((item) => (item.key === key ? { ...item, value, type } : item))
      )
      void upsertNoteMetadata(noteId, key, type, value)
    },
    [noteId]
  )

  const handleDeleteProperty = useCallback(
    (key: string) => {
      if (!noteId) return
      setProperties((prev) => prev.filter((item) => item.key !== key))
      void deleteNoteMetadata(noteId, key)
    },
    [noteId]
  )

  const handleAddProperty = useCallback(
    (rawKey: string, type: MetadataPropertyType, defaultValue = '') => {
      if (!noteId) return
      const cleanKey = sanitizePropertyKey(rawKey)
      if (!cleanKey || isReservedMetadataKey(cleanKey)) return

      setProperties((prev) => {
        if (prev.some((p) => p.key.toLowerCase() === cleanKey.toLowerCase())) {
          return prev
        }
        const nextPos = prev.length
        void upsertNoteMetadata(noteId, cleanKey, type, defaultValue, nextPos)
        return [...prev, { key: cleanKey, type, value: defaultValue }]
      })
      setAddOpen(false)
      setNewKeyInput('')
      setNewPropType('text')
    },
    [noteId]
  )

  const handleChangeColumns = useCallback(
    (nextCols: 1 | 2 | 3) => {
      setColumns(nextCols)
      if (noteId) {
        void saveNoteMetadataColumns(noteId, nextCols)
      }
    },
    [noteId]
  )

  const handleRowPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, sourceKey: string) => {
      if (e.button !== 0 || !noteId) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, button, a, [role="listbox"], [role="dialog"]')) {
        return
      }

      const rowEl = e.currentTarget
      const startRect = rowEl.getBoundingClientRect()
      const offsetX = e.clientX - startRect.left
      const offsetY = e.clientY - startRect.top
      const startX = e.clientX
      const startY = e.clientY
      let active = false
      let currentTargetKey: string | null = null
      let prevCursor = ''
      let prevUserSelect = ''
      let rafId: number | null = null

      const positionGhost = (clientX: number, clientY: number) => {
        if (!ghostRef.current) return
        const x = clientX - offsetX
        const y = clientY - offsetY
        ghostRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
      }

      const cleanup = () => {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerUp)
        if (rafId !== null) {
          cancelAnimationFrame(rafId)
          rafId = null
        }
        if (active) {
          document.body.style.cursor = prevCursor
          document.body.style.userSelect = prevUserSelect
        }
        dragCleanupRef.current = null
      }

      const onPointerMove = (ev: PointerEvent) => {
        if (!active) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return
          active = true
          prevCursor = document.body.style.cursor
          prevUserSelect = document.body.style.userSelect
          document.body.style.cursor = 'grabbing'
          document.body.style.userSelect = 'none'
          setDraggedKey(sourceKey)
          requestAnimationFrame(() => {
            if (ghostRef.current) {
              ghostRef.current.style.width = `${startRect.width}px`
              positionGhost(ev.clientX, ev.clientY)
            }
          })
        } else {
          if (rafId !== null) cancelAnimationFrame(rafId)
          rafId = requestAnimationFrame(() => {
            positionGhost(ev.clientX, ev.clientY)
            rafId = null
          })
        }

        const container = listRef.current
        if (!container) return
        const rowEls = container.querySelectorAll<HTMLElement>('[data-prop-key]')
        let hitKey: string | null = null
        for (const el of rowEls) {
          const rect = el.getBoundingClientRect()
          if (
            ev.clientX >= rect.left &&
            ev.clientX <= rect.right &&
            ev.clientY >= rect.top &&
            ev.clientY <= rect.bottom
          ) {
            hitKey = el.getAttribute('data-prop-key')
            break
          }
        }

        const nextTarget = hitKey && hitKey !== sourceKey ? hitKey : null
        if (nextTarget !== currentTargetKey) {
          currentTargetKey = nextTarget
          setDropTargetKey(nextTarget)
        }
      }

      const onPointerUp = () => {
        cleanup()
        if (active) {
          const finalTarget = currentTargetKey
          setDraggedKey(null)
          setDropTargetKey(null)
          if (finalTarget && finalTarget !== sourceKey) {
            setProperties((prev) => {
              const fromIdx = prev.findIndex((p) => p.key === sourceKey)
              const toIdx = prev.findIndex((p) => p.key === finalTarget)
              if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev
              const next = [...prev]
              const [item] = next.splice(fromIdx, 1)
              next.splice(toIdx, 0, item)
              void reorderNoteMetadata(
                noteId,
                next.map((p) => p.key)
              )
              return next
            })
          }
        }
      }

      dragCleanupRef.current?.()
      dragCleanupRef.current = cleanup
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
    },
    [noteId]
  )

  if (!noteId || snippet?.isPartial) return null

  const existingKeys = new Set(properties.map((p) => p.key.toLowerCase()))
  const availablePresets = QUICK_PROPERTY_PRESETS.filter((p) => !existingKeys.has(p.key))
  const draggedProp = draggedKey ? properties.find((p) => p.key === draggedKey) || null : null

  return (
    <div className={`meta-props-root ${properties.length === 0 ? 'is-empty' : ''}`}>
      {properties.length > 0 && (
        <div
          ref={listRef}
          className={`meta-props-list meta-props-cols-${columns}`}
          data-cols={columns}
          role="region"
          aria-label="Note properties"
        >
          {properties.map((prop) => {
            const selectOptions =
              SELECT_PRESET_OPTIONS[prop.key.toLowerCase()] ||
              (prop.type === 'select' ? SELECT_PRESET_OPTIONS.status : undefined)
            const isDragging = draggedKey === prop.key
            const isDropTarget = dropTargetKey === prop.key && draggedKey !== prop.key

            return (
              <div
                key={prop.key}
                data-prop-key={prop.key}
                className={`meta-prop-row ${isDragging ? 'is-dragging' : ''} ${isDropTarget ? 'is-drop-target' : ''}`}
                onPointerDown={(e) => handleRowPointerDown(e, prop.key)}
              >
                <div className="meta-prop-key-cell" title={`${prop.key} (drag to reorder)`}>
                  <span className="meta-prop-drag-handle" aria-hidden="true">
                    <GripVertical size={11} />
                  </span>
                  <PropertyTypeIcon type={prop.type} />
                  <span className="meta-prop-key-label">{formatPropertyLabel(prop.key)}</span>
                </div>

                <div className="meta-prop-value-cell">
                  {prop.type === 'checkbox' ? (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={prop.value === 'true'}
                      aria-label={formatPropertyLabel(prop.key)}
                      className={`meta-prop-check-pill ${prop.value === 'true' ? 'is-checked' : ''}`}
                      onClick={() =>
                        handleCommitValue(
                          prop.key,
                          'checkbox',
                          prop.value === 'true' ? 'false' : 'true'
                        )
                      }
                    >
                      <span className="meta-prop-check-box">
                        {prop.value === 'true' && <Check size={8} strokeWidth={3} />}
                      </span>
                      <span>{prop.value === 'true' ? 'Done' : 'Not done'}</span>
                    </button>
                  ) : prop.type === 'select' && selectOptions ? (
                    <SelectPillControl
                      prop={prop}
                      options={selectOptions}
                      onSelect={(nextVal) => handleCommitValue(prop.key, 'select', nextVal)}
                    />
                  ) : prop.type === 'date' ? (
                    <CalendarDatePicker
                      value={prop.value}
                      label={formatPropertyLabel(prop.key)}
                      onChange={(nextDate) => handleCommitValue(prop.key, 'date', nextDate)}
                    />
                  ) : (
                    <SmoothValueInput prop={prop} onCommit={handleCommitValue} />
                  )}
                </div>

                <button
                  type="button"
                  className="meta-prop-delete"
                  title={`Remove ${formatPropertyLabel(prop.key)}`}
                  aria-label={`Remove ${formatPropertyLabel(prop.key)}`}
                  onClick={() => handleDeleteProperty(prop.key)}
                >
                  <X size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {draggedProp && (
        <div ref={ghostRef} className="meta-prop-drag-ghost" aria-hidden="true">
          <GripVertical size={11} className="meta-prop-type-icon" />
          <PropertyTypeIcon type={draggedProp.type} />
          <span className="meta-prop-key-label">{formatPropertyLabel(draggedProp.key)}</span>
          {draggedProp.value && (
            <span className="meta-prop-ghost-val">
              {draggedProp.type === 'checkbox'
                ? draggedProp.value === 'true'
                  ? 'Done'
                  : 'Not done'
                : draggedProp.value}
            </span>
          )}
        </div>
      )}

      <div className="meta-props-footer" ref={popoverRef}>
        <button
          type="button"
          className="meta-props-add-btn"
          onClick={() => setAddOpen((v) => !v)}
        >
          <Plus size={12} />
          <span>Add property</span>
        </button>

        {properties.length > 1 && (
          <div className="meta-props-layout-switch" role="group" aria-label="Property columns">
            <button
              type="button"
              className={`meta-props-col-btn ${columns === 1 ? 'is-active' : ''}`}
              title="1 Column"
              aria-label="1 Column"
              aria-pressed={columns === 1}
              onClick={() => handleChangeColumns(1)}
            >
              <Rows3 size={11} />
            </button>
            <button
              type="button"
              className={`meta-props-col-btn ${columns === 2 ? 'is-active' : ''}`}
              title="2 Columns"
              aria-label="2 Columns"
              aria-pressed={columns === 2}
              onClick={() => handleChangeColumns(2)}
            >
              <Columns2 size={11} />
            </button>
            <button
              type="button"
              className={`meta-props-col-btn ${columns === 3 ? 'is-active' : ''}`}
              title="3 Columns"
              aria-label="3 Columns"
              aria-pressed={columns === 3}
              onClick={() => handleChangeColumns(3)}
            >
              <Columns3 size={11} />
            </button>
          </div>
        )}

        {addOpen && (
          <div className="meta-props-add-popover" role="dialog" aria-label="Add note property">
            {availablePresets.length > 0 && (
              <div className="meta-props-presets">
                {availablePresets.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className="meta-props-preset-chip"
                    onClick={() =>
                      handleAddProperty(preset.key, preset.type, preset.defaultValue)
                    }
                  >
                    <PropertyTypeIcon type={preset.type} />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            )}

            <form
              className="meta-props-custom-form"
              onSubmit={(e) => {
                e.preventDefault()
                const defaultVal =
                  newPropType === 'checkbox'
                    ? 'false'
                    : newPropType === 'select'
                      ? 'In Progress'
                      : ''
                handleAddProperty(newKeyInput, newPropType, defaultVal)
              }}
            >
              <input
                type="text"
                className="meta-props-custom-input"
                placeholder="Property name..."
                value={newKeyInput}
                onChange={(e) => setNewKeyInput(e.target.value)}
                autoFocus
              />
              <div className="meta-props-type-row">
                <div className="meta-props-type-pills">
                  {PROPERTY_TYPE_CHOICES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`meta-props-type-pill ${newPropType === t.id ? 'is-active' : ''}`}
                      onClick={() => setNewPropType(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  className="meta-props-custom-submit"
                  disabled={
                    !sanitizePropertyKey(newKeyInput) ||
                    isReservedMetadataKey(sanitizePropertyKey(newKeyInput))
                  }
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
})

MetadataPanel.displayName = 'MetadataPanel'
export default MetadataPanel
