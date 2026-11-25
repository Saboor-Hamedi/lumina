import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Image as ImageIcon,
  MoveVertical,
  Trash2,
  Upload,
  Link2,
  Check,
  X,
  SmilePlus,
  Clock
} from 'lucide-react'
import { ToolTip } from '../../../ui/Tooltip'
import { useSettingStore } from '../../../core/store/SettingStore'
import MetaProfile from './MetaProfile'
import './noteCover.css'

export interface NoteCoverConfig {
  type: 'gradient' | 'solid' | 'image'
  value: string
  positionY?: number
}

export interface NoteAppearanceEntry {
  cover?: NoteCoverConfig | null
  emoji?: string | null
}

const GRADIENT_PRESETS: Array<{ id: string; label: string; value: string }> = [
  { id: 'aurora', label: 'Aurora Dusk', value: 'linear-gradient(120deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)' },
  { id: 'ocean', label: 'Ocean Mist', value: 'linear-gradient(120deg, #0ea5e9 0%, #2563eb 55%, #4f46e5 100%)' },
  { id: 'sunset', label: 'Sunset Silk', value: 'linear-gradient(120deg, #f97316 0%, #ef4444 55%, #ec4899 100%)' },
  { id: 'forest', label: 'Forest Moss', value: 'linear-gradient(120deg, #059669 0%, #10b981 50%, #14b8a6 100%)' },
  { id: 'slate', label: 'Midnight Slate', value: 'linear-gradient(120deg, #1e293b 0%, #334155 55%, #475569 100%)' },
  { id: 'amber', label: 'Warm Amber', value: 'linear-gradient(120deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)' },
  { id: 'rose', label: 'Rose Velvet', value: 'linear-gradient(120deg, #be185d 0%, #db2777 50%, #f472b6 100%)' },
  { id: 'nord', label: 'Arctic Calm', value: 'linear-gradient(120deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)' }
]

const SOLID_PRESETS: Array<{ id: string; label: string; value: string }> = [
  { id: 'charcoal', label: 'Charcoal', value: '#27272a' },
  { id: 'indigo', label: 'Deep Indigo', value: '#312e81' },
  { id: 'emerald', label: 'Pine', value: '#064e3b' },
  { id: 'terracotta', label: 'Terracotta', value: '#9a3412' },
  { id: 'plum', label: 'Plum', value: '#581c87' },
  { id: 'sand', label: 'Warm Sand', value: '#d6cfc2' }
]

