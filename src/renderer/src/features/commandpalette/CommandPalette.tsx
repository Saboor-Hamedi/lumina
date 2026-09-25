/**
 * =========================================================================
 * Virtualized Command Palette (`CommandPalette.tsx`)
 * =========================================================================
 *
 * Feature-packed quick-open and command execution palette (Obsidian / VSCode standard).
 * Features:
 * - High-speed fuzzy search via Fuse.js + SearchRanker algorithm
 * - Semantic AI note search powered by Lumina AI vector store
 * - Direct conversational AI chat with Lumina within the palette interface
 * - Actions palette for settings tabs, note creation, graph nexus, reload, etc.
 * - Split-pane live note preview with draggable resizer grip
 * - Substring text highlighting with memoized rendering
 * - Keyboard navigation (Arrow keys, Enter, Esc, shortcuts)
 *
 * Fully typed in TypeScript for peak performance and type safety.
 * =========================================================================
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react'
import { createPortal } from 'react-dom'
import {
  Search,
  FileText,
  Zap,
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
import { scoreFuzzy, FuzzyMatchRange } from '../../core/utils/fuzzyScorer'
import { getHighlightRegex } from '../../core/utils/searchRanker'
import { useTag } from '../../core/hooks/useTag'
import { useMention } from '../../core/hooks/useMention'
import { useShallow } from 'zustand/react/shallow'
import { useKeyboardShortcuts } from '../../core/shortcuts'
// Lumina AI Agent store
import { useAIStore } from '../AI/tools/lumina'
// Lumina AI chat components
import { ChatMessageRow } from '../AI/Lumina'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { useSettingsStore } from '../../core/store/SettingStore'
import { PreviewCommandPalette } from './PreviewCommandPalette'
import '../AI/css/lumina.css'
import './commandPalette.css'

export interface PaletteItem {
  id?: string
  title?: string
  matchType?: 'action' | 'folder' | 'tag' | 'mention' | 'semantic' | string
  action?: string
  tab?: string
  shortcut?: string
  score?: number
  value?: string
  folderId?: string
  folderPath?: string
  matchSnippet?: string
  matchRanges?: FuzzyMatchRange[]
  language?: string
  type?: string
  relativePath?: string
  fileName?: string
  code?: string
  [key: string]: any
}

interface HighlightTextProps {
  text?: string
  highlight?: string
  ranges?: FuzzyMatchRange[]
}

const HighlightText: React.FC<HighlightTextProps> = React.memo(({ text, highlight, ranges }) => {
  if (!text) return <span></span>

  if (ranges && ranges.length > 0) {
    const nodes: React.ReactNode[] = []
    let cursor = 0
    for (let i = 0; i < ranges.length; i++) {
      const { start, end } = ranges[i]
      if (start > cursor) {
        nodes.push(<span key={`t-${i}`}>{text.substring(cursor, start)}</span>)
      }
      nodes.push(
        <mark key={`m-${i}`} className="palette-match">
          {text.substring(start, end)}
        </mark>
      )
      cursor = end
    }
    if (cursor < text.length) {
      nodes.push(<span key="t-end">{text.substring(cursor)}</span>)
    }
    return <span>{nodes}</span>
  }

  if (!highlight?.trim() || text === 'Semantic Match') return <span>{text}</span>
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

HighlightText.displayName = 'HighlightText'

export interface CommandPaletteRowData {
  filtered: PaletteItem[]
  selectedIndex: number
  setSelectedIndex: (idx: number) => void
  deferredQuery: string
  setQuery: (q: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  onSelect: (item: PaletteItem) => void
  onNew?: () => void
  onToggleSettings?: (tab?: string) => void
  onToggleGraph?: () => void
  onToggleChat?: () => void
  onToggleDocs?: () => void
  onRename?: () => void
  onClose: () => void
  dirtySnippetIds: string[]
  settings: any
  updateSetting: (key: string, val: any) => void
}

interface CommandPaletteRowProps {
  index: number
  data: CommandPaletteRowData
}

const CommandPaletteRow = React.memo(
  React.forwardRef<HTMLDivElement, CommandPaletteRowProps>(({ index, data }, ref) => {
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
    if (!item) return null

    const isActive = index === selectedIndex
    const isSemantic = item.matchType === 'semantic'
    const isAction = item.matchType === 'action'

    return (
      <div
        ref={ref}
        className={`palette-item ${isActive ? 'active' : ''} ${isAction ? 'is-action' : ''}`}
        onClick={() => {
          if (selectedIndex !== index) setSelectedIndex(index)
          if (item.action === 'filter') {
            setQuery((item.value || '') + ' ')
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
            else if (item.action === 'update') (window as any).electron?.ipcRenderer.send('check-for-updates')
            else if (item.action === 'reload-window') window.location.reload()
            else if (item.action === 'toggle-type-sound') {
              updateSetting('typeSound', !settings?.typeSound)
              return
            }
          } else if (item.matchType === 'folder') {
            // Just close, no action
          } else {
            onSelect(item)
          }
          onClose()
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
              <HighlightText text={item.title || 'Untitled'} highlight={query} ranges={item.matchRanges} />
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

CommandPaletteRow.displayName = 'CommandPaletteRow'

export interface CommandPaletteProps {
  /** Whether the command palette modal is currently open */
  isOpen: boolean
  /** Callback to close the palette */
  onClose: () => void
  /** List of searchable items/notes in the current workspace */
  items: PaletteItem[]
  /** Callback triggered when a note or item is selected */
  onSelect: (item: PaletteItem) => void
  /** Action: create a new note */
  onNew?: () => void
  /** Action: open settings modal to specified tab */
  onToggleSettings?: (tab?: string) => void
  /** Action: open graph view */
  onToggleGraph?: () => void
  /** Action: toggle AI chat drawer */
  onToggleChat?: () => void
  /** Action: open documentation */
  onToggleDocs?: () => void
  /** Action: rename active note */
  onRename?: () => void
  /** Initial search query text */
  initialQuery?: string
}

