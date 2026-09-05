import React from 'react'
import {
  Info,
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  ShieldAlert
} from 'lucide-react'

export const ChatBlockquote = ({ children }) => {
  let calloutType = null
  try {
    const arr = React.Children.toArray(children)
    if (arr.length > 0 && arr[0]?.props?.children) {
      const firstText = String(React.Children.toArray(arr[0].props.children)[0] || '')
      const match = firstText.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i)
      if (match) {
        calloutType = match[1].toUpperCase()
      }
    }
  } catch (_) {}

  if (calloutType) {
    const config = {
      NOTE: {
        icon: Info,
        color: 'var(--text-accent, #40bafa)',
        title: 'NOTE',
        border: 'rgba(var(--text-accent-rgb, 64, 186, 250), 0.35)',
        bg: 'rgba(var(--text-accent-rgb, 64, 186, 250), 0.06)'
      },
      TIP: {
        icon: Lightbulb,
        color: '#4ade80',
        title: 'TIP',
        border: 'rgba(74, 222, 128, 0.35)',
        bg: 'rgba(74, 222, 128, 0.06)'
      },
      IMPORTANT: {
        icon: AlertCircle,
        color: '#a78bfa',
        title: 'IMPORTANT',
        border: 'rgba(167, 139, 250, 0.35)',
        bg: 'rgba(167, 139, 250, 0.06)'
      },
      WARNING: {
        icon: AlertTriangle,
        color: '#f59e0b',
        title: 'WARNING',
        border: 'rgba(245, 158, 11, 0.35)',
        bg: 'rgba(245, 158, 11, 0.06)'
      },
      CAUTION: {
        icon: ShieldAlert,
        color: '#ef4444',
        title: 'CAUTION',
        border: 'rgba(239, 68, 68, 0.35)',
        bg: 'rgba(239, 68, 68, 0.06)'
      }
    }[calloutType]

    const IconComp = config.icon

    return (
      <div
        className="chat-callout-card"
        style={{
          margin: '12px 0',
          padding: '10px 14px',
          borderRadius: '4px',
          borderLeft: `3px solid ${config.color}`,
          background: config.bg,
          borderTop: `1px solid ${config.border}`,
          borderRight: `1px solid ${config.border}`,
          borderBottom: `1px solid ${config.border}`
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: config.color,
            fontWeight: 600,
            fontSize: '11.5px',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}
        >
          <IconComp size={13} />
          <span>{config.title}</span>
        </div>
        <div className="chat-callout-body">{children}</div>
      </div>
    )
  }

  return <blockquote className="chat-blockquote">{children}</blockquote>
}

export default ChatBlockquote
