import React, { useState } from 'react'
import { Folder, Code as CodeIcon, Copy, Check } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

export const ChatPreBlock = React.memo(({ children, ...props }) => {
  const [copied, setCopied] = useState(false)

  let codeString = ''
  let className = ''

  if (React.isValidElement(children)) {
    className = children.props?.className || ''
    codeString = String(children.props?.children || '')
  } else if (typeof children === 'string') {
    codeString = children
  } else if (Array.isArray(children)) {
    codeString = children
      .map((c) => (React.isValidElement(c) ? c.props?.children : c))
      .join('')
  } else {
    codeString = String(children || '')
  }

  codeString = codeString.replace(/\n$/, '')
  const match = /language-([a-zA-Z0-9-]+)/.exec(className)
  const lang = match ? match[1] : 'text'
  const isDelete = lang.startsWith('lumina-delete')
  const isTree = lang === 'lumina-tree' || (lang === 'text' && /[├└]──/.test(codeString))
  const lineCount = codeString ? codeString.split('\n').length : 0

  const displayTag = isTree ? 'STRUCTURE' : lang.toUpperCase()

  return (
    <div className={`chat-code-block ${isTree ? 'is-tree' : ''}`}>
      <div className="chat-code-header">
        <div className="chat-code-header-left">
          {isTree ? (
            <Folder size={11} style={{ color: 'var(--text-accent)', opacity: 0.85 }} />
          ) : (
            <CodeIcon size={11} style={{ color: 'var(--text-faint)', opacity: 0.8 }} />
          )}
          <span className={`chat-code-tag ${isTree ? 'is-tree' : ''}`}>{displayTag}</span>
          <span className="chat-code-stats">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>
        {!isDelete && (
          <button
            className="chat-code-copy-btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(codeString)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              } catch (err) {
                console.error('Failed to copy: ', err)
              }
            }}
            title="Copy code"
          >
            {copied ? (
              <span className="copied-text">
                <Check size={11} strokeWidth={3} /> COPIED
              </span>
            ) : (
              <>
                <Copy size={11} />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>
      {!isDelete && isTree ? (
        <div className="chat-tree-display seamless-scrollbar">
          {codeString.split('\n').map((line, idx) => {
            const isFolder = /📁/.test(line) || line.trim().endsWith('/')
            return (
              <div key={idx} className={`chat-tree-line ${isFolder ? 'is-folder' : 'is-file'}`}>
                {line}
              </div>
            )
          })}
        </div>
      ) : !isDelete ? (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={lang === 'text' ? 'markdown' : lang}
          PreTag="div"
          className="seamless-scrollbar"
          customStyle={{
            margin: 0,
            background: 'transparent',
            padding: '10px 14px',
            fontSize: '12px',
            lineHeight: '1.5',
            fontFamily: 'var(--font-mono, monospace)',
            fontVariantLigatures: 'normal',
            fontFeatureSettings: '"liga" 1, "calt" 1',
            textRendering: 'optimizeLegibility'
          }}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      ) : null}
    </div>
  )
})

export default ChatPreBlock
