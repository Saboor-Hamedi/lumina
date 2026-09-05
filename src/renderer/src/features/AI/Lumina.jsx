import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  MessageSquare,
  Maximize,
  Minimize,
  Trash2,
  History,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Check,
  Plus,
  Sparkles,
  PanelLeftClose,
  PanelRightClose,
  PanelRightOpen,
  Settings as SettingsIcon,
  ExternalLink,
  ArrowRightToLine,
  FileText,
  Info,
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  Brain,
  ChevronDown,
  ChevronUp,
  Folder,
  CheckCircle2,
  Loader2,
  Code as CodeIcon,
  RefreshCw,
  Edit3
} from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useAIStore } from './tools/lumina'
import { useVaultStore } from '../../core/store/workspaceStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useShallow } from 'zustand/react/shallow'
import { Composer } from './Composer'
import ModalHeader from '../Overlays/ModalHeader'
import '../../assets/appshell.css'
import './lumina.css'

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

const ChatPreBlock = React.memo(({ children, ...props }) => {
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

const ChatInlineCode = React.memo(({ className, children, ...props }) => {
  const textContent = String(children || '')

  // If the model wrapped a wikilink or markdown link in backticks, render it as a clickable link
  const linkMatch = textContent.match(/^\[(.*?)\]\((wikilink:[^)]+|https?:[^)]+)\)$/)
  if (linkMatch) {
    const label = linkMatch[1]
    const href = linkMatch[2]
    return <ChatLink href={href}>{label}</ChatLink>
  }

  const wikiMatch = textContent.match(/^\[\[(.*?)\]\]$/)
  if (wikiMatch) {
    const [target, alias] = wikiMatch[1].split('|')
    const cleanTarget = target.trim()
    const displayText = (alias || cleanTarget).trim()
    return <ChatLink href={`wikilink:${encodeURIComponent(cleanTarget)}`}>{displayText}</ChatLink>
  }

  return (
    <code className={`chat-inline-code ${className || ''}`} {...props}>
      {children}
    </code>
  )
})

