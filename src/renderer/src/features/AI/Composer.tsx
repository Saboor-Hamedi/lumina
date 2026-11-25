import React, { Suspense, lazy, useState, useCallback, useEffect, useRef, KeyboardEvent, DragEvent } from 'react'
import { Send, Square, ChevronDown, Plus } from 'lucide-react'
import { useSettingsStore } from '../../core/store/SettingStore'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import ToolTip from '../../components/atoms/ToolTip'
import VoiceButton from '../voice'
import { useComposerTextarea } from './hooks/useComposerTextarea'
import { useComposerVoice } from './hooks/useComposerVoice'
import { useComposerAutocomplete } from './hooks/useComposerAutocomplete'
import { getAIMode } from './modes'
import './css/composer.css'

const LuminaSlash = lazy(() => import('./LuminaSlash'))
const LuminaMention = lazy(() => import('./LuminaMention'))

export interface ComposerProps {
  onSend: (text: string, mode: string, attachedMentions: any[]) => void
  onStop?: () => void
  onCancel?: () => void
  isLoading?: boolean
  isSidebar?: boolean
}

/**
 * Composer provides the primary input card for Lumina AI prompts:
 * auto-resizing textarea, voice-to-text recording, keyboard shortcuts,
 * command (/), and context (@) autocomplete triggers.
 */
