import React, { useState, useEffect, useRef, useMemo, useDeferredValue } from 'react'
import { createPortal } from 'react-dom'
import {
  Search,
  FileText,
  Zap,
  Sparkles,
  FileCode,
  FileJson,
  Hash,
  ImageIcon,
  Plus,
  Network,
  AtSign,
  Folder,
  Settings,
  Palette,
  Keyboard,
  Type,
  Bot,
  MessageSquare
} from 'lucide-react'
import Fuse from 'fuse.js'
import { FixedSizeList as List } from '../../components/utils/VirtualList'
import { useTag } from '../../core/hooks/useTag'
import { useMention } from '../../core/hooks/useMention'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useAIStore } from '../../core/store/useAIStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import './CommandPalette.css'

/**
 * Virtualized Command Palette (Obsidian Standard #5)
 * Feature: Fuzzy Match + Semantic AI Search
 * Memoized for performance - expensive search/filter operations.
 */
const HighlightText = React.memo(({ text, highlight }) => {
  if (!highlight.trim() || text === 'Semantic Match') return <span>{text}</span>
  const regex = new RegExp(`(${highlight})`, 'gi')
  const parts = text.split(regex)
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="palette-match">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
})

const CommandPaletteRow = React.memo(({ index, style, data }) => {
  const {
    filtered,
    selectedIndex,
    setSelectedIndex,
    query,
    setQuery,
    inputRef,
    onSelect,
    onNew,
    onToggleSettings,
    onToggleGraph,
    onToggleChat,
    onClose,
    dirtySnippetIds
  } = data

  const item = filtered[index]
  const isActive = index === selectedIndex
  const isSemantic = item.matchType === 'semantic'
  const isAction = item.matchType === 'action'

  return (
    <div
      style={style}
      className={`palette-item ${isActive ? 'active' : ''} ${isAction ? 'is-action' : ''}`}
      onClick={() => {
        if (item.action === 'filter') {
          setQuery(item.value + ' ')
          inputRef.current?.focus()
          return
        }
        if (isAction) {
          if (item.action === 'settings') onToggleSettings?.(item.tab)
          else if (item.action === 'new') onNew?.()
          else if (item.action === 'graph') onToggleGraph?.()
          else if (item.action === 'chat') onToggleChat?.()
        } else if (item.matchType === 'folder') {
          // Just close, no action
        } else {
          onSelect(item)
        }
        onClose()
      }}
      onMouseMove={() => {
        if (selectedIndex !== index) setSelectedIndex(index)
      }}
    >
      {isAction ? (
        (() => {
          if (item.action === 'settings') {
            if (item.tab === 'general') return <Settings size={18} className="item-icon action-icon" />
            if (item.tab === 'appearance') return <Palette size={18} className="item-icon action-icon" />
            if (item.tab === 'shortcuts') return <Keyboard size={18} className="item-icon action-icon" />
            if (item.tab === 'ai') return <Bot size={18} className="item-icon action-icon" />
            if (item.tab === 'type') return <Type size={18} className="item-icon action-icon" />
            if (item.tab === 'graph') return <Network size={18} className="item-icon action-icon" />
            return <Settings size={18} className="item-icon action-icon" />
          }
          if (item.action === 'new') return <Plus size={18} className="item-icon action-icon" />
          if (item.action === 'graph') return <Network size={18} className="item-icon action-icon" />
          if (item.action === 'chat') return <MessageSquare size={18} className="item-icon action-icon" />
          return <Zap size={18} className="item-icon action-icon" />
        })()
      ) : item.matchType === 'folder' ? (
        <Folder size={18} className="item-icon" style={{ color: 'var(--text-accent)' }} />
      ) : item.matchType === 'tag' ? (
        <Hash size={18} className="item-icon" style={{ color: 'var(--text-accent)' }} />
      ) : item.matchType === 'mention' ? (
        <AtSign size={18} className="item-icon" style={{ color: 'var(--text-accent)' }} />
      ) : (
        (() => {
          const lang = (item.language || 'markdown').toLowerCase()
          const title = (item.title || '').toLowerCase()
          if (['javascript', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'python', 'py'].includes(lang))
            return <FileCode size={18} className="item-icon" />
          if (lang === 'json') return <FileJson size={18} className="item-icon" />
          if (lang === 'markdown' || lang === 'md' || title.endsWith('.md'))
            return <Hash size={18} className="item-icon" />
          if (['png', 'jpg', 'jpeg', 'gif', 'svg'].some((ext) => title.endsWith('.' + ext)))
            return <ImageIcon size={18} className="item-icon" />
          return <FileText size={18} className="item-icon" />
        })()
      )}

      <div className="item-info">
        <div className="item-title">
          {item.folderId && item.matchType !== 'folder' && (
            <span className="folder-prefix">{item.folderId}/</span>
          )}
          <HighlightText text={item.title || 'Untitled'} highlight={query} />
          {item.id && dirtySnippetIds.includes(item.id) && (
            <div className="dirty-indicator" style={{ marginLeft: '8px' }} />
          )}
        </div>
        {(item.matchSnippet || item.folderPath || item.shortcut) && (
          <div className={`item-secondary ${isSemantic ? 'semantic-badge' : ''}`}>
            {isSemantic ? (
              '✨ AI Match'
            ) : item.shortcut ? (
              <div className="palette-shortcut">
                {item.shortcut.split('+').map((key, i) => (
                  <kbd key={i}>{key.trim()}</kbd>
                ))}
              </div>
            ) : item.folderPath ? (
              <span style={{ opacity: 0.6 }}>in {item.folderPath}</span>
            ) : (
              <HighlightText text={item.matchSnippet} highlight={query} />
            )}
          </div>
        )}
      </div>
    </div>
  )
})
const CommandPalette = React.memo(
  ({ isOpen, onClose, items, onSelect, onNew, onToggleSettings, onToggleGraph, onToggleChat, initialQuery = '' }) => {
    const [query, setQuery] = useState('')
    const deferredQuery = useDeferredValue(query)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [aiResults, setAiResults] = useState([])
    const inputRef = useRef(null)
    const listRef = useRef(null)

    const { searchNotes, isModelReady, modelLoadingProgress, aiError } = useAIStore()
    const { dirtySnippetIds, folders } = useVaultStore()
    const { tags } = useTag()
    const { mentions } = useMention()

    useKeyboardShortcuts({
      onEscape: null
    })

    useEffect(() => {
      if (!isOpen) return
      const handler = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }
      }
      window.addEventListener('keydown', handler, { capture: true })
      return () => window.removeEventListener('keydown', handler, { capture: true })
    }, [isOpen, onClose])

    useEffect(() => {
      if (isOpen) {
        setQuery(initialQuery)
        setSelectedIndex(0)
        setAiResults([])
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }, [isOpen, initialQuery])

    // AI Search Debounce
    useEffect(() => {
      const timer = setTimeout(async () => {
        if (deferredQuery.trim().length > 2) {
          const results = await searchNotes(deferredQuery, 0.45)
          setAiResults(results)
        } else {
          setAiResults([])
        }
      }, 400)
      return () => clearTimeout(timer)
    }, [deferredQuery])

    const fuseIndex = useMemo(() => {
      return new Fuse(items, {
        keys: [
          { name: 'title', weight: 3 },
          { name: 'folderId', weight: 2 }
        ],
        threshold: 0.4,
        includeMatches: true,
        includeScore: true,
        ignoreLocation: true
      })
    }, [items])

    const filtered = useMemo(() => {
      const lowerQuery = deferredQuery.toLowerCase().trim()

      // 0. System Actions (Show if query starts with > or matches)
      const isActionQuery = lowerQuery.startsWith('>')
      const actionQuery = isActionQuery ? lowerQuery.slice(1).trim() : lowerQuery

      const systemActions = [
        { id: 'action-settings-general', title: 'Settings: General', matchType: 'action', action: 'settings', tab: 'general', shortcut: 'Ctrl + ,' },
        { id: 'action-settings-appearance', title: 'Settings: Theme', matchType: 'action', action: 'settings', tab: 'appearance' },
        { id: 'action-settings-shortcuts', title: 'Settings: Shortcuts', matchType: 'action', action: 'settings', tab: 'shortcuts' },
        { id: 'action-settings-ai', title: 'Settings: AI & Language Models', matchType: 'action', action: 'settings', tab: 'ai' },
        { id: 'action-settings-type', title: 'Settings: Typography', matchType: 'action', action: 'settings', tab: 'type' },
        { id: 'action-settings-graph', title: 'Settings: Graph Node Settings', matchType: 'action', action: 'settings', tab: 'graph' },
        { id: 'action-chat', title: 'Chat: Open AI Chat', matchType: 'action', action: 'chat', shortcut: 'Ctrl + Shift + I' },
        { id: 'action-new', title: 'Note: Create New Snippet', matchType: 'action', action: 'new', shortcut: 'Ctrl + N' },
        { id: 'action-graph', title: 'Graph: Open Knowledge Nexus', matchType: 'action', action: 'graph', shortcut: 'Ctrl + G' }
      ].filter((a) => !actionQuery || a.title.toLowerCase().includes(actionQuery))

      // If it's a command query (starts with >), return ONLY system actions (like VS Code)
      if (isActionQuery) {
        return systemActions
      }

      // If it's empty, return recent/all files
      if (!lowerQuery) return items.slice(0, 50)

      // 1. Text Matches (Title & Folder via Fuse, Content via indexOf)
      const fuseResults = fuseIndex.search(actionQuery)
      const fuseMatchedIds = new Set(fuseResults.map((r) => r.item.id))

      const textMatches = fuseResults.map((result) => {
        const item = result.item
        let matchType = 'title'
        let matchSnippet = ''
        let score = 10 - (result.score || 0) * 10

        const bestMatch = result.matches?.[0]
        if (bestMatch && bestMatch.key === 'folderId') {
          matchType = 'folder-match'
        }
        return { ...item, matchType, matchSnippet, score }
      })

      // Fast, lightweight content search (stripped of Markdown)
      const stripMarkdown = (text) => {
        return text
          .replace(/[#*_\-~`>]/g, '') // remove symbols
          .replace(/\[(.*?)\]\(.*?\)/g, '$1') // remove links but keep text
          .replace(/\n+/g, ' ') // replace newlines with space
          .trim()
      }

      items.forEach((item) => {
        if (fuseMatchedIds.has(item.id)) return
        const code = item.code || item.content || ''
        if (!code) return

        const lowerCode = code.toLowerCase()
        const rawIndex = lowerCode.indexOf(actionQuery)
        
        if (rawIndex !== -1) {
          // Found a match! Only strip markdown from a tiny window around the match
          const start = Math.max(0, rawIndex - 30)
          const end = Math.min(code.length, rawIndex + actionQuery.length + 60)
          const rawSnippetChunk = code.slice(start, end)
          
          const cleanSnippetChunk = stripMarkdown(rawSnippetChunk)
          const matchSnippet = (start > 0 ? '...' : '') + cleanSnippetChunk + (end < code.length ? '...' : '')
          
          textMatches.push({ ...item, matchType: 'content', matchSnippet, score: 5 })
        }
      })

      textMatches.sort((a, b) => b.score - a.score)

      // 2. Semantic Matches
      const existingIds = new Set(textMatches.map((i) => i.id))
      const semanticMatches = aiResults
        .filter((r) => !existingIds.has(r.id))
        .map((r) => {
          const item = items.find((i) => i.id === r.id)
          if (!item) return null
          return {
            ...item,
            matchType: 'semantic',
            score: r.score * 4,
            matchSnippet: 'Semantic Match'
          }
        })
        .filter(Boolean)

      const results = [...textMatches, ...semanticMatches]

      // 3. Tags and Mentions matches
      const tagMatches = tags
        .filter((t) => t.toLowerCase().includes(lowerQuery))
        .map((t) => ({
          id: `tag-${t}`,
          title: `Tag: ${t}`,
          matchType: 'tag',
          action: 'filter',
          value: t,
          score: lowerQuery.startsWith('#') ? 100 : 8
        }))

      const mentionMatches = mentions
        .filter((m) => m.toLowerCase().includes(lowerQuery))
        .map((m) => ({
          id: `mention-${m}`,
          title: `Mention: ${m}`,
          matchType: 'mention',
          action: 'filter',
          value: m,
          score: lowerQuery.startsWith('@') ? 100 : 8
        }))

      const folderMatches = folders
        .filter((f) => {
          const folderName = f.split('/').pop() || f
          return (
            folderName.toLowerCase().includes(lowerQuery) || f.toLowerCase().includes(lowerQuery)
          )
        })
        .map((f) => {
          const parts = f.split('/')
          const folderName = parts.pop() || f
          const parentPath = parts.join('/')
          return {
            id: `folder-${f}`,
            title: folderName,
            folderPath: parentPath,
            matchType: 'folder',
            action: 'filter',
            value: f,
            score: 7
          }
        })

      const finalResults = [...results, ...tagMatches, ...mentionMatches, ...folderMatches].sort(
        (a, b) => b.score - a.score
      )

      return finalResults.slice(0, 50)
    }, [deferredQuery, items, tags, mentions, folders, fuseIndex, aiResults])

    useEffect(() => {
      if (selectedIndex >= filtered.length && filtered.length > 0) {
        setSelectedIndex(filtered.length - 1)
      }
    }, [filtered.length, selectedIndex])

    useEffect(() => {
      if (listRef.current && filtered.length > 0) {
        listRef.current.scrollToItem(selectedIndex, 'auto')
      }
    }, [selectedIndex])

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter') {
        const item = filtered[selectedIndex]
        if (item) {
          if (item.action === 'filter') {
            setQuery(item.value + ' ')
            inputRef.current?.focus()
            return
          }
          if (item.matchType === 'action') {
            if (item.action === 'settings') onToggleSettings?.(item.tab)
            else if (item.action === 'new') onNew?.()
            else if (item.action === 'graph') onToggleGraph?.()
            else if (item.action === 'chat') onToggleChat?.()
          } else if (item.matchType === 'folder') {
            // Just close, no action
          } else {
            onSelect(item)
          }
          onClose()
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    const itemData = useMemo(() => ({
      filtered,
      selectedIndex,
      setSelectedIndex,
      query,
      setQuery,
      inputRef,
      onSelect,
      onNew,
      onToggleSettings,
      onToggleGraph,
      onToggleChat,
      onClose,
      dirtySnippetIds
    }), [
      filtered,
      selectedIndex,
      query,
      dirtySnippetIds,
      onSelect,
      onNew,
      onToggleSettings,
      onToggleGraph,
      onToggleChat,
      onClose
    ])

    if (!isOpen) return null

    return createPortal(
      <div className="command-palette-overlay" onClick={onClose}>
        <div className="command-palette-container" onClick={(e) => e.stopPropagation()}>
          <div className="palette-input-wrap">
            <Search size={18} className="palette-search-icon" />
            <input
              ref={inputRef}
              type="text"
              placeholder={query.startsWith('>') ? "Search commands..." : "Search notes..."}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedIndex(0)
              }}
              onKeyDown={handleKeyDown}
            />
            <div className="palette-hint">
              {aiError ? (
                <span style={{ color: 'var(--text-error)' }}>⚠️ AI Error: {aiError}</span>
              ) : (
                'ESC to close'
              )}
            </div>
          </div>

          <div
            className="palette-results"
            style={{ height: filtered.length > 0 ? Math.min(filtered.length * 48, 320) : 100 }}
          >
            {filtered.length > 0 ? (
              <List
                ref={listRef}
                itemData={itemData}
                height={Math.min(filtered.length * 48, 320)}
                itemCount={filtered.length}
                itemSize={48}
                width="100%"
              >
                {CommandPaletteRow}
              </List>
            ) : (
              <div className="palette-empty">No matching notes found</div>
            )}
          </div>

          <div className="palette-footer">
            <div className="footer-tip">
              <span>
                <kbd>↑</kbd> <kbd>↓</kbd> to navigate
              </span>
              <span>
                <kbd>↵</kbd> to open
              </span>
            </div>
            <div className="footer-tip">
              <span>
                <kbd>ESC</kbd> to dismiss
              </span>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )
  }
)

CommandPalette.displayName = 'CommandPalette'

export default CommandPalette