const ThinkingBlock = React.memo(({ thinkContent, isStreaming = false }) => {
  const [isOpen, setIsOpen] = useState(isStreaming)

  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true)
    }
  }, [isStreaming])

  if (!thinkContent?.trim()) return null

  return (
    <div className={`chat-thinking-container ${isOpen ? 'open' : 'collapsed'}`}>
      <button
        type="button"
        className="chat-thinking-header"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="chat-thinking-header-left">
          <Brain size={13} className={`chat-thinking-brain-icon ${isStreaming ? 'pulsing' : ''}`} />
          <span className="chat-thinking-title">
            {isStreaming ? 'Thinking in background...' : 'Thought Process'}
          </span>
          <span className="preview-indicator-tag chat-thinking-pill">
            {isStreaming ? 'REASONING' : 'THOUGHT'}
          </span>
        </div>
        <div className="chat-thinking-header-right">
          <ChevronDown
            size={12}
            className={`chat-thinking-chevron ${isOpen ? 'rotated' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="chat-thinking-body seamless-scrollbar">
          <div className="chat-thinking-content">
            {thinkContent.trim()}
          </div>
        </div>
      )}
    </div>
  )
})

const ChatBlockquote = ({ children }) => {
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

const openNoteInEditor = (rawTitle) => {
  if (!rawTitle) return
  try {
    const { snippets, setSelectedSnippet, setActiveTabId } = useVaultStore.getState()
    const snippetList = Array.isArray(snippets) ? snippets : Object.values(snippets || {})
    const clean = decodeURIComponent(rawTitle)
      .toLowerCase()
      .trim()
      .replace(/^#/, '')
      .replace(/\.md$/, '')
      .replace(/^file:\/\/\/?/, '')
      .split(/[/\\]/)
      .pop()

    // 1. Exact title match
    let target = snippetList.find(
      (s) => (s.title || '').toLowerCase().trim().replace(/\.md$/, '') === clean
    )
    // 2. Partial title match
    if (!target) {
      target = snippetList.find((s) =>
        (s.title || '').toLowerCase().trim().replace(/\.md$/, '').includes(clean)
      )
    }
    // 3. ID match
    if (!target) {
      target = snippetList.find((s) => s.id === rawTitle)
    }

    if (target) {
      if (setSelectedSnippet) setSelectedSnippet(target)
      if (setActiveTabId) setActiveTabId(target.id)
    }
  } catch (err) {
    console.error('Failed to open note in editor:', err)
  }
}

const ChatLink = ({ href, children, ...props }) => {
  // If it's a wikilink or internal note reference or not an external web URL
  const isExternal = href && /^(https?|mailto):/i.test(href)

  if (!isExternal || href?.startsWith('wikilink:')) {
    const rawTarget = href?.startsWith('wikilink:')
      ? href.replace('wikilink:', '')
      : href || String(children || '')

    return (
      <span
        className="chat-wikilink-chip"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openNoteInEditor(rawTarget)
        }}
        title={`Open note: ${decodeURIComponent(rawTarget)}`}
      >
        {children}
      </span>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="chat-external-link"
      onClick={(e) => {
        if (window.electron?.ipcRenderer) {
          e.preventDefault()
          window.electron.ipcRenderer.send('open-external-url', href)
        }
      }}
      {...props}
    >
      {children}
    </a>
  )
}

const ActivityCard = React.memo(({ rawContent, isStreaming = false }) => {
  const [isExpanded, setIsExpanded] = useState(true)

  const items = useMemo(() => {
    if (!rawContent) return []
    const lines = rawContent.split('\n').map((l) => l.trim()).filter(Boolean)
    const parsed = []
    const seen = new Set()

    for (const line of lines) {
      if (line.includes('*Creating folder') || line.includes('📁 *Creating')) {
        const m = line.match(/`([^`]+)`/)
        const target = m ? m[1] : '...'
        parsed.push({ type: 'folder', target, isActive: true })
        continue
      }
      if (line.includes('*Drafting') || line.includes('📝 *Drafting')) {
        const titleMatch = line.match(/`([^`]+)`/)
        const folderMatch = line.match(/in\s+([^\s.*]+)/i)
        parsed.push({
          type: 'file',
          target: titleMatch ? titleMatch[1] : 'note',
          folder: folderMatch ? folderMatch[1] : null,
          isActive: true
        })
        continue
      }
      if (line.includes('*Executing') || line.includes('⚙️ *Executing')) {
        parsed.push({
          type: 'generic',
          target: line.replace(/[*⚙️]/g, '').trim(),
          isActive: true
        })
        continue
      }

      if (line.toLowerCase().includes('created folder')) {
        let clean = line
          .replace(/^[-*•\s📁]+/, '')
          .replace(/created folder/i, '')
          .replace(/[`*]/g, '')
          .replace(/\.$/, '')
          .trim()
        if (clean && !seen.has(`folder:${clean}`)) {
          seen.add(`folder:${clean}`)
          parsed.push({ type: 'folder', target: clean, action: 'create', isActive: false })
        }
        continue
      }

      if (line.toLowerCase().includes('renamed folder')) {
        let clean = line
          .replace(/^[-*•\s📁]+/, '')
          .replace(/renamed folder/i, '')
          .replace(/[`*]/g, '')
          .replace(/\.$/, '')
          .trim()
        if (clean && !seen.has(`folder:${clean}`)) {
          seen.add(`folder:${clean}`)
          parsed.push({ type: 'folder', target: `Renamed to ${clean.split(' to ').pop() || clean}`, rawText: line.replace(/^[-*•\s📁]+/, ''), action: 'rename', isActive: false })
        }
        continue
      }

      if (line.toLowerCase().includes('renamed note') || line.toLowerCase().includes('renamed file')) {
        let clean = line
          .replace(/^[-*•\s📝]+/, '')
          .replace(/renamed (?:note|file)/i, '')
          .replace(/[`*]/g, '')
          .replace(/\.$/, '')
          .trim()
        const newPart = clean.split(' to ').pop() || clean
        if (clean && !seen.has(`file:${clean}`)) {
          seen.add(`file:${clean}`)
          parsed.push({ type: 'file', target: newPart, rawText: line.replace(/^[-*•\s📝]+/, ''), action: 'rename', isActive: false })
        }
        continue
      }

      if (line.toLowerCase().includes('created') || line.toLowerCase().includes('drafting')) {
        let title = ''
        let folder = ''

        const wikiMatch = line.match(/\[\[(.*?)\]\]/)
        if (wikiMatch) {
          title = wikiMatch[1].trim()
        } else {
          const boldMatch = line.match(/\*\*([^*]+)\*\*/)
          if (boldMatch) {
            title = boldMatch[1].trim()
          } else {
            const createdMatch = line.match(/created\s+(?:note\s+)?([^"in`]+?)(?:\s+in\s+folder|\s+in\s+`|\s+in\s+"|$)/i)
            if (createdMatch) {
              title = createdMatch[1].trim()
            }
          }
        }

        const folderMatch = line.match(/in\s+(?:folder\s+)?(?:`|"|')?([^`"'\n]+?)(?:`|"|')?(?:\s+covering|$|\.)/i)
        if (folderMatch) {
          folder = folderMatch[1].trim().replace(/^[/\\]+|[/\\]+$/g, '')
        }

        if (title && !seen.has(`file:${title}`)) {
          seen.add(`file:${title}`)
          parsed.push({ type: 'file', target: title, folder: folder || null, action: 'create', isActive: false })
          continue
        }
      }

      const cleanLine = line.replace(/^[-*•\s]+/, '').trim()
      if (cleanLine && !seen.has(cleanLine)) {
        seen.add(cleanLine)
        const isRename = /renam/i.test(cleanLine)
        const isFolder = /folder/i.test(cleanLine)
        parsed.push({
          type: isFolder ? 'folder' : isRename ? 'file' : 'generic',
          target: cleanLine.replace(/[*`]/g, ''),
          rawText: cleanLine,
          action: isRename ? 'rename' : 'generic',
          isActive: false
        })
      }
    }

    return parsed
  }, [rawContent])

  if (items.length === 0) return null

  const folderCount = items.filter((i) => i.type === 'folder' && !i.isActive).length
  const fileCount = items.filter((i) => i.type === 'file' && !i.isActive).length
  const renameCount = items.filter((i) => i.action === 'rename').length
  const hasActive = items.some((i) => i.isActive) || isStreaming

  let headerTitle = 'Workspace Actions'
  if (hasActive) {
    headerTitle = 'Updating workspace...'
  } else if (renameCount > 0 && renameCount === items.length) {
    headerTitle = `Renamed ${renameCount} ${renameCount === 1 ? 'item' : 'items'}`
  } else if (folderCount > 0 && fileCount > 0) {
    headerTitle = `Created ${folderCount} ${folderCount === 1 ? 'folder' : 'folders'} & ${fileCount} ${fileCount === 1 ? 'note' : 'notes'}`
  } else if (folderCount > 0) {
    headerTitle = `Created ${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`
  } else if (fileCount > 0) {
    headerTitle = `Created ${fileCount} ${fileCount === 1 ? 'note' : 'notes'}`
  }

  return (
    <div className={`lumina-activity-card ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="lumina-activity-header" onClick={() => setIsExpanded((prev) => !prev)}>
        <div className="lumina-activity-title-group">
          <div className={`lumina-activity-icon-badge ${!hasActive ? 'complete' : ''}`}>
            {hasActive ? (
              <Loader2 size={12} className="lumina-activity-spinner" />
            ) : (
              <CheckCircle2 size={12} />
            )}
          </div>
          <span className="lumina-activity-main-title">{headerTitle}</span>
          {!hasActive && items.length > 0 && (
            <span className="lumina-activity-stats">({items.length})</span>
          )}
        </div>
        <div className="lumina-activity-controls">
          {hasActive ? (
            <span className="lumina-activity-badge streaming">Working...</span>
          ) : (
            <span className="lumina-activity-badge">Ready</span>
          )}
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </div>

      {isExpanded && (
        <div className="lumina-activity-body">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`lumina-activity-item ${item.type === 'folder' ? 'is-folder' : item.type === 'file' ? 'is-file' : ''}`}
            >
              <div className="lumina-activity-item-left">
                <span className="lumina-activity-item-icon">
                  {item.action === 'rename' ? (
                    <RefreshCw size={11} style={{ color: 'var(--text-accent, #40bafa)' }} />
                  ) : item.type === 'folder' ? (
                    <Folder size={12} style={{ color: 'var(--text-accent, #40bafa)' }} />
                  ) : item.type === 'file' ? (
                    <FileText size={12} style={{ color: 'var(--text-muted)' }} />
                  ) : (
                    <Edit3 size={11} style={{ color: 'var(--text-muted)' }} />
                  )}
                </span>
                {item.rawText ? (
                  <span className="lumina-activity-item-title">
                    {item.rawText.replace(/\*\*/g, '')}
                  </span>
                ) : item.type === 'file' && !item.isActive ? (
                  <span
                    className="lumina-activity-item-link"
                    onClick={(e) => {
                      e.stopPropagation()
                      openNoteInEditor(item.target)
                    }}
                    title={`Click to open ${item.target} in editor`}
                  >
                    {item.target}
                  </span>
                ) : (
                  <span className="lumina-activity-item-title">{item.target}</span>
                )}
              </div>
              {item.folder && (
                <span className="lumina-activity-folder-tag" title={item.folder}>
                  <Folder size={9} /> {item.folder}
                </span>
              )}
              <div className="lumina-activity-status-check">
                {item.isActive ? (
                  <span className="thinking-dot-pulse" style={{ width: 5, height: 5 }} />
                ) : (
                  <Check size={11} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

export const MessageContent = React.memo(
  ({ content, isStreaming = false }) => {
    const { thinkContent, activityContent, mainContent } = useMemo(() => {
      if (!content) return { thinkContent: '', activityContent: '', mainContent: '' }

      let think = ''
      let activity = ''
      let remaining = content

      const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i)
      if (thinkMatch) {
        think = thinkMatch[1]
        remaining = remaining.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim()
      }

      const actMatch = remaining.match(/<lumina-activity>([\s\S]*?)(?:<\/lumina-activity>|$)/i)
      if (actMatch) {
        activity = actMatch[1].trim()
        remaining = remaining.replace(/<lumina-activity>[\s\S]*?(?:<\/lumina-activity>|$)/i, '').trim()
      } else {
        // Fallback detection for raw message lines
        const lines = remaining.split('\n')
        const actionLines = []
        let nonActionStart = 0
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i].trim()
          if (!l) continue
          if (
            l.startsWith('- Created') ||
            l.startsWith('Created folder') ||
            l.startsWith('Renamed folder') ||
            l.startsWith('Renamed note') ||
            l.startsWith('Renamed file') ||
            l.startsWith('- 📁') ||
            l.startsWith('- 📝') ||
            l.startsWith('📁 *Creating') ||
            l.startsWith('📝 *Drafting') ||
            /^(?:[-*•]\s*)?(?:Created|Renamed)\s+(?:folder|\*\*|\[\[|[a-zA-Z0-9_]+)/i.test(l)
          ) {
            actionLines.push(l)
            nonActionStart = i + 1
          } else {
            break
          }
        }
        if (actionLines.length >= 1) {
          activity = actionLines.join('\n')
          remaining = lines.slice(nonActionStart).join('\n').trim()
        }
      }

      return { thinkContent: think, activityContent: activity, mainContent: remaining }
    }, [content])

    const processedContent = useMemo(() => {
      if (!mainContent) return ''
      let processed = mainContent.replace(/<readFile>([\s\S]*?)<\/readFile>/g, (match, inner) => {
        const titleMatch = inner.match(/title:\s*"([^"]+)"/)
        const fileName = titleMatch ? titleMatch[1] : 'File'
        return `\n> 📄 **Reading:** ${fileName}\n`
      })

      // If backticks wrap a wikilink like `[[Title]]`, unwrap the backticks first
      processed = processed.replace(/`(\[\[.*?\]\])`/g, '$1')

      processed = processed.replace(/\[\[(.*?)\]\]/g, (match, inner) => {
        const [target, alias] = inner.split('|')
        const cleanTarget = target.trim()
        const displayText = (alias || cleanTarget).trim()
        return `[${displayText}](wikilink:${encodeURIComponent(cleanTarget)})`
      })

      processed = processed.replace(/([^\n])\s*([├└]──|│\s+[├└]──)/g, '$1\n$2')
      processed = processed.replace(/([├└]──[^\n]+?)\s+([├└]──)/g, '$1\n$2')

      const rawLines = processed.split('\n')
      let inFence = false
      const resultLines = []
      let treeBuffer = []

      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i]
        if (line.trim().startsWith('```')) {
          if (treeBuffer.length > 0) {
            resultLines.push('```lumina-tree\n' + treeBuffer.join('\n') + '\n```')
            treeBuffer = []
          }
          inFence = !inFence
          resultLines.push(line)
          continue
        }

        if (!inFence) {
          const isTreeLine =
            /[├└]──/.test(line) ||
            (treeBuffer.length > 0 && (/^[│\s]*[├└─]/.test(line) || /^📁/.test(line.trim()))) ||
            (/^📁\s+[^/\n]+\s*(?:\(root\)|→|--|\/)/i.test(line.trim()) && i + 1 < rawLines.length && /[├└]──/.test(rawLines[i + 1]))

          if (isTreeLine) {
            treeBuffer.push(line)
            continue
          }
        }

        if (treeBuffer.length > 0) {
          resultLines.push('```lumina-tree\n' + treeBuffer.join('\n') + '\n```')
          treeBuffer = []
        }
        resultLines.push(line)
      }

      if (treeBuffer.length > 0) {
        resultLines.push('```lumina-tree\n' + treeBuffer.join('\n') + '\n```')
      }

      return resultLines.join('\n')
    }, [mainContent])

    return (
      <>
        {thinkContent && (
          <ThinkingBlock thinkContent={thinkContent} isStreaming={isStreaming} />
        )}
        {activityContent && (
          <ActivityCard rawContent={activityContent} isStreaming={isStreaming} />
        )}
        {processedContent && (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              pre: ChatPreBlock,
              code: ChatInlineCode,
              blockquote: ChatBlockquote,
              a: ChatLink,
              table: ({ children }) => (
                <div className="table-wrapper chat-table-wrapper">
                  <table>{children}</table>
                </div>
              )
            }}
          >
            {processedContent}
          </ReactMarkdown>
        )}
      </>
    )
  },
  (prevProps, nextProps) => {
    return prevProps.content === nextProps.content && prevProps.isStreaming === nextProps.isStreaming
  }
)

const ChatActions = ({ msg, index, onCopy, onRate }) => {
  const [copied, setCopied] = useState(false)

  const handleCopyClick = () => {
    onCopy(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="chat-response-actions">
      <button
        onClick={handleCopyClick}
        title={copied ? 'Copied!' : 'Copy Response'}
        style={copied ? { color: '#4ade80' } : {}}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
      <div className="action-divider" />
      <button
        className={msg.rating === 'up' ? 'active' : ''}
        onClick={() => onRate(index, 'up')}
        title="Helpful"
      >
        <ThumbsUp size={12} />
      </button>
      <button
        className={msg.rating === 'down' ? 'active' : ''}
        onClick={() => onRate(index, 'down')}
        title="Not Helpful"
      >
        <ThumbsDown size={12} />
      </button>
    </div>
  )
}

const ChatMessageRow = React.memo(
  ({ msg, index, isLast, isChatLoading, userMentionRegex, handleCopy, handleRating }) => {
    return (
      <div
        className={`chat-row ${msg.role}`}
        style={{
          marginBottom: '6px',
          display: 'flex',
          flexDirection: 'row',
          gap: '6px',
          justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          alignItems: 'flex-start',
          width: '100%',
          minHeight: '28px',
          willChange: 'auto'
        }}
      >
        <div
          className="chat-content-stack"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: msg.role === 'user' ? '85%' : '100%',
            minWidth: 0,
            flexShrink: 1,
            width: msg.role === 'user' ? 'auto' : '100%',
            marginRight: msg.role === 'user' ? '4px' : '0'
          }}
        >
          <div className={`chat-bubble ${msg.role}`}>
            {msg.role === 'user' ? (
              <div
                className="user-message-inline"
                style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', textAlign: 'left' }}
              >
                {(() => {
                  const content = msg.content || ''
                  const parts = content.split(userMentionRegex)
                  return parts.map((part, pIdx) => {
                    if (part.startsWith('@') && part.length > 1) {
                      return (
                        <span
                          key={pIdx}
                          style={{
                            color: 'var(--text-accent)',
                            fontWeight: 500
                          }}
                        >
                          {part}
                        </span>
                      )
                    }
                    return part
                  })
                })()}
              </div>
            ) : msg.role === 'assistant' &&
              !msg.content?.trim() &&
              !msg.imageUrl &&
              (isLast && (isChatLoading || msg.isGenerating)) ? (
              <div className="thinking-indicator">
                {msg.isGenerating ? (
                  <span className="thinking-text">
                    <Sparkles size={11} className="spin" /> Generating image...
                  </span>
                ) : (
                  <span className="thinking-text">
                    <span className="thinking-dot-pulse" />
                    Thinking...
                  </span>
                )}
              </div>
            ) : (
              <>
                <MessageContent
                  content={msg.content}
                  isStreaming={isLast && isChatLoading}
                  imageUrl={msg.imageUrl}
                  imagePrompt={msg.imagePrompt}
                  onCopy={handleCopy}
                />
                {isLast && isChatLoading && (
                  <span className="chat-streaming-cursor" />
                )}
              </>
            )}
          </div>
          {msg.role === 'assistant' && (
            <ChatActions msg={msg} index={index} onCopy={handleCopy} onRate={handleRating} />
          )}
        </div>
      </div>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.msg.content === nextProps.msg.content &&
      prevProps.msg.role === nextProps.msg.role &&
      prevProps.msg.imageUrl === nextProps.msg.imageUrl &&
      prevProps.msg.rating === nextProps.msg.rating &&
      prevProps.msg.isGenerating === nextProps.msg.isGenerating &&
      prevProps.isLast === nextProps.isLast &&
      prevProps.isChatLoading === nextProps.isChatLoading
    )
  }
)

/**
 * LuminaChatContent
 * Reusable chat body rendered either in the right sidebar or inside the floating modal.
 */
export const LuminaChatContent = React.memo(({ isSidebar = false, onPopOut = null }) => {
  const {
    chatMessages,
    isChatLoading,
    chatError,
    sendChatMessage,
    cancelChat,
    loadSessions,
    sessions,
    activeSessionId,
    createNewSession,
    switchSession,
    deleteSession
  } = useAIStore()

  const { selectedSnippet, snippets, openTabs } = useVaultStore(
    useShallow((state) => ({
      selectedSnippet: state.selectedSnippet,
      snippets: state.snippets,
      openTabs: state.openTabs
    }))
  )

  const userMentionRegex = useMemo(() => {
    const list = snippets || []
    const titles = list
      .map((s) => s.title)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

    if (titles.length > 0) {
      return new RegExp(`(@(?:${titles.join('|')}|[a-zA-Z0-9_\\-./]+))`, 'gi')
    }
    return /(@[a-zA-Z0-9_\-./]+)/g
  }, [snippets])

  const listRef = useRef(null)
  const autoScrollRef = useRef(true)
  const [showSessions, setShowSessions] = useState(false)

  const handleMessageScroll = useCallback(() => {
    if (!listRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 120
    autoScrollRef.current = isAtBottom
  }, [])

  useEffect(() => {
    if (!autoScrollRef.current || !listRef.current) return
    const el = listRef.current
    const rafId = requestAnimationFrame(() => {
      if (el && autoScrollRef.current) {
        el.scrollTop = el.scrollHeight
      }
    })
    return () => cancelAnimationFrame(rafId)
  }, [chatMessages, isChatLoading])

  // Load chat history on mount
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Listen for external toggle history event (from sidebar header)
  useEffect(() => {
    const handleToggle = () => setShowSessions((prev) => !prev)
    window.addEventListener('ai-toggle-history', handleToggle)
    return () => window.removeEventListener('ai-toggle-history', handleToggle)
  }, [])

  const handleCopy = useCallback((text) => {
    navigator.clipboard.writeText(text)
  }, [])

  const handleRating = useCallback(
    (index, type) => {
      const current = chatMessages[index]?.rating
      const newRating = current === type ? null : type
      // Update local message rating
      const updated = [...chatMessages]
      if (updated[index]) {
        updated[index] = { ...updated[index], rating: newRating }
        useAIStore.setState({ chatMessages: updated })
      }
    },
    [chatMessages]
  )

  const handleSendMessage = useCallback(
    async (text, mode = 'Standard', attachedMentions = []) => {
      if (!text.trim() && attachedMentions.length === 0) return
      autoScrollRef.current = true

      try {
        const contextSnippets = []
        const addedIds = new Set()

        // 1. If user explicitly attached mentions, ONLY focus on those mentions
        if (attachedMentions.length > 0) {
          attachedMentions.forEach((snippet) => {
            contextSnippets.push(snippet)
            addedIds.add(snippet.id)
          })
        } else {
          // 2. Otherwise add currently selected snippet
          if (selectedSnippet && !addedIds.has(selectedSnippet.id)) {
            contextSnippets.push(selectedSnippet)
            addedIds.add(selectedSnippet.id)
          }

          // 3. And other open tabs
          openTabs.forEach((tabId) => {
            const snippet = snippets.find((s) => s.id === tabId)
            if (snippet && !addedIds.has(snippet.id)) {
              contextSnippets.push(snippet)
              addedIds.add(snippet.id)
            }
          })
        }

        const limitedContext = contextSnippets.slice(0, 5)
        await sendChatMessage(text, limitedContext, mode, attachedMentions)
      } catch (err) {
        console.error('Failed to send:', err)
      }
    },
    [sendChatMessage, selectedSnippet, snippets, openTabs]
  )

  const visibleMessages = useMemo(() => {
    return chatMessages.filter((msg, index) => {
      const isEmptyAssistant = msg.role === 'assistant' && !msg.content?.trim() && !msg.imageUrl
      const isLastMessage = index === chatMessages.length - 1

      if (isEmptyAssistant) {
        if (!isLastMessage) return false
        if (!isChatLoading && !msg.isGenerating) return false
      }
      return true
    })
  }, [chatMessages, isChatLoading])

  const renderedMessages = useMemo(() => {
    const total = visibleMessages.length
    return visibleMessages.map((msg, index) => (
      <ChatMessageRow
        key={msg.id || `msg-${index}`}
        msg={msg}
        index={index}
        isLast={index === total - 1}
        isChatLoading={isChatLoading}
        userMentionRegex={userMentionRegex}
        handleCopy={handleCopy}
        handleRating={handleRating}
      />
    ))
  }, [visibleMessages, isChatLoading, userMentionRegex, handleCopy, handleRating])

  return (
    <div
      className={`ai-chat-content-root ${isSidebar ? 'is-sidebar-docked' : ''}`}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div className="chat-container" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Sessions Sidebar */}
        <div className={`chat-sessions-sidebar ${showSessions ? 'open' : ''}`}>
          <div className="sessions-header">
            <History size={14} />
            <span>History</span>
            <button
              className="new-chat-btn"
              onClick={() => {
                createNewSession()
                setShowSessions(false)
              }}
              title="New Chat"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="sessions-list">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`session-item ${activeSessionId === s.id ? 'active' : ''}`}
                onClick={() => {
                  switchSession(s.id)
                }}
              >
                <MessageSquare size={14} />
                <span className="session-title">{s.title || 'New Chat'}</span>
                <button
                  className="delete-session-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(s.id)
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Main Area */}
        <div
          className="chat-main"
          onClick={() => {
            if (showSessions) setShowSessions(false)
          }}
        >
          <div className="chat-messages" ref={listRef} onScroll={handleMessageScroll}>
            {visibleMessages.length === 0 ? (
              <div className="chat-empty">
                <h2
                  style={{
                    fontSize: '15px',
                    fontWeight: '600',
                    color: 'var(--text-main)',
                    margin: '8px 0 4px 0'
                  }}
                >
                  How can I help you today?
                </h2>
                {selectedSnippet && (
                  <button
                    className="chat-suggestion-btn"
                    onClick={() =>
                      sendChatMessage(`Explain the code in "${selectedSnippet.title}"`, [
                        selectedSnippet
                      ])
                    }
                  >
                    Explain "{selectedSnippet.title}"
                  </button>
                )}
              </div>
            ) : (
              <div className="chat-msg-list">
                {renderedMessages}
                <div className="chat-footer-area">
                  {(() => {
                    const lastMessage = chatMessages[chatMessages.length - 1]
                    const hasAssistantMessage = lastMessage && lastMessage.role === 'assistant'
                    const showTyping = isChatLoading && !hasAssistantMessage
                    return (
                      <>
                        {showTyping && (
                          <div
                            className="chat-row assistant"
                            style={{
                              marginBottom: '6px',
                              display: 'flex',
                              gap: '6px',
                              alignItems: 'flex-start'
                            }}
                          >
                            <div className="thinking-indicator">
                              <span className="thinking-text">
                                <span className="thinking-dot-pulse" />
                                Thinking...
                              </span>
                            </div>
                          </div>
                        )}
                        {chatError && (
                          <div
                            className="chat-row assistant"
                            style={{
                              marginBottom: '6px',
                              display: 'flex',
                              gap: '6px',
                              alignItems: 'flex-start'
                            }}
                          >
                            <div
                              className="chat-content-stack"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                maxWidth: '100%',
                                minWidth: 0,
                                flexShrink: 1,
                                width: 'auto'
                              }}
                            >
                              <div
                                className="chat-bubble assistant"
                                style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}
                              >
                                <MessageContent content={`**Error:** ${chatError}`} />
                                {chatError.includes('API Key') && (
                                  <button
                                    onClick={() =>
                                      window.dispatchEvent(new CustomEvent('open-ai-settings'))
                                    }
                                    style={{
                                      marginTop: '12px',
                                      padding: '6px 12px',
                                      fontSize: '13px',
                                      background: 'var(--bg-active)',
                                      border: '1px solid var(--border-dim)',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      color: 'var(--text-main)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}
                                  >
                                    <SettingsIcon size={14} /> Open Settings
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>

          <div className="chat-input-area">
            <Composer
              onSend={handleSendMessage}
              isLoading={isChatLoading}
              onStop={cancelChat}
              onCancel={cancelChat}
            />
          </div>
        </div>
      </div>
    </div>
  )
})

/**
 * LuminaChat Floating Modal Component
 */
const LuminaChat = ({ isOpen, onClose, onDock, onUnfloat }) => {
  useKeyboardShortcuts({
    onEscape: isOpen ? onClose : null
  })

  const modalRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      const saved =
        useSettingsStore.getState().settings.aiChatModalState ||
        localStorage.getItem('aiChatModalState')
      const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved
      return parsed?.isMinimized ?? false
    } catch (e) {
      return false
    }
  })

  const dragStartPos = useRef({ x: 0, y: 0, top: 0, left: 0 })
  const resizeStartPos = useRef({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })

  const [modalState, setModalState] = useState(() => {
    try {
      const saved =
        useSettingsStore.getState().settings.aiChatModalState ||
        localStorage.getItem('aiChatModalState')
      if (saved) {
        const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved
        return {
          top: parsed.top ?? window.innerHeight * 0.1,
          left: parsed.left ?? window.innerWidth * 0.6,
          width: parsed.width ?? 420,
          height: parsed.height ?? 620
        }
      }
    } catch (e) {}
    return {
      top: window.innerHeight * 0.1,
      left: window.innerWidth * 0.6,
      width: 420,
      height: 620
    }
  })

  const updateSetting = useSettingsStore((state) => state.updateSetting)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement
      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.querySelector('textarea')?.focus()
        }
      }, 50)
    } else {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        setTimeout(() => previousFocusRef.current?.focus(), 10)
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && !isMaximized) {
      try {
        const stateToSave = { ...modalState, isMinimized }
        localStorage.setItem('aiChatModalState', JSON.stringify(stateToSave))
        updateSetting('aiChatModalState', stateToSave)
      } catch (e) {}
    }
  }, [modalState, isMinimized, isOpen, isMaximized, updateSetting])

  // Smooth, lightweight window drag
  const handleDragStart = useCallback(
    (e) => {
      if (isMaximized || isMinimized) return
      if (e.target.closest('button')) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      dragStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        top: modalState.top,
        left: modalState.left,
        latestTop: modalState.top,
        latestLeft: modalState.left
      }
    },
    [modalState, isMaximized, isMinimized]
  )

  const handleDrag = useCallback(
    (e) => {
      if (!isDragging || isMaximized) return
      const deltaX = e.clientX - dragStartPos.current.x
      const deltaY = e.clientY - dragStartPos.current.y
      const newLeft = dragStartPos.current.left + deltaX
      const newTop = dragStartPos.current.top + deltaY
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const modalWidth = isMaximized ? viewportWidth : modalState.width
      const modalHeight = isMaximized ? viewportHeight : modalState.height
      const finalLeft = Math.max(0, Math.min(newLeft, viewportWidth - modalWidth))
      const finalTop = Math.max(0, Math.min(newTop, viewportHeight - modalHeight))
      if (modalRef.current) {
        modalRef.current.style.left = `${finalLeft}px`
        modalRef.current.style.top = `${finalTop}px`
      }
      dragStartPos.current.latestLeft = finalLeft
      dragStartPos.current.latestTop = finalTop
    },
    [isDragging, isMaximized, modalState.width, modalState.height]
  )

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    if (dragStartPos.current.latestLeft !== undefined) {
      setModalState((prev) => ({
        ...prev,
        left: dragStartPos.current.latestLeft,
        top: dragStartPos.current.latestTop
      }))
    }
  }, [])

  useEffect(() => {
    if (modalRef.current && !isDragging && !isResizing) {
      if (isMaximized) {
        modalRef.current.style.top = '0px'
        modalRef.current.style.left = '0px'
        modalRef.current.style.width = '100%'
        modalRef.current.style.height = '100%'
      } else {
        modalRef.current.style.top = `${modalState.top}px`
        modalRef.current.style.left = `${modalState.left}px`
        modalRef.current.style.width = `${modalState.width}px`
        modalRef.current.style.height = `${modalState.height}px`
      }
    }
  }, [modalState, isMaximized, isDragging, isResizing])

  // Single Bottom-Right Corner Resize
  const handleResizeStart = useCallback(
    (e) => {
      if (isMaximized) return
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      resizeStartPos.current = {
        x: e.clientX,
        y: e.clientY,
        width: modalState.width,
        height: modalState.height,
        left: modalState.left,
        top: modalState.top
      }
    },
    [modalState, isMaximized]
  )

  const handleResize = useCallback(
    (e) => {
      if (!isResizing || isMaximized) return
      const deltaX = e.clientX - resizeStartPos.current.x
      const deltaY = e.clientY - resizeStartPos.current.y
      const minWidth = 320
      const minHeight = 420
      const maxWidth = window.innerWidth
      const maxHeight = window.innerHeight

      const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartPos.current.width + deltaX))
      const newHeight = Math.max(
        minHeight,
        Math.min(maxHeight, resizeStartPos.current.height + deltaY)
      )

      if (modalRef.current) {
        modalRef.current.style.width = `${newWidth}px`
        modalRef.current.style.height = `${newHeight}px`
      }
      resizeStartPos.current.latestState = {
        width: newWidth,
        height: newHeight
      }
    },
    [isResizing, isMaximized]
  )

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    if (resizeStartPos.current.latestState) {
      setModalState((prev) => ({ ...prev, ...resizeStartPos.current.latestState }))
    }
  }, [])

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev)
    if (isMinimized) setIsMinimized(false)
  }, [isMinimized])

  const handleToggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev)
    if (isMaximized) setIsMaximized(false)
  }, [isMaximized])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDrag)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging, handleDrag, handleDragEnd])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResize)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResize, handleResizeEnd])

  if (!isOpen) return null

  return (
    <div className="modal-overlay ai-chat-modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={`modal-container ai-chat-modal-container ${isMaximized ? 'maximized' : ''} ${isMinimized ? 'minimized' : ''} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          ...(isMaximized
            ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', borderRadius: 0 }
            : isMinimized
              ? { position: 'fixed', top: 'auto', left: 'auto', bottom: '26px', right: '14px', width: '220px' }
              : {
                  position: 'absolute',
                  top: modalState.top,
                  left: modalState.left,
                  width: modalState.width,
                  height: modalState.height
                })
        }}
      >
        <ModalHeader
          onMouseDown={handleDragStart}
          onDoubleClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          style={{ cursor: 'move' }}
          left={
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className="modal-action-icon-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  window.dispatchEvent(new CustomEvent('ai-toggle-history'))
                }}
                title="Toggle History Sidebar"
                aria-label="Toggle History Sidebar"
              >
                <History size={14} />
              </button>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                Lumina AI
              </span>
            </div>
          }
          right={
            <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <button
                className="modal-clear-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onDock) onDock()
                  else if (onUnfloat) onUnfloat()
                }}
                title="Dock to Tab Sidebar"
                aria-label="Dock to Tab Sidebar"
              >
                <ArrowRightToLine size={13} />
              </button>
              <button
                className="modal-minimize-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleMinimize()
                }}
                title={isMinimized ? 'Restore' : 'Minimize'}
                aria-label={isMinimized ? 'Restore' : 'Minimize'}
              >
                <Minimize size={13} />
              </button>
              <button
                className="modal-maximize-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleMaximize()
                }}
                title={isMaximized ? 'Restore' : 'Maximize'}
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? <Minimize size={13} /> : <Maximize size={13} />}
              </button>
            </div>
          }
          onClose={onClose}
        />

        {/* Single Bottom-Right Resize Handle */}
        {!isMaximized && (
          <div
            className="resize-handle resize-handle-bottom-right"
            onMouseDown={handleResizeStart}
            title="Resize window"
          />
        )}

        {(isDragging || isResizing) && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              cursor: isDragging ? 'grabbing' : 'nwse-resize'
            }}
          />
        )}

        <div
          className="ai-chat-modal-body"
          style={{
            height: 'calc(100% - 40px)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'text'
          }}
        >
          <LuminaChatContent isSidebar={false} />
        </div>
      </div>
    </div>
  )
}

export default React.memo(LuminaChat)
