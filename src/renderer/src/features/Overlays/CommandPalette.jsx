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
  MessageSquare,
  Book,
  Square,
  GripVertical,
  Trash2
} from 'lucide-react'
import Fuse from 'fuse.js'
import { rankSnippets, getHighlightRegex } from '../../core/utils/searchRanker'
import { useTag } from '../../core/hooks/useTag'
import { useMention } from '../../core/hooks/useMention'
import { useShallow } from 'zustand/react/shallow'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useAIStore } from '../AI/tools/LuminaChat'
import { MessageContent } from '../AI/LuminaChat'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { PreviewCommandPalette } from './PreviewCommandPalette'
import '../AI/LuminaChat.css'
import './CommandPalette.css'

/**
 * Virtualized Command Palette (Obsidian Standard #5)
 * Feature: Fuzzy Match + Semantic AI Search
 * Memoized for performance - expensive search/filter operations.
 */
const HighlightText = React.memo(({ text, highlight }) => {
  if (!highlight?.trim() || text === 'Semantic Match' || !text) return <span>{text || ''}</span>
  const regex = getHighlightRegex(highlight)
  if (!regex) return <span>{text}</span>
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

const CommandPaletteRow = React.memo(
  React.forwardRef(({ index, data }, ref) => {
    const {
      filtered,
      selectedIndex,
      setSelectedIndex,
      deferredQuery: query,
      setQuery,
      inputRef,
      onSelect,
      onNew,
      onToggleSettings,
      onToggleGraph,
      onToggleChat,
      onClose,
      dirtySnippetIds,
      settings,
      updateSetting,
      onRename,
      onToggleDocs
    } = data

    const item = filtered[index]
    const isActive = index === selectedIndex
    const isSemantic = item.matchType === 'semantic'
    const isAction = item.matchType === 'action'

    return (
      <div
        ref={ref}
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
            else if (item.action === 'docs') onToggleDocs?.()
            else if (item.action === 'rename') onRename?.()
            else if (item.action === 'update') window.electron?.ipcRenderer.send('check-for-updates')
            else if (item.action === 'reload-window') window.location.reload()
            else if (item.action === 'toggle-type-sound') {
              updateSetting('typeSound', !settings.typeSound)
              // don't close palette on toggle so they see it change, or close?
              // Actually, keep it simple and just close or not. Let's just not close it so they can see the toggle change!
              return
            }
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
              if (item.tab === 'general')
                return <Settings size={18} className="item-icon action-icon" />
              if (item.tab === 'appearance')
                return <Palette size={18} className="item-icon action-icon" />
              if (item.tab === 'shortcuts')
                return <Keyboard size={18} className="item-icon action-icon" />
              if (item.tab === 'ai') return <Bot size={18} className="item-icon action-icon" />
              if (item.tab === 'type') return <Type size={18} className="item-icon action-icon" />
              if (item.tab === 'graph')
                return <Network size={18} className="item-icon action-icon" />
              return <Settings size={18} className="item-icon action-icon" />
            }
            if (item.action === 'new') return <Plus size={18} className="item-icon action-icon" />
            if (item.action === 'graph')
              return <Network size={18} className="item-icon action-icon" />
            if (item.action === 'chat')
              return <MessageSquare size={18} className="item-icon action-icon" />
            if (item.action === 'docs') return <Book size={18} className="item-icon action-icon" />
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
            if (
              ['javascript', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'python', 'py'].includes(lang)
            )
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
          <div
            className="item-header-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              minWidth: 0
            }}
          >
            <div className="item-title">
              {item.folderId && item.matchType !== 'folder' && (
                <span className="folder-prefix">{item.folderId}/</span>
              )}
              <HighlightText text={item.title || 'Untitled'} highlight={query} />
              {item.id && dirtySnippetIds.includes(item.id) && (
                <div className="dirty-indicator" style={{ marginLeft: '8px' }} />
              )}
            </div>
            {(item.shortcut || (item.folderPath && !item.matchSnippet)) && (
              <div className="item-meta-right" style={{ flexShrink: 0, marginLeft: '8px' }}>
                {item.shortcut ? (
                  <div className="palette-shortcut">
                    {item.shortcut.split('+').map((key, i) => (
                      <kbd key={i}>{key.trim()}</kbd>
                    ))}
                  </div>
                ) : (
                  <span style={{ opacity: 0.6, fontSize: '11px' }}>in {item.folderPath}</span>
                )}
              </div>
            )}
          </div>
          {(item.matchSnippet || isSemantic) && (
            <div className={`item-secondary ${isSemantic ? 'semantic-badge' : ''}`}>
              {isSemantic ? (
                '✨ AI Match'
              ) : (
                <HighlightText text={item.matchSnippet} highlight={query} />
              )}
            </div>
          )}
        </div>
      </div>
    )
  })
)
const CommandPalette = React.memo(
  ({
    isOpen,
    onClose,
    items,
    onSelect,
    onNew,
    onToggleSettings,
    onToggleGraph,
    onToggleChat,
    onToggleDocs,
    onRename,
    initialQuery = ''
  }) => {
    const [query, setQuery] = useState('')
    const deferredQuery = useDeferredValue(query)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [aiResults, setAiResults] = useState([])
    const [mode, setMode] = useState('search') // 'search' | 'ai'
    const [splitRatio, setSplitRatio] = useState(50)
    const inputRef = useRef(null)
    const listRef = useRef(null)
    const itemRefs = useRef({})
    const previousFocusRef = useRef(null)
    const chatScrollRef = useRef(null)

    const {
      searchNotes,
      isModelReady,
      modelLoadingProgress,
      aiError,
      chatMessages,
      isChatLoading,
      cancelChat,
      sendChatMessage,
      clearChat
    } = useAIStore()
    const { dirtySnippetIds, folders, selectedSnippet } = useVaultStore(
      useShallow((state) => ({
        dirtySnippetIds: state.dirtySnippetIds,
        folders: state.folders,
        selectedSnippet: state.selectedSnippet
      }))
    )
    const { settings, updateSetting } = useSettingsStore()
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
        previousFocusRef.current = document.activeElement
        setQuery(initialQuery)
        setSelectedIndex(0)
        setAiResults([])
        setMode(settings.commandPaletteMode || 'search')
        setTimeout(() => inputRef.current?.focus(), 50)
      } else {
        if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
          setTimeout(() => previousFocusRef.current?.focus(), 10)
        }
      }
    }, [isOpen, initialQuery])

    useEffect(() => {
      if (mode === 'ai' && chatScrollRef.current) {
        const scrollToBottom = () => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
          }
        }
        scrollToBottom()
        const timeoutId = setTimeout(scrollToBottom, 50)
        return () => clearTimeout(timeoutId)
      }
    }, [chatMessages, isChatLoading, isOpen, mode])

    // AI Search Debounce (Skip if in AI Chat mode)
    useEffect(() => {
      if (mode === 'ai') return

      const timer = setTimeout(async () => {
        if (deferredQuery.trim().length > 2) {
          const results = await searchNotes(deferredQuery, 0.45)
          setAiResults(results)
        } else {
          setAiResults([])
        }
      }, 400)
      return () => clearTimeout(timer)
    }, [deferredQuery, mode])

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
      if (mode === 'ai') return [] // Skip all heavy searching if we are just chatting

      const lowerQuery = deferredQuery.toLowerCase().trim()

      // 0. System Actions (Show if query starts with > or matches)
      const isActionQuery = lowerQuery.startsWith('>')
      const actionQuery = isActionQuery ? lowerQuery.slice(1).trim() : lowerQuery

      const systemActions = [
        {
          id: 'action-settings-general',
          title: 'Settings: General',
          matchType: 'action',
          action: 'settings',
          tab: 'general',
          shortcut: 'Ctrl + ,'
        },
        {
          id: 'action-settings-appearance',
          title: 'Settings: Theme',
          matchType: 'action',
          action: 'settings',
          tab: 'appearance'
        },
        {
          id: 'action-settings-shortcuts',
          title: 'Settings: Shortcuts',
          matchType: 'action',
          action: 'settings',
          tab: 'shortcuts'
        },
        {
          id: 'action-settings-ai',
          title: 'Settings: AI & Language Models',
          matchType: 'action',
          action: 'settings',
          tab: 'ai'
        },
        {
          id: 'action-settings-type',
          title: 'Settings: Typography',
          matchType: 'action',
          action: 'settings',
          tab: 'type'
        },
        {
          id: 'action-settings-graph',
          title: 'Settings: Graph Node Settings',
          matchType: 'action',
          action: 'settings',
          tab: 'graph'
        },
        {
          id: 'action-toggle-type-sound',
          title: `Toggle Mechanical Keyboard Sound (${settings?.typeSound ? 'On' : 'Off'})`,
          matchType: 'action',
          action: 'toggle-type-sound'
        },
        {
          id: 'action-reload-window',
          title: 'Developer: Reload Window',
          matchType: 'action',
          action: 'reload-window',
          shortcut: 'Ctrl + R'
        },
        {
          id: 'action-chat',
          title: 'Chat: Open AI Chat',
          matchType: 'action',
          action: 'chat',
          shortcut: 'Ctrl + Shift + \\'
        },
        {
          id: 'action-docs',
          title: 'Docs: Open Documentation',
          matchType: 'action',
          action: 'docs'
        },
        {
          id: 'action-new',
          title: 'Note: Create New Note',
          matchType: 'action',
          action: 'new',
          shortcut: 'Ctrl + N'
        },
        {
          id: 'action-rename',
          title: 'Note: Rename Note',
          matchType: 'action',
          action: 'rename',
          shortcut: 'Ctrl + R'
        },
        {
          id: 'action-graph',
          title: 'Graph: Open Knowledge Nexus',
          matchType: 'action',
          action: 'graph',
          shortcut: 'Ctrl + G'
        },
        {
          id: 'action-update',
          title: 'App: Check for Updates',
          matchType: 'action',
          action: 'update'
        }
      ].filter((a) => !actionQuery || a.title.toLowerCase().includes(actionQuery))

      // If it's a command query (starts with >), return ONLY system actions (like VS Code)
      if (isActionQuery) {
        return systemActions.slice(0, 10)
      }

      // If it's empty, return recent/all files
      if (!lowerQuery) return items.slice(0, 5)

      // 1. Text Matches (Title & Folder via Fuse, Content via shared rankSnippets)
      const { results: textMatches } = rankSnippets(items, actionQuery, fuseIndex)

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

      return finalResults.slice(0, 10)
    }, [deferredQuery, items, tags, mentions, folders, fuseIndex, aiResults, settings?.typeSound])

    useEffect(() => {
      if (selectedIndex >= filtered.length && filtered.length > 0) {
        setSelectedIndex(filtered.length - 1)
      }
    }, [filtered.length, selectedIndex])

    // Auto-scroll to selected item
    useEffect(() => {
      if (filtered.length > 0 && itemRefs.current[selectedIndex]) {
        itemRefs.current[selectedIndex].scrollIntoView({ block: 'nearest' })
      }
    }, [selectedIndex])

    // Explicitly reset scroll when returning to search mode to prevent layout shift glitches
    useEffect(() => {
      if (mode === 'search' && listRef.current) {
        listRef.current.scrollTop = 0
      }
    }, [mode])

    const handleResizerMouseDown = (e) => {
      e.preventDefault()
      const startX = e.clientX
      const startRatio = splitRatio

      const handleMouseMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX
        const modalWidth = 820 // fixed max width for now
        const deltaRatio = (deltaX / modalWidth) * 100
        const newRatio = Math.max(20, Math.min(80, startRatio + deltaRatio))
        setSplitRatio(newRatio)
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        updateSetting('commandPaletteSplitRatio', splitRatio)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (mode === 'search') setSelectedIndex((prev) => (prev + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (mode === 'search')
          setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter') {
        if (mode === 'ai') {
          if (query.trim() && !isChatLoading) {
            sendChatMessage(query.trim(), selectedSnippet ? [selectedSnippet] : [])
            setQuery('')
          }
          return
        }

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
            else if (item.action === 'docs') onToggleDocs?.()
            else if (item.action === 'rename') onRename?.()
            else if (item.action === 'update') window.electron?.ipcRenderer.send('check-for-updates')
            else if (item.action === 'reload-window') window.location.reload()
            else if (item.action === 'toggle-type-sound') {
              updateSetting('typeSound', !settings.typeSound)
              return
            }
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

    const itemData = useMemo(
      () => ({
        filtered,
        selectedIndex,
        setSelectedIndex,
        deferredQuery,
        setQuery,
        inputRef,
        onSelect,
        onNew,
        onToggleSettings,
        onToggleGraph,
        onToggleChat,
        onToggleDocs,
        onRename,
        onClose,
        dirtySnippetIds,
        settings,
        updateSetting
      }),
      [
        filtered,
        selectedIndex,
        deferredQuery,
        dirtySnippetIds,
        settings,
        onSelect,
        onNew,
        onToggleSettings,
        onToggleGraph,
        onToggleChat,
        onToggleDocs,
        onRename,
        onClose,
        updateSetting
      ]
    )

    const selectedItemContent = useMemo(() => {
      const item = filtered[selectedIndex]
      if (
        !item ||
        item.matchType === 'action' ||
        item.matchType === 'folder' ||
        item.matchType === 'tag' ||
        item.matchType === 'mention'
      )
        return null
      return item.code || item.matchSnippet || ''
    }, [filtered, selectedIndex])

    const chatContent = useMemo(
      () => (
        <div className="palette-chat-messages seamless-scrollbar" ref={chatScrollRef}>
          {!chatMessages || chatMessages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-faint)' }}>
              <Bot size={32} style={{ opacity: 0.5, marginBottom: '16px' }} />
              <p>Ask Lumina any question.</p>
              <p style={{ fontSize: '12px', opacity: 0.7 }}>
                I'll search your knowledge base and answer.
              </p>
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}`} style={{ padding: '0 12px' }}>
                {msg.role === 'assistant' &&
                !msg.content?.trim() &&
                !msg.imageUrl &&
                ((i === chatMessages.length - 1 && isChatLoading) || msg.isGenerating) ? (
                  <div className="thinking-indicator">
                    <span className="thinking-text">
                      <span className="thinking-dot-pulse" />
                      Thinking...
                    </span>
                  </div>
                ) : msg.role === 'assistant' ? (
                  <MessageContent content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
            ))
          )}
        </div>
      ),
      [chatMessages, isChatLoading]
    )

    if (!isOpen) return null

    return createPortal(
      <div className="command-palette-overlay" onClick={onClose}>
        <div className="command-palette-container" onClick={(e) => e.stopPropagation()}>
          <div className="palette-input-wrap horizontal">
            <Search size={18} className="palette-search-icon" />
            <input
              ref={inputRef}
              type="text"
              placeholder={
                mode === 'ai'
                  ? 'Ask Lumina anything...'
                  : query.startsWith('>')
                    ? 'Search commands...'
                    : 'Search notes... (Type > for commands)'
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedIndex(0)
              }}
              onKeyDown={handleKeyDown}
            />
            <div className="palette-mode-toggle">
              <button
                className={`palette-header-btn ${mode === 'search' ? 'active' : ''}`}
                onClick={() => {
                  setMode('search')
                  updateSetting('commandPaletteMode', 'search')
                }}
              >
                Search
              </button>
              <button
                className={`palette-header-btn ${mode === 'ai' ? 'active' : ''}`}
                onClick={() => {
                  setMode('ai')
                  updateSetting('commandPaletteMode', 'ai')
                }}
              >
                Ask AI
              </button>
              {mode === 'ai' && isChatLoading && (
                <button className="palette-header-btn danger" onClick={cancelChat}>
                  <Square size={10} fill="currentColor" /> Stop
                </button>
              )}
              {mode === 'ai' && chatMessages?.length > 0 && (
                <button
                  className="palette-header-btn danger"
                  style={{ padding: '0 8px' }}
                  onClick={clearChat}
                  title="Clear Session"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="palette-body">
            {mode === 'search' ? (
              <>
                <div
                  className="palette-results-col"
                  style={{ width: `${splitRatio}%`, display: 'flex', flexDirection: 'column' }}
                >
                  <div
                    className="palette-results seamless-scrollbar"
                    ref={listRef}
                    style={{ height: filtered.length > 0 ? '100%' : 100, overflowY: 'auto' }}
                  >
                    {filtered.length > 0 ? (
                      filtered.map((item, index) => (
                        <CommandPaletteRow
                          key={item.id || item.action || index}
                          index={index}
                          data={itemData}
                          ref={(el) => (itemRefs.current[index] = el)}
                        />
                      ))
                    ) : (
                      <div className="palette-zero-results">
                        <Search size={24} style={{ opacity: 0.3 }} />
                        <span>No matching notes found for "{query}"</span>
                        {query.trim().length > 0 && (
                          <button
                            className="palette-ask-lumina-btn"
                            onClick={() => {
                              setMode('ai')
                              updateSetting('commandPaletteMode', 'ai')
                              if (query.trim() && !isChatLoading) {
                                sendChatMessage(
                                  query.trim(),
                                  selectedSnippet ? [selectedSnippet] : []
                                )
                                setQuery('')
                              }
                            }}
                          >
                            Ask Lumina: "{query}"
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="palette-resizer" onMouseDown={handleResizerMouseDown}>
                  <div className="resizer-grip">
                    <GripVertical size={14} />
                  </div>
                </div>

                <div className="palette-preview-col" style={{ width: `${100 - splitRatio}%` }}>
                  {selectedItemContent ? (
                    <PreviewCommandPalette
                      key={filtered[selectedIndex]?.id || 'preview'}
                      content={selectedItemContent}
                      onClose={onClose}
                    />
                  ) : (
                    <div
                      style={{
                        padding: '40px',
                        textAlign: 'center',
                        color: 'var(--text-faint)',
                        opacity: 0.5,
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <FileText size={48} strokeWidth={1} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="palette-chat-container" style={{ flex: 1, width: '100%' }}>
                {chatContent}
              </div>
            )}
          </div>

          <div className="palette-footer horizontal horizontal-top">
            <div className="footer-tip">
              <span>
                <kbd>↑</kbd> <kbd>↓</kbd> to navigate
              </span>
              {mode === 'search' && (
                <span>
                  <kbd>↵</kbd> to open
                </span>
              )}
              {mode === 'ai' && (
                <span>
                  <kbd>↵</kbd> to send
                </span>
              )}
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
