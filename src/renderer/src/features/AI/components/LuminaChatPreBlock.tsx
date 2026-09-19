import React, { useState } from 'react'
import { Folder, Code as CodeIcon, Copy, Check, ChevronDown } from 'lucide-react'
// @ts-ignore
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
// @ts-ignore
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { LuminaTreeBadge, isAsciiTree } from './LuminaTreeBadge'
import '../css/chatCode.css'

export interface ChatPreBlockProps {
  children?: React.ReactNode
  [key: string]: unknown
}

/**
 * ChatPreBlock renders code blocks with syntax highlighting, language badges, line counters,
 * quick clipboard copy, and automatically extracts folder structure trees into LuminaTreeBadge.
 */
export const ChatPreBlock: React.FC<ChatPreBlockProps> = React.memo(({ children, ...props }) => {
  const [copied, setCopied] = useState<boolean>(false)

  let codeString = ''
  let className = ''

  if (React.isValidElement(children)) {
    className = (children.props as any)?.className || ''
    codeString = String((children.props as any)?.children || '')
  } else if (typeof children === 'string') {
    codeString = children
  } else if (Array.isArray(children)) {
    codeString = children
      .map((c) => (React.isValidElement(c) ? (c.props as any)?.children : c))
      .join('')
  } else {
    codeString = String(children || '')
  }

  codeString = codeString.replace(/\n$/, '')
  const match = /language-([a-zA-Z0-9-]+)/.exec(className)
  const lang = match ? match[1] : 'text'
  const isDelete = lang.startsWith('lumina-delete')
  const isTree = lang === 'lumina-tree' || lang === 'tree' || isAsciiTree(codeString)
  const lineCount = codeString ? codeString.split('\n').length : 0

  if (isTree) {
    return <LuminaTreeBadge rawCode={codeString} />
  }

  const displayTag = lang.toUpperCase()

  return (
    <div className="chat-code-block">
      <div className="chat-code-header">
        <div className="chat-code-header-left">
          <CodeIcon size={11} style={{ color: 'var(--text-faint)', opacity: 0.8 }} />
          <span className="chat-code-tag">{displayTag}</span>
          <span className="chat-code-stats">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        </div>
        {!isDelete && (
          <button
            className="chat-code-copy-btn"
            onClick={async (e) => {
              e.stopPropagation()
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
      {!isDelete && (
        <SyntaxHighlighter
          style={vscDarkPlus as any}
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
      )}
    </div>
  )
})

export default ChatPreBlock