export const CommandPalette: React.FC<CommandPaletteProps> = React.memo(
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
    const [query, setQuery] = useState<string>('')
    const deferredQuery = useDeferredValue(query)
    const [selectedIndex, setSelectedIndex] = useState<number>(0)
    const [aiResults, setAiResults] = useState<any[]>([])
    const [mode, setMode] = useState<'search' | 'ai'>('search')
    const [splitRatio, setSplitRatio] = useState<number>(50)
    const inputRef = useRef<HTMLInputElement | null>(null)
    const listRef = useRef<HTMLDivElement | null>(null)
    const itemRefs = useRef<Record<number, HTMLDivElement | null>>({})
    const previousFocusRef = useRef<Element | null>(null)
    const chatScrollRef = useRef<HTMLDivElement | null>(null)

    const {
      searchNotes,
      chatMessages,
      isChatLoading,
      cancelChat,
      sendChatMessage,
      clearChat
    } = useAIStore()
    const { dirtySnippetIds, folders, selectedSnippet } = useWorkspaceStore(
      useShallow((state) => ({
        dirtySnippetIds: state.dirtyNoteIds || [],
        folders: state.folders || [],
        selectedSnippet: state.selectedNote
      }))
    )
    const { settings, updateSetting } = useSettingsStore()
    const { tags } = useTag()
    const { mentions } = useMention()

    useKeyboardShortcuts({
      onEscape: isOpen
        ? () => {
            onClose()
            return true
          }
        : undefined
    })

    useEffect(() => {
      if (isOpen) {
        previousFocusRef.current = document.activeElement
        setQuery(initialQuery)
        setSelectedIndex(0)
        setAiResults([])
        setMode((settings?.commandPaletteMode as 'ai' | 'search') || 'search')
        setTimeout(() => inputRef.current?.focus(), 50)
      } else {
        if (previousFocusRef.current && typeof (previousFocusRef.current as HTMLElement).focus === 'function') {
          setTimeout(() => (previousFocusRef.current as HTMLElement)?.focus(), 10)
        }
      }
    }, [isOpen, initialQuery, settings?.commandPaletteMode])

    useEffect(() => {
      if (mode === 'ai' && chatScrollRef.current) {
        const scrollToBottom = (): void => {
          if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
          }
        }
        scrollToBottom()
        const timeoutId = setTimeout(scrollToBottom, 50)
        return () => clearTimeout(timeoutId)
      }
    }, [chatMessages, isChatLoading, isOpen, mode])

    const filtered: PaletteItem[] = useMemo(() => {
      if (mode === 'ai') return [] // Skip all heavy searching if we are chatting

      const lowerQuery = deferredQuery.toLowerCase().trim()

      // 0. System Actions (Show if query starts with > or matches)
      const isActionQuery = lowerQuery.startsWith('>')
      const actionQuery = isActionQuery ? lowerQuery.slice(1).trim() : lowerQuery

      const systemActions: PaletteItem[] = [
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
          id: 'action-mail',
          title: 'Mail: Open Lumina Mail (Gmail)',
          matchType: 'action',
          action: 'mail'
        },
        {
          id: 'action-update',
          title: 'App: Check for Updates',
          matchType: 'action',
          action: 'update'
        }
      ]

      // If it's a command query (starts with >), return ONLY system actions (like VS Code)
      if (isActionQuery) {
        if (!actionQuery) return systemActions.slice(0, 15)
        return systemActions
          .map((action) => {
            const res = scoreFuzzy(action.title || '', actionQuery)
            if (!res) return null
            return { ...action, score: res.score, matchRanges: res.ranges }
          })
          .filter(Boolean)
          .sort((a, b) => (b!.score || 0) - (a!.score || 0))
          .slice(0, 15) as PaletteItem[]
      }

      // If it's empty, return recent/all files
      if (!lowerQuery) return items.slice(0, 10)

      // 1. In-memory Fuzzy Subsequence Note Matches (VS Code speed < 0.1ms)
      const noteMatches: PaletteItem[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const title = item.title || item.fileName || ''
        const titleRes = scoreFuzzy(title, actionQuery)
        if (titleRes) {
          noteMatches.push({
            ...item,
            score: titleRes.score + 50,
            matchRanges: titleRes.ranges
          })
          continue
        }

        // Fallback: match folder path if title didn't match
        const folder = item.folderId || item.relativePath || ''
        if (folder) {
          const folderRes = scoreFuzzy(folder, actionQuery)
          if (folderRes) {
            noteMatches.push({
              ...item,
              score: folderRes.score,
              matchRanges: []
            })
          }
        }
      }

      // 2. Action matches matching action titles
      const actionMatches: PaletteItem[] = systemActions
        .map((action) => {
          const res = scoreFuzzy(action.title || '', actionQuery)
          if (!res) return null
          return { ...action, score: res.score - 10, matchRanges: res.ranges }
        })
        .filter(Boolean) as PaletteItem[]

      // 3. Tags matches
      const tagMatches: PaletteItem[] = (tags || [])
        .map((t) => {
          const cleanQuery = lowerQuery.startsWith('#') ? lowerQuery.slice(1) : lowerQuery
          const res = scoreFuzzy(t, cleanQuery)
          if (!res) return null
          return {
            id: `tag-${t}`,
            title: `Tag: ${t}`,
            matchType: 'tag',
            action: 'filter',
            value: t,
            score: res.score + (lowerQuery.startsWith('#') ? 100 : 0),
            matchRanges: res.ranges
          }
        })
        .filter(Boolean) as PaletteItem[]

      // 4. Mentions matches
      const mentionMatches: PaletteItem[] = (mentions || [])
        .map((m) => {
          const cleanQuery = lowerQuery.startsWith('@') ? lowerQuery.slice(1) : lowerQuery
          const res = scoreFuzzy(m, cleanQuery)
          if (!res) return null
          return {
            id: `mention-${m}`,
            title: `Mention: ${m}`,
            matchType: 'mention',
            action: 'filter',
            value: m,
            score: res.score + (lowerQuery.startsWith('@') ? 100 : 0),
            matchRanges: res.ranges
          }
        })
        .filter(Boolean) as PaletteItem[]

      // 5. Folder matches
      const folderMatches: PaletteItem[] = (folders || [])
        .map((f) => {
          const folderName = f.split('/').pop() || f
          const res = scoreFuzzy(folderName, lowerQuery)
          if (!res) return null
          const parts = f.split('/')
          const parentPath = parts.slice(0, -1).join('/')
          return {
            id: `folder-${f}`,
            title: folderName,
            folderPath: parentPath,
            matchType: 'folder',
            action: 'filter',
            value: f,
            score: res.score - 15,
            matchRanges: res.ranges
          }
        })
        .filter(Boolean) as PaletteItem[]

      const finalResults = [
        ...noteMatches,
        ...actionMatches,
        ...tagMatches,
        ...mentionMatches,
        ...folderMatches
      ].sort((a, b) => (b.score || 0) - (a.score || 0))

      return finalResults.slice(0, 15)
    }, [deferredQuery, items, tags, mentions, folders, settings?.typeSound, mode])

    useEffect(() => {
      if (selectedIndex >= filtered.length && filtered.length > 0) {
        setSelectedIndex(filtered.length - 1)
      }
    }, [filtered.length, selectedIndex])

    // Auto-scroll to selected item
    useEffect(() => {
      if (filtered.length > 0 && itemRefs.current[selectedIndex]) {
        itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' })
      }
    }, [selectedIndex, filtered.length])

    // Explicitly reset scroll when returning to search mode to prevent layout shift glitches
    useEffect(() => {
      if (mode === 'search' && listRef.current) {
        listRef.current.scrollTop = 0
      }
    }, [mode])

    const handleResizerMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
      e.preventDefault()
      const startX = e.clientX
      const startRatio = splitRatio

      const handleMouseMove = (moveEvent: MouseEvent): void => {
        const deltaX = moveEvent.clientX - startX
        const modalWidth = 820 // fixed max width for now
        const deltaRatio = (deltaX / modalWidth) * 100
        const newRatio = Math.max(20, Math.min(80, startRatio + deltaRatio))
        setSplitRatio(newRatio)
      }

      const handleMouseUp = (): void => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        updateSetting('commandPaletteSplitRatio', splitRatio)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (mode === 'search' && filtered.length > 0) setSelectedIndex((prev) => (prev + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (mode === 'search' && filtered.length > 0)
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
            setQuery((item.value || '') + ' ')
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
            else if (item.action === 'mail') window.dispatchEvent(new CustomEvent('open-email'))
            else if (item.action === 'update') (window as any).electron?.ipcRenderer.send('check-for-updates')
            else if (item.action === 'reload-window') window.location.reload()
            else if (item.action === 'toggle-type-sound') {
              updateSetting('typeSound', !settings?.typeSound)
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
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    const itemData: CommandPaletteRowData = useMemo(
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

      if (item.type === 'image') {
        const relPath =
          item.relativePath ||
          (item.folderId ? `${item.folderId}/${item.fileName}` : item.fileName)
        return `![${item.title || item.fileName}](${relPath})`
      }

      if (item.type === 'pdf') {
        const relPath =
          item.relativePath ||
          (item.folderId ? `${item.folderId}/${item.fileName}` : item.fileName)
        return `[📄 ${item.title || item.fileName}](${relPath})`
      }

      return item.code || item.matchSnippet || ''
    }, [filtered, selectedIndex])

    const [previewContent, setPreviewContent] = useState<string | null>(null)
    useEffect(() => {
      if (!selectedItemContent) {
        setPreviewContent(null)
        return
      }
      const timer = setTimeout(() => {
        setPreviewContent(selectedItemContent)
      }, 70)
      return () => clearTimeout(timer)
    }, [selectedItemContent])

    const handleCopy = useCallback((text: string): void => {
      navigator.clipboard.writeText(text)
    }, [])

    const handleRating = useCallback(
      (index: number, type: string): void => {
        const current = (chatMessages as any[])[index]?.rating
        const newRating = current === type ? null : type
        const updated = [...(chatMessages as any[])]
        if (updated[index]) {
          updated[index] = { ...updated[index], rating: newRating }
          useAIStore.setState({ chatMessages: updated })
        }
      },
      [chatMessages]
    )

    const userMentionRegex = useMemo(() => {
      const list = items || []
      const titles = list
        .map((s) => s.title)
        .filter(Boolean)
        .sort((a, b) => (b?.length || 0) - (a?.length || 0))
        .map((t) => (t as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

      if (titles.length > 0) {
        return new RegExp(`(@(?:${titles.join('|')}|[a-zA-Z0-9_\\-./]+))`, 'gi')
      }
      return /(@[a-zA-Z0-9_\-./]+)/g
    }, [items])

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
            <div className="chat-msg-list" style={{ width: '100%', padding: '8px 12px' }}>
              {chatMessages.map((msg: any, i: number) => (
                <ChatMessageRow
                  key={msg.id || i}
                  msg={msg}
                  index={i}
                  isLast={i === chatMessages.length - 1}
                  isChatLoading={isChatLoading}
                  userMentionRegex={userMentionRegex}
                  handleCopy={handleCopy}
                  handleRating={handleRating}
                />
              ))}
            </div>
          )}
        </div>
      ),
      [chatMessages, isChatLoading, userMentionRegex, handleCopy, handleRating]
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
                type="button"
                className={`palette-header-btn ${mode === 'search' ? 'active' : ''}`}
                onClick={() => {
                  setMode('search')
                  updateSetting('commandPaletteMode', 'search')
                }}
              >
                Search
              </button>
              <button
                type="button"
                className={`palette-header-btn ${mode === 'ai' ? 'active' : ''}`}
                onClick={() => {
                  setMode('ai')
                  updateSetting('commandPaletteMode', 'ai')
                }}
              >
                Ask AI
              </button>
              {mode === 'ai' && isChatLoading && (
                <button type="button" className="palette-header-btn danger" onClick={cancelChat}>
                  <Square size={10} fill="currentColor" /> Stop
                </button>
              )}
              {mode === 'ai' && chatMessages && chatMessages.length > 0 && (
                <button
                  type="button"
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
                          ref={(el) => { itemRefs.current[index] = el }}
                        />
                      ))
                    ) : (
                      <div className="palette-zero-results">
                        <Search size={24} style={{ opacity: 0.3 }} />
                        <span>No matching notes found for "{query}"</span>
                        {query.trim().length > 0 && (
                          <button
                            type="button"
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
                  {previewContent ? (
                    <PreviewCommandPalette
                      content={previewContent}
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
