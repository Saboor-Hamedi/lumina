import React, { useState, useCallback, useRef } from 'react'
import {
  Info,
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  HelpCircle,
  CheckSquare,
  Quote,
  ChevronDown,
  Copy,
  Check,
  LucideIcon
} from 'lucide-react'
import { resolveCalloutType } from '../../../core/editor/useCallout'

interface CalloutStyleConfig {
  icon: LucideIcon
  color: string
  title: string
  border: string
  bg: string
}

export interface ChatBlockquoteProps {
  children?: React.ReactNode
}

const CALLOUT_TAG_RE = /^\[!([a-zA-Z]+)\]([+-])?(?:[ \t]+([^\n]*))?(?:\n([\s\S]*))?$/

function getChatCalloutConfig(resolvedType: string): CalloutStyleConfig {
  switch (resolvedType) {
    case 'tip':
    case 'success':
      return {
        icon: Lightbulb,
        color: '#4ade80',
        title: resolvedType.toUpperCase(),
        border: 'rgba(74, 222, 128, 0.28)',
        bg: 'rgba(74, 222, 128, 0.06)'
      }
    case 'important':
    case 'example':
      return {
        icon: AlertCircle,
        color: '#a78bfa',
        title: resolvedType.toUpperCase(),
        border: 'rgba(167, 139, 250, 0.28)',
        bg: 'rgba(167, 139, 250, 0.06)'
      }
    case 'warning':
      return {
        icon: AlertTriangle,
        color: '#fbbf24',
        title: 'WARNING',
        border: 'rgba(251, 191, 36, 0.28)',
        bg: 'rgba(251, 191, 36, 0.06)'
      }
    case 'question':
      return {
        icon: HelpCircle,
        color: '#fbbf24',
        title: 'QUESTION',
        border: 'rgba(251, 191, 36, 0.28)',
        bg: 'rgba(251, 191, 36, 0.06)'
      }
    case 'caution':
    case 'danger':
    case 'bug':
      return {
        icon: ShieldAlert,
        color: '#f87171',
        title: resolvedType.toUpperCase(),
        border: 'rgba(248, 113, 113, 0.28)',
        bg: 'rgba(248, 113, 113, 0.06)'
      }
    case 'todo':
      return {
        icon: CheckSquare,
        color: '#38bdf8',
        title: 'TODO',
        border: 'rgba(56, 189, 248, 0.28)',
        bg: 'rgba(56, 189, 248, 0.06)'
      }
    case 'quote':
      return {
        icon: Quote,
        color: 'var(--text-muted, #94a3b8)',
        title: 'QUOTE',
        border: 'var(--border-dim, rgba(148, 163, 184, 0.24))',
        bg: 'var(--bg-panel, rgba(0, 0, 0, 0.14))'
      }
    default:
      return {
        icon: Info,
        color: 'var(--text-accent, #38bdf8)',
        title: resolvedType.toUpperCase(),
        border: 'rgba(56, 189, 248, 0.28)',
        bg: 'rgba(56, 189, 248, 0.06)'
      }
  }
}

/**
 * ChatBlockquote renders GitHub / Obsidian style collapsible callout blocks
 * (`[!NOTE]`, `[!ERROR]`, `[!TIP]`, `[!WARNING]-`, etc.) with a subtle flat copy button,
 * or falls back to a clean standard blockquote.
 */
