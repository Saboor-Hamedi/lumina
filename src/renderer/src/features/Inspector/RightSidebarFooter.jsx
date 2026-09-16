import React, { useState, useCallback } from 'react'
import { Copy, Check, X, FileText } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { Composer } from '../AI/Composer'
import { useAIStore } from '../AI/tools/lumina'

export const RightSidebarFooter = ({ selectedNote, selectedSnippet, rightSidebarTab, onClose }) => {
  const note = selectedNote || selectedSnippet
  const [copied, setCopied] = useState(false)
  const sendChatMessage = useAIStore((state) => state.sendChatMessage)
  const isChatLoading = useAIStore((state) => state.isChatLoading)
  const cancelChat = useAIStore((state) => state.cancelChat)

  const handleSendMessage = useCallback(
    async (text, mode = 'Standard', attachedMentions = []) => {
      if (!text.trim() && attachedMentions.length === 0) return

      try {
        const contextSnippets = []
        const addedIds = new Set()

        if (attachedMentions.length > 0) {
          attachedMentions.forEach((item) => {
            contextSnippets.push(item)
            addedIds.add(item.id)
          })
        } else if (note && !addedIds.has(note.id)) {
          contextSnippets.push(note)
          addedIds.add(note.id)
        }

        await sendChatMessage(text, contextSnippets, mode, attachedMentions)
      } catch (err) {
        console.error('Error sending message:', err)
      }
    },
    [note, sendChatMessage]
  )

  const wordCount = note?.code
    ? note.code.trim().split(/\s+/).filter(Boolean).length
    : 0

  const handleCopy = (e) => {
    e.stopPropagation()
    if (!note?.code) return
    navigator.clipboard.writeText(note.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (rightSidebarTab === 'chat') {
    return (
      <div className="inspector-footer-section is-chat-composer">
        <Composer
          isSidebar={true}
          onSend={handleSendMessage}
          isLoading={isChatLoading}
          onStop={cancelChat}
          onCancel={cancelChat}
        />
      </div>
    )
  }

  return (
    <div className="inspector-footer-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        {note ? (
          <>
            <FileText size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </span>
          </>
        ) : (
          <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)' }}>
            Inspector
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        {note?.code && (
          <ToolTip text={copied ? 'Copied!' : 'Copy Markdown'} position="top">
            <button
              className="inspector-footer-btn"
              onClick={handleCopy}
              aria-label="Copy Markdown"
              type="button"
            >
              {copied ? <Check size={12} color="var(--text-accent)" /> : <Copy size={12} />}
            </button>
          </ToolTip>
        )}

        {onClose && (
          <ToolTip text="Close Inspector" position="top">
            <button
              className="inspector-footer-btn"
              onClick={onClose}
              aria-label="Close Inspector"
              type="button"
            >
              <X size={12} />
            </button>
          </ToolTip>
        )}
      </div>
    </div>
  )
}

export default React.memo(RightSidebarFooter)
