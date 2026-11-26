import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Image as ImageIcon,
  MoveVertical,
  Trash2,
  Upload,
  Check,
  X,
  SmilePlus,
  Clock,
  Plus
} from 'lucide-react'
import { ToolTip } from '../../../ui/Tooltip'
import { useSettingStore } from '../../../core/store/SettingStore'
import MetaProfile from './MetaProfile'
import { COVER_WALLPAPERS } from './coverWallpapers'
import './noteCover.css'

export interface NoteCoverConfig {
  type: 'gradient' | 'image'
  value: string
  positionY?: number
}

export interface NoteAppearanceEntry {
  cover?: NoteCoverConfig | null
  emoji?: string | null
}

type CoverPickerTab = 'image' | 'link' | 'upload'

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
    const [activeTab, setActiveTab] = useState<CoverPickerTab>('image')
    const [urlInput, setUrlInput] = useState('')
    const [urlError, setUrlError] = useState('')
    const [urlPreviewStatus, setUrlPreviewStatus] = useState<'idle' | 'valid' | 'error'>('idle')
    const [isDraggingFile, setIsDraggingFile] = useState(false)
    const [isRepositioning, setIsRepositioning] = useState(false)
    const [dragPosY, setDragPosY] = useState<number | null>(null)

    const rootRef = useRef<HTMLDivElement | null>(null)
    const coverPopoverRef = useRef<HTMLDivElement | null>(null)
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
        const target = e.target as HTMLElement | null
        if (!target) return
        if (
          coverPopoverRef.current &&
          !coverPopoverRef.current.contains(target) &&
          !target.closest('[data-meta-cover-trigger="true"]')
        ) {
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
      const preset = COVER_WALLPAPERS[Math.floor(Math.random() * COVER_WALLPAPERS.length)]
      applyCover({ type: 'image', value: preset.value, positionY: 50 })
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

    const processUploadFile = useCallback(
      (file: File | null | undefined) => {
        if (!file) return
        if (!/^image\/(png|jpeg|jpg|webp|gif|avif)$/i.test(file.type) && !file.type.startsWith('image/')) {
          setUrlError('Please select a PNG, JPG, or WebP image')
          return
        }
        if (file.size > 4 * 1024 * 1024) {
          setUrlError('Image must be under 4 MB')
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result
          if (typeof dataUrl !== 'string') return
          // Downscale uploaded cover banner in-memory to max width 1200px so WebView2's GPU
          // process does not decode multi-megabyte raw RGBA textures in app_config.json
          const probe = new Image()
          probe.onload = () => {
            try {
              const MAX_COVER_WIDTH = 1200
              if (probe.naturalWidth > MAX_COVER_WIDTH) {
                const scale = MAX_COVER_WIDTH / probe.naturalWidth
                const canvas = document.createElement('canvas')
                canvas.width = MAX_COVER_WIDTH
                canvas.height = Math.max(1, Math.round(probe.naturalHeight * scale))
                const ctx = canvas.getContext('2d')
                if (ctx) {
                  ctx.drawImage(probe, 0, 0, canvas.width, canvas.height)
                  const resized = canvas.toDataURL('image/jpeg', 0.88)
                  setUrlError('')
                  applyCover({ type: 'image', value: resized, positionY: 50 })
                  setPickerOpen(false)
                  return
                }
              }
            } catch {}
            setUrlError('')
            applyCover({ type: 'image', value: dataUrl, positionY: 50 })
            setPickerOpen(false)
          }
          probe.onerror = () => {
            setUrlError('')
            applyCover({ type: 'image', value: dataUrl, positionY: 50 })
            setPickerOpen(false)
          }
          probe.src = dataUrl
        }
        reader.readAsDataURL(file)
      },
      [applyCover]
    )

    const handleFileChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        processUploadFile(e.target.files?.[0])
        e.target.value = ''
      },
      [processUploadFile]
    )

    const handleUploadDrop = useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDraggingFile(false)
        processUploadFile(e.dataTransfer?.files?.[0])
      },
      [processUploadFile]
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
                    data-meta-cover-trigger="true"
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
              {displayTimestamp && (
                <ToolTip text={timestampTooltip} position="bottom">
                  <div className="note-cover-inline-time">
                    <Clock size={11} />
                    <span>{displayTimestamp}</span>
                  </div>
                </ToolTip>
              )}
            </div>
            <div className="note-cover-empty-right">
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
              {menuSlot}
            </div>
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
          <div
            ref={coverPopoverRef}
            className="note-cover-popover"
            role="dialog"
            aria-label="Choose note background"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <div className="note-cover-popover-header">Background</div>

            <div className="note-cover-segmented" role="tablist" aria-label="Background source">
              {(
                [
                  { id: 'image', label: 'Image' },
                  { id: 'link', label: 'Link' },
                  { id: 'upload', label: 'Upload' }
                ] as Array<{ id: CoverPickerTab; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`note-cover-seg-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setActiveTab(tab.id)
                    if (urlError) setUrlError('')
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'image' && (
              <div className="note-cover-image-grid" role="listbox" aria-label="Cover backgrounds">
                {COVER_WALLPAPERS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`note-cover-swatch is-square ${cover?.value === preset.value ? 'is-selected' : ''}`}
                    aria-label={preset.label}
                    data-tooltip={preset.label}
                    data-tooltip-pos="top"
                    onClick={() => applyCover({ type: 'image', value: preset.value, positionY: 50 })}
                  >
                    <img
                      className="note-cover-swatch-img"
                      src={preset.value}
                      alt={preset.label}
                      draggable={false}
                    />
                  </button>
                ))}
                <button
                  type="button"
                  className="note-cover-swatch is-square is-upload-slot"
                  aria-label="Upload custom cover image"
                  data-tooltip="Upload image"
                  data-tooltip-pos="top"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus size={15} strokeWidth={2} />
                </button>
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
                    const nextVal = e.target.value
                    setUrlInput(nextVal)
                    setUrlPreviewStatus('idle')
                    if (urlError) setUrlError('')
                  }}
                  autoFocus
                />
                {/^https?:\/\/\S+$/i.test(urlInput.trim()) && (
                  <div className={`note-cover-link-preview ${urlPreviewStatus === 'error' ? 'is-invalid' : ''}`}>
                    {urlPreviewStatus !== 'error' ? (
                      <img
                        src={urlInput.trim()}
                        alt="Cover URL preview"
                        onLoad={() => setUrlPreviewStatus('valid')}
                        onError={() => setUrlPreviewStatus('error')}
                      />
                    ) : (
                      <span>Unable to load preview for this URL</span>
                    )}
                  </div>
                )}
                {urlError && <div className="note-cover-error">{urlError}</div>}
                <button type="submit" className="note-cover-submit-btn">
                  Apply Cover
                </button>
              </form>
            )}

            {activeTab === 'upload' && (
              <div className="note-cover-upload-pane">
                <div
                  className={`note-cover-dropzone ${isDraggingFile ? 'is-dragging' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!isDraggingFile) setIsDraggingFile(true)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDraggingFile(false)
                  }}
                  onDrop={handleUploadDrop}
                >
                  <Upload size={16} />
                  <span className="note-cover-dropzone-title">Drop an image or click to browse</span>
                  <span className="note-cover-dropzone-hint">PNG, JPG, or WebP · max 4 MB</span>
                </div>
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
