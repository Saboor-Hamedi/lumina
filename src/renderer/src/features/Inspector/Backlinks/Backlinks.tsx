import React, { useState, useMemo, useCallback } from 'react'
import { Link2, Link2Off, ChevronRight, Search, X, FileText } from 'lucide-react'
import { useWorkspaceStore, WorkspaceNote } from '../../../core/store/workspaceStore'
import ToolTip from '../../../components/atoms/ToolTip'
import './Backlinks.css'

export interface MentionItem {
  line: number
  lineText: string
  matchText: string
}

export interface BacklinkSource {
  sourceNote: WorkspaceNote
  mentions: MentionItem[]
}

export interface BacklinksProps {
  note?: {
    id?: string
    title?: string
    fileName?: string
    code?: string
    [key: string]: any
  } | null
  snippet?: any
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const Backlinks: React.FC<BacklinksProps> = React.memo(({ note: propNote, snippet }) => {
  const currentNote = propNote || snippet
  const notes = useWorkspaceStore((state) => state.notes || [])
  const setSelectedNote = useWorkspaceStore((state) => state.setSelectedNote)

  const [filterQuery, setFilterQuery] = useState('')
  const [showLinked, setShowLinked] = useState(true)
  const [showUnlinked, setShowUnlinked] = useState(true)
  const [collapsedNoteIds, setCollapsedNoteIds] = useState<Set<string>>(new Set())

  // Parse linked and unlinked mentions across all notes in the vault
  const { linkedBacklinks, unlinkedBacklinks } = useMemo(() => {
    if (!currentNote || !currentNote.id || !currentNote.title) {
      return { linkedBacklinks: [], unlinkedBacklinks: [] }
    }

    const linked: BacklinkSource[] = []
    const unlinked: BacklinkSource[] = []

    const targetTitle = (currentNote.title || '').trim().toLowerCase()
    const targetId = currentNote.id
    const targetFileName = (currentNote.fileName || '').trim().toLowerCase()
    const targetFileBase = targetFileName.replace(/\.md$/i, '')

    // Wikilink regex: [[Target]] or [[Target#Heading]] or [[Target|Alias]]
    const wikilinkRegex = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g
    // Markdown link regex: [Label](Target)
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g

    // Title match regex for unlinked mentions
    const titleRegex =
      targetTitle.length >= 2
        ? new RegExp(`\\b${escapeRegExp(targetTitle)}\\b`, 'gi')
        : null

    for (const sourceNote of notes) {
      if (!sourceNote || sourceNote.id === currentNote.id) continue

      const content = sourceNote.code || (sourceNote as any).content || ''
      if (!content) continue

      const lines = content.split('\n')
      const noteLinkedMentions: MentionItem[] = []
      const noteUnlinkedMentions: MentionItem[] = []

      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx]
        const lineNum = idx + 1
        let hasLinkedMatchOnLine = false

        // 1. Check Wikilinks
        let match: RegExpExecArray | null
        wikilinkRegex.lastIndex = 0
        while ((match = wikilinkRegex.exec(line)) !== null) {
          const rawTarget = match[1].trim().toLowerCase()
          const isTargetMatch =
            rawTarget === targetTitle ||
            rawTarget === targetId.toLowerCase() ||
            rawTarget === targetFileName ||
            rawTarget === targetFileBase

          if (isTargetMatch) {
            hasLinkedMatchOnLine = true
            noteLinkedMentions.push({
              line: lineNum,
              lineText: line.trim(),
              matchText: match[0]
            })
          }
        }

        // 2. Check Standard Markdown Links
        mdLinkRegex.lastIndex = 0
        while ((match = mdLinkRegex.exec(line)) !== null) {
          const rawTarget = match[2].trim().toLowerCase()
          const isTargetMatch =
            rawTarget === targetId.toLowerCase() ||
            rawTarget === targetTitle ||
            rawTarget === targetFileName ||
            rawTarget === targetFileBase ||
            rawTarget.endsWith(`/${targetFileName}`) ||
            rawTarget.endsWith(`/${targetFileBase}`)

          if (isTargetMatch) {
            hasLinkedMatchOnLine = true
            noteLinkedMentions.push({
              line: lineNum,
              lineText: line.trim(),
              matchText: match[0]
            })
          }
        }

        // 3. Check Unlinked Mentions (only if line has no explicit link)
        if (!hasLinkedMatchOnLine && titleRegex) {
          titleRegex.lastIndex = 0
          const titleMatch = titleRegex.exec(line)
          if (titleMatch) {
            noteUnlinkedMentions.push({
              line: lineNum,
              lineText: line.trim(),
              matchText: titleMatch[0]
            })
          }
        }
      }

      if (noteLinkedMentions.length > 0) {
        linked.push({ sourceNote, mentions: noteLinkedMentions })
      }
      if (noteUnlinkedMentions.length > 0) {
        unlinked.push({ sourceNote, mentions: noteUnlinkedMentions })
      }
    }

    return { linkedBacklinks: linked, unlinkedBacklinks: unlinked }
  }, [currentNote, notes])

