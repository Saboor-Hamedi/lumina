import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Folder, Code as CodeIcon, Copy, Check, ChevronDown, Image as ImageIcon, Eye } from 'lucide-react'
import hljs from '../../../core/code/hljsCore'
import { LuminaFolderTree, isAsciiTree } from './luminaFolderTree'
import ToolTip from '../../../components/atoms/ToolTip'
import {
  renderMermaidToElement,
  applyMermaidFit,
  scheduleMermaidFit,
  copyMermaidAsImage,
  openMermaidLightbox
} from '../../../core/mermaid'
import {
  createLinkWrapperElement,
  extractYouTubeId,
  parseGridLinkLine,
  type LinkCardColumns,
  type LinkWrapperItem
} from '../../links'
import '../../../assets/mermaid.css'
import '../css/chatCode.css'

const LINKS_CHAT_LANG_RE = /^(?:links?|links?-grid)(?:[-_\s]+(\d+))?$/i

let chatMermaidCounter = 0

const ChatMermaidBlock: React.FC<{ code: string }> = React.memo(({ code }) => {
  const [showSource, setShowSource] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [themeTick, setThemeTick] = useState(0)
  const scrollWrapRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onThemeChange = () => setThemeTick((t) => t + 1)
    window.addEventListener('theme-changed', onThemeChange)
    return () => window.removeEventListener('theme-changed', onThemeChange)
  }, [])

  useEffect(() => {
    if (showSource) return
    const contentEl = contentRef.current
    if (!contentEl || !code.trim()) return

    const timer = window.setTimeout(() => {
      const id = `chat-mermaid-${++chatMermaidCounter}`
      renderMermaidToElement(contentEl, code, id)
      scheduleMermaidFit(contentEl)
    }, 180)

    return () => window.clearTimeout(timer)
  }, [code, showSource, themeTick])

  useEffect(() => {
    if (showSource) return
    const scrollEl = scrollWrapRef.current
    const contentEl = contentRef.current
    if (!scrollEl || !contentEl || typeof ResizeObserver === 'undefined') return

    let fitRaf: number | null = null
    const observer = new ResizeObserver(() => {
      if (fitRaf !== null) cancelAnimationFrame(fitRaf)
      fitRaf = requestAnimationFrame(() => {
        fitRaf = null
        applyMermaidFit(contentEl)
      })
    })
    observer.observe(scrollEl)
    return () => {
      if (fitRaf !== null) cancelAnimationFrame(fitRaf)
      observer.disconnect()
    }
  }, [showSource])

  const handleCopyImage = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const svgEl = contentRef.current?.querySelector('svg') as SVGSVGElement | null
    if (!svgEl) return
    try {
      await copyMermaidAsImage(svgEl)
      setCopiedImage(true)
      setTimeout(() => setCopiedImage(false), 1500)
    } catch (err) {
      console.error('Failed to copy mermaid image:', err)
    }
  }

  const handleCopySyntax = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(code.trim())
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 1500)
    } catch (err) {
      console.error('Failed to copy mermaid syntax:', err)
    }
  }

  const handleOpenLightbox = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const svgEl = contentRef.current?.querySelector('svg') as SVGSVGElement | null
    if (svgEl) {
      openMermaidLightbox(svgEl)
    }
  }

  return (
    <div className="cm-mermaid-widget" style={{ margin: '10px 0' }}>
      <div className="mermaid-widget-header" contentEditable={false}>
        <span className="mermaid-widget-lang-label">MERMAID</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ToolTip text={showSource ? 'Show Preview' : 'View Code'} position="top">
            <div
              className="mermaid-edit-btn"
              onClick={(e) => {
                e.stopPropagation()
                setShowSource((prev) => !prev)
              }}
            >
              {showSource ? <Eye size={14} /> : <CodeIcon size={14} />}
            </div>
          </ToolTip>
          <ToolTip text="Copy Code" position="top">
            <div
              className="mermaid-edit-btn"
              style={{
                color: copiedCode ? '#4ade80' : undefined,
                borderColor: copiedCode ? '#4ade80' : undefined
              }}
              onClick={handleCopySyntax}
            >
              {copiedCode ? <Check size={14} /> : <Copy size={14} />}
            </div>
          </ToolTip>
          {!showSource && (
            <ToolTip text="Copy as Image" position="top">
              <div
                className="mermaid-edit-btn"
                style={{
                  color: copiedImage ? '#4ade80' : undefined,
                  borderColor: copiedImage ? '#4ade80' : undefined
                }}
                onClick={handleCopyImage}
              >
                {copiedImage ? <Check size={14} /> : <ImageIcon size={14} />}
              </div>
            </ToolTip>
          )}
        </div>
      </div>

      {showSource ? (
        <pre
          className="chat-code-pre"
          style={{
            margin: 0,
            padding: '12px 14px',
            textAlign: 'left',
            borderRadius: '0 0 8px 8px',
            overflowX: 'auto'
          }}
        >
          <code style={{ textAlign: 'left', display: 'block' }}>{code}</code>
        </pre>
      ) : (
        <div className="mermaid-widget-body" onClick={handleOpenLightbox}>
          <div ref={scrollWrapRef} className="mermaid-scroll-wrap">
            <div ref={contentRef} className="mermaid-content" />
          </div>
        </div>
      )}
    </div>
  )
})
ChatMermaidBlock.displayName = 'ChatMermaidBlock'