export const ChatBlockquote: React.FC<ChatBlockquoteProps> = ({ children }) => {
  let resolvedType: string | null = null
  let customTitle = ''
  let defaultCollapsed = false
  let bodyChildren: React.ReactNode[] = []

  try {
    const arr = React.Children.toArray(children)
    if (arr.length > 0 && React.isValidElement(arr[0])) {
      const firstEl = arr[0] as React.ReactElement<any>
      const innerArr = React.Children.toArray(firstEl.props?.children)
      const firstText = typeof innerArr[0] === 'string' ? innerArr[0] : ''
      const match = firstText.match(CALLOUT_TAG_RE)
      if (match) {
        resolvedType = resolveCalloutType(match[1])
        defaultCollapsed = match[2] === '-'
        customTitle = (match[3] || '').trim()
        const remainingFirstText = (match[4] || '').trimStart()
        const updatedInner = remainingFirstText
          ? [remainingFirstText, ...innerArr.slice(1)]
          : innerArr.slice(1)
        const restParagraphs = arr.slice(1)
        if (updatedInner.length > 0) {
          bodyChildren = [
            React.cloneElement(firstEl, { key: 'callout-first-body' }, ...updatedInner),
            ...restParagraphs
          ]
        } else {
          bodyChildren = restParagraphs
        }
      }
    }
  } catch {
    // Ignore extraction failure
  }

  const [isCollapsed, setIsCollapsed] = useState<boolean>(defaultCollapsed)
  const [copied, setCopied] = useState<boolean>(false)
  const [isHovered, setIsHovered] = useState<boolean>(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const text = (bodyRef.current?.innerText || customTitle || '').trim()
      if (!text) return
      navigator.clipboard?.writeText(text).then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1400)
      }).catch(() => {})
    },
    [customTitle]
  )

  if (resolvedType) {
    const config = getChatCalloutConfig(resolvedType)
    const IconComp = config.icon

    return (
      <div
        className="chat-callout-card"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          position: 'relative',
          margin: '10px 0',
          padding: '8px 12px',
          borderRadius: '6px',
          borderLeft: `2.5px solid ${config.color}`,
          background: config.bg,
          borderTop: `1px solid ${config.border}`,
          borderRight: `1px solid ${config.border}`,
          borderBottom: `1px solid ${config.border}`
        }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIsCollapsed((prev) => !prev)
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            color: config.color,
            fontWeight: 600,
            fontSize: '11.5px',
            letterSpacing: '0.4px',
            cursor: 'pointer',
            userSelect: 'none',
            marginBottom: isCollapsed || bodyChildren.length === 0 ? 0 : '5px'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <IconComp size={13} />
            <span>{customTitle || config.title}</span>
          </span>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleCopy}
              title="Copy callout"
              aria-label="Copy callout"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                padding: 0,
                border: 'none',
                borderRadius: '4px',
                background: 'transparent',
                color: copied ? '#4ade80' : 'var(--text-muted, #94a3b8)',
                opacity: isHovered || copied ? 0.85 : 0,
                cursor: 'pointer',
                transition: 'opacity 120ms ease, color 120ms ease'
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
            <ChevronDown
              size={13}
              style={{
                color: 'var(--text-muted, #94a3b8)',
                opacity: 0.85,
                transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            />
          </span>
        </div>
        <div
          ref={bodyRef}
          className="chat-callout-body"
          style={{ display: isCollapsed ? 'none' : 'block' }}
        >
          {bodyChildren.length > 0 ? bodyChildren : null}
        </div>
      </div>
    )
  }

  return (
    <div
      className="chat-quote-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        margin: '10px 0',
        borderRadius: '6px',
        border: '1px solid var(--border-dim, rgba(148, 163, 184, 0.22))',
        background: 'var(--bg-panel, rgba(0, 0, 0, 0.14))',
        overflow: 'hidden'
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!isCollapsed}
        onClick={() => setIsCollapsed((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsCollapsed((prev) => !prev)
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '5px 8px 5px 12px',
          borderBottom: isCollapsed
            ? 'none'
            : '1px solid color-mix(in srgb, var(--border-dim, rgba(148, 163, 184, 0.22)) 60%, transparent)',
          color: 'var(--text-muted, #94a3b8)',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Quote size={12} style={{ opacity: 0.78 }} />
          <span>Quote</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy quote"
            aria-label="Copy quote"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              padding: 0,
              border: 'none',
              borderRadius: '4px',
              background: 'transparent',
              color: copied ? '#4ade80' : 'var(--text-muted, #94a3b8)',
              opacity: isHovered || copied ? 0.9 : 0.65,
              cursor: 'pointer',
              transition: 'opacity 120ms ease, color 120ms ease'
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          <ChevronDown
            size={13}
            style={{
              opacity: 0.85,
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          />
        </span>
      </div>
      <blockquote
        ref={bodyRef as unknown as React.RefObject<HTMLQuoteElement>}
        className="chat-blockquote"
        style={{
          display: isCollapsed ? 'none' : 'block',
          margin: 0,
          padding: '8px 12px',
          borderLeft: 'none',
          background: 'transparent',
          borderRadius: 0
        }}
      >
        {children}
      </blockquote>
    </div>
  )
}

export default ChatBlockquote