  // Filter backlinks by search query
  const filterList = useCallback(
    (list: BacklinkSource[]) => {
      const q = filterQuery.trim().toLowerCase()
      if (!q) return list

      return list
        .map((group) => {
          const titleMatches = (group.sourceNote.title || '').toLowerCase().includes(q)
          const folderMatches = (group.sourceNote.folderId || '').toLowerCase().includes(q)
          const filteredMentions = group.mentions.filter((m) =>
            m.lineText.toLowerCase().includes(q)
          )

          if (titleMatches || folderMatches) {
            return group
          }
          if (filteredMentions.length > 0) {
            return { ...group, mentions: filteredMentions }
          }
          return null
        })
        .filter((g): g is BacklinkSource => g !== null)
    },
    [filterQuery]
  )

  const filteredLinked = useMemo(() => filterList(linkedBacklinks), [filterList, linkedBacklinks])
  const filteredUnlinked = useMemo(() => filterList(unlinkedBacklinks), [filterList, unlinkedBacklinks])

  const totalLinkedMentions = useMemo(
    () => linkedBacklinks.reduce((acc, g) => acc + g.mentions.length, 0),
    [linkedBacklinks]
  )
  const totalUnlinkedMentions = useMemo(
    () => unlinkedBacklinks.reduce((acc, g) => acc + g.mentions.length, 0),
    [unlinkedBacklinks]
  )

  const toggleNoteCollapse = (noteId: string) => {
    setCollapsedNoteIds((prev) => {
      const next = new Set(prev)
      if (next.has(noteId)) {
        next.delete(noteId)
      } else {
        next.add(noteId)
      }
      return next
    })
  }