const ChatLinkGridBlock: React.FC<{ items: LinkWrapperItem[]; columns: LinkCardColumns }> = React.memo(
  ({ items, columns }) => {
    const hostRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
      const host = hostRef.current
      if (!host) return
      host.innerHTML = ''
      const el = createLinkWrapperElement({ items, columns })
      host.appendChild(el)
      return () => {
        host.innerHTML = ''
      }
    }, [items, columns])

    return <div ref={hostRef} className="chat-links-grid-host" />
  }
)

function escapeCodeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface ChatPreBlockProps {
  children?: React.ReactNode
  [key: string]: unknown
}

/**
 * ChatPreBlock renders code blocks with syntax highlighting, language badges, line counters,
 * quick clipboard copy, and automatically extracts folder structure trees into LuminaFolderTree.
 */
export const ChatPreBlock: React.FC<ChatPreBlockProps> = React.memo(({ children, ...props }) => {
  const [copied, setCopied] = useState<boolean>(false)

  let codeString = ''
  let className = ''
  let codeMeta = ''

  if (React.isValidElement(children)) {
    const childProps = children.props as any
    className = childProps?.className || ''
    codeString = String(childProps?.children || '')
    codeMeta = String(childProps?.node?.data?.meta || '').trim()
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
  const isMermaid = lang.toLowerCase() === 'mermaid'
  const isDelete = lang.startsWith('lumina-delete')
  const isTree = !isMermaid && (lang === 'lumina-tree' || lang === 'tree' || isAsciiTree(codeString))
  const linksLangMatch = LINKS_CHAT_LANG_RE.exec(lang)
  const lineCount = codeString ? codeString.split('\n').length : 0

  const parsedChatLinks = useMemo<{ items: LinkWrapperItem[]; columns: LinkCardColumns } | null>(() => {
    if (!linksLangMatch) return null
    const items: LinkWrapperItem[] = []
    let explicitCols: LinkCardColumns | undefined
    if (linksLangMatch[1]) {
      const n = parseInt(linksLangMatch[1], 10)
      explicitCols = Math.min(3, Math.max(1, Number.isFinite(n) ? n : 1)) as LinkCardColumns
    } else if (/^\d+$/.test(codeMeta)) {
      const n = parseInt(codeMeta, 10)
      explicitCols = Math.min(3, Math.max(1, Number.isFinite(n) ? n : 1)) as LinkCardColumns
    }
    const rawLines = codeString.split(/\r?\n/)
    for (let i = 0; i < rawLines.length; i++) {
      const trimmed = rawLines[i].trim()
      if (!trimmed) continue
      // Support ` ```links 2 ` where react-markdown puts `2` into meta or first line
      if (i === 0 && !explicitCols && /^\d+$/.test(trimmed)) {
        const n = parseInt(trimmed, 10)
        explicitCols = Math.min(3, Math.max(1, Number.isFinite(n) ? n : 1)) as LinkCardColumns
        continue
      }
      const parsed = parseGridLinkLine(trimmed)
      if (parsed) {
        items.push({ ...parsed, youtubeId: extractYouTubeId(parsed.url) })
      }
    }
    if (items.length === 0) return null
    const columns: LinkCardColumns =
      explicitCols ?? (Math.min(3, Math.max(1, items.length)) as LinkCardColumns)
    return { items, columns }
  }, [linksLangMatch, codeString])

  const highlightedHtml = useMemo(() => {
    if (isMermaid || isTree || isDelete || parsedChatLinks) return ''
    try {
      if (lang && lang !== 'text' && hljs.getLanguage(lang)) {
        return hljs.highlight(codeString, { language: lang }).value
      }
      if (lang === 'markdown') {
        return hljs.highlight(codeString, { language: 'markdown' }).value
      }
      return hljs.highlightAuto(codeString).value
    } catch {
      return escapeCodeHtml(codeString)
    }
  }, [codeString, lang, isMermaid, isTree, isDelete, parsedChatLinks])

  if (isMermaid) {
    return <ChatMermaidBlock code={codeString} />
  }

  if (parsedChatLinks) {
    return <ChatLinkGridBlock items={parsedChatLinks.items} columns={parsedChatLinks.columns} />
  }

  if (isTree) {
    return <LuminaFolderTree rawCode={codeString} />
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
        <pre className="chat-code-pre seamless-scrollbar">
          <code
            className={`hljs language-${lang === 'text' ? 'markdown' : lang}`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      )}
    </div>
  )
})

export default ChatPreBlock