function formatNoteTimestamp(ts?: number | null): string | null {
  if (!ts || !Number.isFinite(ts)) return null
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export interface MetaBackgroundProps {
  noteId?: string | null
  createdAt?: number
  updatedAt?: number
  timestamp?: number
  menuSlot?: React.ReactNode
}

/**
 * MetaBackground — Notion-style Note Cover Banner + Timestamp Badge + MetaProfile
 *
 * Persists exclusively in `app_config.json` via `useSettingStore` (`noteAppearance`),
 * with narrow selector + React.memo for zero-overhead tab switching.
 */
export const MetaBackground: React.FC<MetaBackgroundProps> = React.memo(
  ({ noteId, createdAt, updatedAt, timestamp, menuSlot }) => {
    const entry = useSettingStore(
      useCallback(
        (s) => (noteId ? s.settings?.noteAppearance?.[noteId] ?? null : null),
        [noteId]
      )
    )

    const cover = entry?.cover ?? null
    const emoji = entry?.emoji ?? null

    const [pickerOpen, setPickerOpen] = useState(false)
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'gallery' | 'link' | 'upload'>('gallery')
    const [urlInput, setUrlInput] = useState('')
    const [urlError, setUrlError] = useState('')
    const [isRepositioning, setIsRepositioning] = useState(false)
    const [dragPosY, setDragPosY] = useState<number | null>(null)

    const rootRef = useRef<HTMLDivElement | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const dragStartRef = useRef<{ y: number; startPos: number } | null>(null)

    const effectivePosY = dragPosY ?? cover?.positionY ?? 50

    const displayTimestamp = useMemo(
      () => formatNoteTimestamp(updatedAt ?? timestamp ?? createdAt),
      [updatedAt, timestamp, createdAt]
    )
    const createdTimestamp = useMemo(
      () => formatNoteTimestamp(createdAt ?? timestamp),
      [createdAt, timestamp]
    )

    // Only reset transient UI state on note switch if a popover/drag was actually open
    useEffect(() => {
      setPickerOpen((v) => (v ? false : v))
      setEmojiPickerOpen((v) => (v ? false : v))
      setIsRepositioning((v) => (v ? false : v))
      setDragPosY((v) => (v !== null ? null : v))
      setUrlError((v) => (v ? '' : v))
    }, [noteId])

    useEffect(() => {
      if (!pickerOpen) return
      const onPointerDown = (e: MouseEvent) => {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
          setPickerOpen(false)
        }
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setPickerOpen(false)
      }
      document.addEventListener('mousedown', onPointerDown, true)
      window.addEventListener('keydown', onKeyDown)
      return () => {
        document.removeEventListener('mousedown', onPointerDown, true)
        window.removeEventListener('keydown', onKeyDown)
      }
    }, [pickerOpen])

    const saveAppearance = useCallback(
      (patch: Partial<NoteAppearanceEntry>) => {
        if (!noteId) return
        const store = useSettingStore.getState()
        const currentMap = store.settings?.noteAppearance || {}
        const prevEntry = currentMap[noteId] || {}
        const nextEntry: NoteAppearanceEntry = { ...prevEntry, ...patch }
        const nextMap = { ...currentMap }
        if (!nextEntry.cover && !nextEntry.emoji) {
          delete nextMap[noteId]
        } else {
          nextMap[noteId] = nextEntry
        }
        store.updateSetting('noteAppearance', nextMap)
      },
      [noteId]
    )

    const applyCover = useCallback(
      (next: NoteCoverConfig | null) => {
        setDragPosY(null)
        saveAppearance({ cover: next })
      },
      [saveAppearance]
    )

    const applyEmoji = useCallback(
      (next: string | null) => {
        saveAppearance({ emoji: next })
        setEmojiPickerOpen(false)
      },
      [saveAppearance]
    )

    const handleToggleEmoji = useCallback(() => {
      setPickerOpen(false)
      setEmojiPickerOpen((v) => !v)
    }, [])

    const handleCloseEmoji = useCallback(() => {
      setEmojiPickerOpen(false)
    }, [])

    const handleAddRandomCover = useCallback(() => {
      const preset = GRADIENT_PRESETS[Math.floor(Math.random() * GRADIENT_PRESETS.length)]
      applyCover({ type: 'gradient', value: preset.value })
    }, [applyCover])

    const handleApplyUrl = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = urlInput.trim()
        if (!/^https?:\/\/\S+$/i.test(trimmed)) {
          setUrlError('Enter a valid http:// or https:// image URL')
          return
        }
        setUrlError('')
        applyCover({ type: 'image', value: trimmed, positionY: 50 })
        setUrlInput('')
        setPickerOpen(false)
      },
      [urlInput, applyCover]
    )

    const handleFileChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
          setUrlError('Please select an image file')
          return
        }
        if (file.size > 4 * 1024 * 1024) {
          setUrlError('Image must be under 4 MB')
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setUrlError('')
            applyCover({ type: 'image', value: reader.result, positionY: 50 })
            setPickerOpen(false)
          }
        }
        reader.readAsDataURL(file)
        e.target.value = ''
      },
      [applyCover]
    )

    const handleBannerMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!isRepositioning) return
        e.preventDefault()
        dragStartRef.current = { y: e.clientY, startPos: effectivePosY }

        const onMove = (ev: MouseEvent) => {
          if (!dragStartRef.current) return
          const delta = ev.clientY - dragStartRef.current.y
          const next = Math.max(0, Math.min(100, Math.round(dragStartRef.current.startPos - delta * 0.45)))
          setDragPosY(next)
        }
        const onUp = () => {
          dragStartRef.current = null
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      },
      [isRepositioning, effectivePosY]
    )

    const handleSaveReposition = useCallback(() => {
      if (cover) {
        applyCover({ ...cover, positionY: effectivePosY })
      }
      setIsRepositioning(false)
    }, [cover, effectivePosY, applyCover])

    if (!noteId) return null

    const timestampTooltip =
      createdTimestamp && displayTimestamp && createdTimestamp !== displayTimestamp
        ? `Updated ${displayTimestamp} · Created ${createdTimestamp}`
        : `Last updated ${displayTimestamp}`

    return (
      <div
        ref={rootRef}
        className={`note-cover-root ${cover ? 'has-cover' : 'no-cover'} ${emoji ? 'has-emoji' : ''}`}
      >
        {cover ? (
          <div className="note-cover-banner-wrap">
            <div
              className={`note-cover-banner ${isRepositioning ? 'is-repositioning' : ''}`}
              style={cover.type === 'image' ? undefined : { background: cover.value }}
              onMouseDown={handleBannerMouseDown}
            >
              {cover.type === 'image' && (
                <img
                  className="note-cover-img"
                  src={cover.value}
                  alt="Note cover"
                  decoding="async"
                  draggable={false}
                  style={{ objectPosition: `center ${effectivePosY}%` }}
                />
              )}

              {/* Clear Note Timestamp Badge on the Background */}
              {displayTimestamp && (
                <ToolTip text={timestampTooltip} position="bottom">
                  <div className="note-cover-timestamp">
                    <Clock size={10} />
                    <span>{displayTimestamp}</span>
                  </div>
                </ToolTip>
              )}

              {isRepositioning ? (
                <div className="note-cover-reposition-bar">
                  <span className="note-cover-reposition-hint">Drag image to reposition</span>
                  <button
                    type="button"
                    className="note-cover-ctrl-btn is-primary"
                    onClick={handleSaveReposition}
                  >
                    <Check size={10} />
                    <span>Save</span>
                  </button>
                  <button
                    type="button"
                    className="note-cover-ctrl-btn"
                    onClick={() => {
                      setDragPosY(null)
                      setIsRepositioning(false)
                    }}
                  >
                    <X size={10} />
                    <span>Cancel</span>
                  </button>
                </div>
              ) : (
                <div className="note-cover-controls">
                  {!emoji && (
                    <button
                      type="button"
                      data-meta-profile-trigger="true"
                      className="note-cover-ctrl-btn"
                      onClick={handleToggleEmoji}
                    >
                      <SmilePlus size={10} />
                      <span>Add icon</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="note-cover-ctrl-btn"
                    onClick={() => {
                      setEmojiPickerOpen(false)
                      setPickerOpen((v) => !v)
                    }}
                  >
                    <ImageIcon size={10} />
                    <span>Change cover</span>
                  </button>
                  {cover.type === 'image' && (
                    <ToolTip text="Reposition cover" position="top">
                      <button
                        type="button"
                        className="note-cover-ctrl-btn"
                        onClick={() => {
                          setPickerOpen(false)
                          setIsRepositioning(true)
                        }}
                      >
                        <MoveVertical size={10} />
                        <span>Reposition</span>
                      </button>
                    </ToolTip>
                  )}
                  <ToolTip text="Remove cover" position="top">
                    <button
                      type="button"
                      className="note-cover-ctrl-btn is-icon-only is-danger"
                      aria-label="Remove cover"
                      onClick={() => {
                        setPickerOpen(false)
                        applyCover(null)
                      }}
                    >
                      <Trash2 size={10} />
                    </button>
                  </ToolTip>
                </div>
              )}
            </div>
            {menuSlot && <div className="note-cover-top-menu">{menuSlot}</div>}
          </div>
        ) : (
          <div className="note-cover-empty-strip">
            <div className="note-cover-empty-left">
              {!emoji && (
                <button
                  type="button"
                  data-meta-profile-trigger="true"
                  className="note-cover-add-btn"
                  onClick={handleToggleEmoji}
                >
                  <SmilePlus size={12} />
                  <span>Add icon</span>
                </button>
              )}
              <button
                type="button"
                className="note-cover-add-btn"
                onClick={handleAddRandomCover}
              >
                <ImageIcon size={12} />
                <span>Add cover</span>
              </button>
            </div>
            {menuSlot && <div className="note-cover-empty-right">{menuSlot}</div>}
          </div>
        )}

        <MetaProfile
          emoji={emoji}
          hasCover={Boolean(cover)}
          isOpen={emojiPickerOpen}
          onToggle={handleToggleEmoji}
          onClose={handleCloseEmoji}
          onSelect={applyEmoji}
        />

        {pickerOpen && (
          <div className="note-cover-popover" role="dialog" aria-label="Choose note cover">
            <div className="note-cover-tabs">
              <button
                type="button"
                className={`note-cover-tab ${activeTab === 'gallery' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('gallery')}
              >
                Gallery
              </button>
              <button
                type="button"
                className={`note-cover-tab ${activeTab === 'link' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('link')}
              >
                <Link2 size={11} />
                <span>Link</span>
              </button>
              <button
                type="button"
                className={`note-cover-tab ${activeTab === 'upload' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                <Upload size={11} />
                <span>Upload</span>
              </button>
            </div>

            {activeTab === 'gallery' && (
              <div className="note-cover-gallery">
                <div className="note-cover-section-label">Gradients</div>
                <div className="note-cover-swatch-grid">
                  {GRADIENT_PRESETS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className={`note-cover-swatch ${cover?.value === g.value ? 'is-selected' : ''}`}
                      style={{ background: g.value }}
                      aria-label={g.label}
                      data-tooltip={g.label}
                      data-tooltip-pos="top"
                      onClick={() => applyCover({ type: 'gradient', value: g.value })}
                    />
                  ))}
                </div>
                <div className="note-cover-section-label">Colors</div>
                <div className="note-cover-swatch-grid">
                  {SOLID_PRESETS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`note-cover-swatch ${cover?.value === s.value ? 'is-selected' : ''}`}
                      style={{ background: s.value }}
                      aria-label={s.label}
                      data-tooltip={s.label}
                      data-tooltip-pos="top"
                      onClick={() => applyCover({ type: 'solid', value: s.value })}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'link' && (
              <form className="note-cover-link-form" onSubmit={handleApplyUrl}>
                <input
                  type="url"
                  className="note-cover-url-input"
                  placeholder="Paste an image URL (https://...)"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value)
                    if (urlError) setUrlError('')
                  }}
                  autoFocus
                />
                {urlError && <div className="note-cover-error">{urlError}</div>}
                <button type="submit" className="note-cover-submit-btn">
                  Apply Cover
                </button>
              </form>
            )}

            {activeTab === 'upload' && (
              <div className="note-cover-upload-pane">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  className="note-cover-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} />
                  <span>Choose an image (max 4 MB)</span>
                </button>
                {urlError && <div className="note-cover-error">{urlError}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)

MetaBackground.displayName = 'MetaBackground'
export default MetaBackground
