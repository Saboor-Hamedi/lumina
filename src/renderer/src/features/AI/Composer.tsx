import React, { useState, useCallback, KeyboardEvent } from 'react'
import { Send, Square, ChevronDown, Plus } from 'lucide-react'
import { LuminaSlash } from './LuminaSlash'
import LuminaMention from './LuminaMention'
import { useSettingsStore } from '../../core/store/SettingStore'
import ToolTip from '../../components/atoms/ToolTip'
import VoiceButton from '../voice'
import { useComposerTextarea } from './hooks/useComposerTextarea'
import { useComposerVoice } from './hooks/useComposerVoice'
import { useComposerAutocomplete } from './hooks/useComposerAutocomplete'
import './css/composer.css'

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
  const handleStop = onStop || onCancel

  const { settings, updateSetting } = useSettingsStore()
  const mode = settings.activeAIMode || 'Code'
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
  } = useComposerAutocomplete({ input, setInput, textareaRef, setMode })

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

  return (
    <div className={`composer-container ${isSidebar ? 'is-sidebar-docked' : ''}`}>
      <LuminaSlash
        isOpen={showSlashMenu}
        filterText={slashFilter}
        activeMode={mode}
        onSelect={handleCommandSelect}
        onClose={() => setShowSlashMenu(false)}
      />

      <LuminaMention
        isOpen={showMentionMenu}
        filterText={mentionFilter}
        onSelect={handleMentionSelect}
        onClose={() => setShowMentionMenu(false)}
      />

      <div className="composer-card" onClick={() => textareaRef.current?.focus()}>
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