export const Composer: React.FC<ComposerProps> = ({
  onSend,
  onStop,
  onCancel,
  isLoading = false,
  isSidebar = false
}) => {
  const [input, setInput] = useState<string>('')
  const [isDragOver, setIsDragOver] = useState<boolean>(false)
  const composerCardRef = useRef<HTMLDivElement | null>(null)
  const handleStop = onStop || onCancel

  const { settings, updateSetting } = useSettingsStore()
  const mode = getAIMode(settings.activeAIMode).name
  const setMode = (newMode: string) => updateSetting('activeAIMode', newMode)

  const textareaRef = useComposerTextarea({ input, isSidebar, isLoading })
  useComposerVoice({ input, setInput, textareaRef })

  const {
    showSlashMenu,
    setShowSlashMenu,
    slashFilter,
    showMentionMenu,
    setShowMentionMenu,
    mentionFilter,
    attachedMentions,
    setAttachedMentions,
    handleInputChange,
    handleCommandSelect,
    handleMentionSelect
  } = useComposerAutocomplete({
    input,
    setInput,
    textareaRef,
    setMode,
    mode,
    onSend
  })

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return
    onSend(input, mode, attachedMentions)
    setInput('')
    setAttachedMentions([])
  }, [input, isLoading, onSend, mode, attachedMentions, setAttachedMentions])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu || showMentionMenu) {
      if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getProviderLabel = (): string => {
    switch (settings.activeProvider) {
      case 'openai':
        return 'GPT-4o'
      case 'anthropic':
        return 'Claude'
      case 'ollama':
        return 'Ollama'
      default:
        return 'DeepSeek'
    }
  }

  const toggleProvider = () =>
    window.dispatchEvent(new CustomEvent('open-ai-settings'))

  const isNoteDrag = (e: DragEvent): boolean => {
    const types = Array.from(e.dataTransfer?.types || [])
    return (
      types.includes('application/lumina-snippet') ||
      types.includes('application/x-lumina-node') ||
      types.includes('application/lumina-note')
    )
  }

  const handleComposerDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!isNoteDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
    window.dispatchEvent(
      new CustomEvent('lumina:workspace-drag-hover', {
        detail: { isOver: false, isExternal: false, title: '', count: 1 }
      })
    )
  }, [])

  const handleComposerDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragOver(false)
    }
  }, [])

  const handleComposerDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!isNoteDrag(e)) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const raw =
        e.dataTransfer.getData('application/lumina-snippet') ||
        e.dataTransfer.getData('application/x-lumina-node') ||
        e.dataTransfer.getData('application/lumina-note')
      if (!raw) return

      try {
        const parsed = JSON.parse(raw)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        const storeNotes = useWorkspaceStore.getState().notes || []

        for (const item of items) {
          if (!item) continue
          const matched =
            storeNotes.find((n: any) => n.id === item.id) ||
            (item.title ? storeNotes.find((n: any) => n.title === item.title) : null)

          if (matched) {
            handleMentionSelect(matched)
          } else if (item.title || item.name || item.path) {
            handleMentionSelect({
              id: item.id || item.path || item.title || item.name,
              title: item.title || item.name || String(item.path).split('/').pop(),
              path: item.path,
              isFolder: item.type === 'folder' || Boolean(item.isFolder)
            })
          }
        }
      } catch (err) {
        console.error('[Composer] Failed to attach dropped note as mention:', err)
      }
    },
    [handleMentionSelect]
  )

  const handleMentionSelectRef = useRef(handleMentionSelect)
  handleMentionSelectRef.current = handleMentionSelect

  useEffect(() => {
    const onComposerDragHover = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      const targetEl = detail.composerEl as HTMLElement | null
      if (!detail.isOver) {
        setIsDragOver(false)
        return
      }
      setIsDragOver(Boolean(composerCardRef.current && targetEl === composerCardRef.current))
    }

    const onComposerDropNote = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      const targetEl = detail.composerEl as HTMLElement | null
      if (targetEl && composerCardRef.current && targetEl !== composerCardRef.current) return
      setIsDragOver(false)
      const notes = Array.isArray(detail.notes) ? detail.notes : []
      if (notes.length === 0) return

      if (notes.length === 1) {
        handleMentionSelectRef.current(notes[0])
        return
      }

      // Multi-note drag from Explorer: attach all mentions and append all @Title tokens cleanly
      const tags = notes.map((n: any) => `@${n?.title || 'Untitled'}`).join(' ')
      setInput((prev) => {
        const needsSpace = Boolean(prev) && !/\s$/.test(prev)
        return `${prev}${needsSpace ? ' ' : ''}${tags} `
      })
      setAttachedMentions((prev) => {
        const existingIds = new Set(prev.map((m) => m.id))
        const toAdd = notes.filter((n: any) => n && !existingIds.has(n.id))
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev
      })
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          const len = textareaRef.current.value.length
          textareaRef.current.setSelectionRange(len, len)
        }
      }, 0)
    }

    window.addEventListener('lumina:composer-drag-hover', onComposerDragHover)
    window.addEventListener('lumina:composer-drop-note', onComposerDropNote)
    return () => {
      window.removeEventListener('lumina:composer-drag-hover', onComposerDragHover)
      window.removeEventListener('lumina:composer-drop-note', onComposerDropNote)
    }
  }, [setInput, setAttachedMentions, textareaRef])

  return (
    <div className={`composer-container ${isSidebar ? 'is-sidebar-docked' : ''}`}>
      {showSlashMenu && (
        <Suspense fallback={null}>
          <LuminaSlash
            isOpen={showSlashMenu}
            filterText={slashFilter}
            activeMode={mode}
            onSelect={handleCommandSelect}
            onClose={() => setShowSlashMenu(false)}
          />
        </Suspense>
      )}

      {showMentionMenu && (
        <Suspense fallback={null}>
          <LuminaMention
            isOpen={showMentionMenu}
            filterText={mentionFilter}
            onSelect={handleMentionSelect}
            onClose={() => setShowMentionMenu(false)}
          />
        </Suspense>
      )}

      <div
        ref={composerCardRef}
        className={`composer-card ${isDragOver ? 'is-drag-over' : ''}`}
        onClick={() => textareaRef.current?.focus()}
        onDragEnter={handleComposerDragOver}
        onDragOver={handleComposerDragOver}
        onDragLeave={handleComposerDragLeave}
        onDrop={handleComposerDrop}
      >
        <div className="composer-input-area-wrapper">
          <textarea
            ref={textareaRef}
            className="composer-textarea"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isSidebar
                ? "Ask AI... ('@', '/')"
                : "Ask Lumina AI... ('@' note, '/' cmd)"
            }
            rows={isSidebar ? 3 : 1}
            disabled={isLoading}
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>

        <div className="composer-inner-footer">
          <div className="composer-left">
            <ToolTip text="Commands & Modes (/)" position="top">
              <button
                type="button"
                className="composer-plus-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowSlashMenu((prev) => !prev)
                  if (textareaRef.current) textareaRef.current.focus()
                }}
                title="Commands & Modes"
              >
                <Plus size={13} />
              </button>
            </ToolTip>

            <ToolTip text="Change AI mode (/)" position="top">
              <button
                type="button"
                className="model-pill model-pill-mode"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowSlashMenu((prev) => !prev)
                  if (textareaRef.current) textareaRef.current.focus()
                }}
              >
                <span className="model-pill-name">{mode}</span>
                <ChevronDown size={10} className="model-pill-chevron" />
              </button>
            </ToolTip>

            <ToolTip text="Change AI model" position="top">
              <button className="model-pill" onClick={toggleProvider}>
                <span className="model-pill-name">{getProviderLabel()}</span>
                <ChevronDown size={10} className="model-pill-chevron" />
              </button>
            </ToolTip>
          </div>

          <div className="composer-right">
            {input.trim().length > 0 && (
              <span className="composer-char-count">
                {(() => {
                  const words = input.trim().split(/\s+/).filter(Boolean).length
                  return `${words} ${words === 1 ? 'word' : 'words'}`
                })()}
              </span>
            )}

            <VoiceButton id="composer-voice" tooltipPosition="top" />

            {isLoading ? (
              <ToolTip text="Stop generation" position="top">
                <button
                  className="composer-stop-btn"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (handleStop) handleStop()
                  }}
                >
                  <Square size={11} fill="currentColor" />
                </button>
              </ToolTip>
            ) : (
              <ToolTip text="Send (Enter)" position="top">
                <button
                  className="composer-send-btn"
                  onClick={handleSend}
                  disabled={!input.trim()}
                >
                  <Send size={13} />
                </button>
              </ToolTip>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Composer
