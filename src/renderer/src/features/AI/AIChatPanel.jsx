import React, { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Virtuoso } from 'react-virtuoso'
import { useAIStore } from '../../core/store/useAIStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import '../Layout/AppShell.css'

const CodeBlock = React.memo(({ inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '')
  const [copied, setCopied] = useState(false)

  if (!inline && match) {
    return (
      <div className="chat-code-block">
        <div className="chat-code-header">
          <span className="chat-code-lang">{match[1]}</span>
          <button
            className="chat-copy-btn"
            onClick={() => {
              navigator.clipboard.writeText(String(children).replace(/\n$/, ''))
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre>
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      </div>
    )
  }
  return (
    <code className={className} {...props}>
      {children}
    </code>
  )
})

const MessageContent = React.memo(({ content }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      pre: ({ children }) => <>{children}</>,
      code: CodeBlock
    }}
  >
    {content}
  </ReactMarkdown>
))

const AIChatPanel = () => {
  const { chatMessages, isChatLoading, chatError, sendChatMessage, clearChat } = useAIStore()
  const { selectedSnippet } = useVaultStore()

  return (
    <div className="chat-interface">
      {chatMessages.length > 0 && (
        <button
          className="chat-clear-btn"
          onClick={clearChat}
          title="Clear Conversation"
        >
          Clear History
        </button>
      )}
      
      {/* Virtualized List Container */}
      <div className="chat-messages" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {chatMessages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">✨</div>
            <p>Ask me anything...</p>
            {selectedSnippet && (
              <button
                className="chat-suggestion-btn"
                onClick={() =>
                  sendChatMessage(`Explain the code in "${selectedSnippet.title}"`, [selectedSnippet])
                }
              >
                Explain "{selectedSnippet.title}"
              </button>
            )}
          </div>
        ) : (
          <Virtuoso
            style={{ height: '100%' }}
            data={chatMessages}
            followOutput="smooth"
            itemContent={(index, msg) => (
              <div 
                className={`chat-bubble ${msg.role}`}
                style={{ marginBottom: '12px' }} // Add margin here since flex gap is gone
              >
                <MessageContent content={msg.content} />
              </div>
            )}
            components={{
              Footer: () => (
                <div style={{ paddingBottom: '20px' }}>
                  {isChatLoading && (
                    <div className="chat-bubble assistant typing">
                      <span>.</span><span>.</span><span>.</span>
                    </div>
                  )}
                  {chatError && <div className="chat-error">{chatError}</div>}
                </div>
              )
            }}
          />
        )}
      </div>

      <div className="chat-input-area">
        <textarea
          placeholder="Type a message... (Tip: I see active note)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              const text = e.target.value.trim()
              if (!text) return

              // Auto-include active note as context if open
              const context = selectedSnippet ? [selectedSnippet] : []
              sendChatMessage(text, context)
              e.target.value = ''
            }
          }}
        />
        <div className="chat-input-hint">Enter to send</div>
      </div>
    </div>
  )
}

export default AIChatPanel