  const handleNavigateToNote = (sourceNote: WorkspaceNote, line?: number) => {
    setSelectedNote(sourceNote)
    if (typeof line === 'number') {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('editor-scroll-to-line', { detail: { line } })
        )
      }, 50)
    }
  }

  const renderSnippetWithHighlight = (lineText: string, matchText: string) => {
    if (!matchText) return lineText
    const parts = lineText.split(new RegExp(`(${escapeRegExp(matchText)})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === matchText.toLowerCase() ? (
        <mark key={i} className="backlink-match">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  if (!currentNote) {
    return (
      <div className="backlinks-container">
        <div className="backlinks-empty-state">
          <Link2Off size={24} className="backlinks-empty-icon" />
          <span>Select a note to inspect backlinks</span>
        </div>
      </div>
    )
  }

  return (
    <div className="backlinks-container">
      {/* Search Filter Bar */}
      <div className="backlinks-filter-bar">
        <div className="backlinks-search-input-wrap">
          <Search size={12} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="backlinks-search-input"
            placeholder="Filter backlinks..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          {filterQuery && (
            <button
              type="button"
              className="backlinks-action-btn"
              onClick={() => setFilterQuery('')}
              title="Clear search"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="backlinks-scroll-area">
        {/* Linked Mentions Section */}
        <div className="backlinks-section">
          <div
            className="backlinks-section-header"
            onClick={() => setShowLinked((prev) => !prev)}
          >
            <div className="backlinks-section-title-wrap">
              <ChevronRight
                size={13}
                className={`backlinks-section-toggle-icon ${showLinked ? 'expanded' : ''}`}
              />
              <Link2 size={13} style={{ color: 'var(--text-accent)' }} />
              <span>Linked Mentions</span>
            </div>
            <span className="backlinks-count-badge">
              {totalLinkedMentions}
            </span>
          </div>

          {showLinked && (
            <div className="backlinks-groups-list">
              {filteredLinked.length === 0 ? (
                <div className="backlinks-empty-state">
                  <span>
                    {filterQuery ? 'No matching linked mentions' : 'No linked mentions for this note'}
                  </span>
                </div>
              ) : (
                filteredLinked.map(({ sourceNote, mentions }) => {
                  const isCollapsed = collapsedNoteIds.has(sourceNote.id)
                  const folder = sourceNote.folderId && sourceNote.folderId !== 'root' ? sourceNote.folderId : null

                  return (
                    <div key={sourceNote.id} className="backlinks-note-group">
                      <div
                        className="backlinks-note-header"
                        onClick={() => toggleNoteCollapse(sourceNote.id)}
                      >
                        <div className="backlinks-note-title-wrap">
                          <ChevronRight
                            size={12}
                            className={`backlinks-section-toggle-icon ${!isCollapsed ? 'expanded' : ''}`}
                          />
                          <FileText size={12} style={{ color: sourceNote.color || 'var(--text-accent)', flexShrink: 0 }} />
                          <ToolTip text={`Open "${sourceNote.title}" in editor`} position="top" delay={400}>
                            <span
                              className="backlinks-note-title"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleNavigateToNote(sourceNote)
                              }}
                            >
                              {sourceNote.title || 'Untitled'}
                            </span>
                          </ToolTip>
                          {folder && (
                            <span className="backlinks-folder-badge" title={`Folder: ${folder}`}>
                              {folder}
                            </span>
                          )}
                        </div>
                        <div className="backlinks-note-meta">
                          <span className="backlinks-mention-pill">
                            {mentions.length} {mentions.length === 1 ? 'link' : 'links'}
                          </span>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="backlinks-mentions-list">
                          {mentions.map((m, idx) => (
                            <div
                              key={idx}
                              className="backlinks-mention-item"
                              onClick={() => handleNavigateToNote(sourceNote, m.line)}
                              title={`Jump to line ${m.line} in "${sourceNote.title}"`}
                            >
                              <span className="backlinks-line-num">L{m.line}</span>
                              <div className="backlinks-context-snippet">
                                {renderSnippetWithHighlight(m.lineText, m.matchText)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Unlinked Mentions Section */}
        <div className="backlinks-section">
          <div
            className="backlinks-section-header"
            onClick={() => setShowUnlinked((prev) => !prev)}
          >
            <div className="backlinks-section-title-wrap">
              <ChevronRight
                size={13}
                className={`backlinks-section-toggle-icon ${showUnlinked ? 'expanded' : ''}`}
              />
              <Link2Off size={13} style={{ color: '#6B7280' }} />
              <span>Unlinked Mentions</span>
            </div>
            <span className="backlinks-count-badge">
              {totalUnlinkedMentions}
            </span>
          </div>

          {showUnlinked && (
            <div className="backlinks-groups-list">
              {filteredUnlinked.length === 0 ? (
                <div className="backlinks-empty-state">
                  <span>
                    {filterQuery ? 'No matching unlinked mentions' : 'No unlinked mentions found'}
                  </span>
                </div>
              ) : (
                filteredUnlinked.map(({ sourceNote, mentions }) => {
                  const isCollapsed = collapsedNoteIds.has(sourceNote.id)
                  const folder = sourceNote.folderId && sourceNote.folderId !== 'root' ? sourceNote.folderId : null

                  return (
                    <div key={sourceNote.id} className="backlinks-note-group">
                      <div
                        className="backlinks-note-header"
                        onClick={() => toggleNoteCollapse(sourceNote.id)}
                      >
                        <div className="backlinks-note-title-wrap">
                          <ChevronRight
                            size={12}
                            className={`backlinks-section-toggle-icon ${!isCollapsed ? 'expanded' : ''}`}
                          />
                          <FileText size={12} style={{ color: sourceNote.color || 'var(--text-muted)', flexShrink: 0 }} />
                          <ToolTip text={`Open "${sourceNote.title}" in editor`} position="top" delay={400}>
                            <span
                              className="backlinks-note-title"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleNavigateToNote(sourceNote)
                              }}
                            >
                              {sourceNote.title || 'Untitled'}
                            </span>
                          </ToolTip>
                          {folder && (
                            <span className="backlinks-folder-badge" title={`Folder: ${folder}`}>
                              {folder}
                            </span>
                          )}
                        </div>
                        <div className="backlinks-note-meta">
                          <span className="backlinks-mention-pill">
                            {mentions.length} {mentions.length === 1 ? 'mention' : 'mentions'}
                          </span>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="backlinks-mentions-list">
                          {mentions.map((m, idx) => (
                            <div
                              key={idx}
                              className="backlinks-mention-item"
                              onClick={() => handleNavigateToNote(sourceNote, m.line)}
                              title={`Jump to line ${m.line} in "${sourceNote.title}"`}
                            >
                              <span className="backlinks-line-num">L{m.line}</span>
                              <div className="backlinks-context-snippet">
                                {renderSnippetWithHighlight(m.lineText, m.matchText)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

Backlinks.displayName = 'Backlinks'
export default Backlinks
