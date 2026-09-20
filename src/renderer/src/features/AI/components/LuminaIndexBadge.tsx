import React, { useState, useMemo } from 'react'
import {
  ListFilter,
  ChevronDown,
  ChevronRight,
  Folder,
  FileText,
  Tag,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  ExternalLink
} from 'lucide-react'
import { openNoteInEditor } from './LuminaChatLink'
import type { IndexQueryResult, IndexedNoteRecord } from '../tools/luminaQueryIndex'
import '../css/indexBadge.css'

export interface LuminaIndexBadgeProps {
  content?: string
  isStreaming?: boolean
}

export const LuminaIndexBadge: React.FC<LuminaIndexBadgeProps> = React.memo(
  ({ content = '', isStreaming = false }) => {
    const [isExpanded, setIsExpanded] = useState<boolean>(false)

    const data: IndexQueryResult = useMemo(() => {
      if (!content) return { totalWorkspaceNotes: 0, totalMatched: 0, filters: {}, notes: [], foldersRepresented: [], isQuerying: isStreaming }
      const clean = content.trim()
      try {
        const markerMatch = clean.match(/<<<LUMINA_INDEX_QUERY:\s*([\s\S]*?)\s*>>>/)
        if (markerMatch) {
          const parsed = JSON.parse(markerMatch[1])
          return {
            totalWorkspaceNotes: parsed.totalWorkspaceNotes ?? 0,
            totalMatched: parsed.totalMatched ?? (parsed.notes ? parsed.notes.length : 0),
            filters: parsed.filters ?? {},
            notes: Array.isArray(parsed.notes) ? parsed.notes : [],
            foldersRepresented: parsed.foldersRepresented ?? [],
            isQuerying: isStreaming || Boolean(parsed.isQuerying)
          }
        }
        if (clean.startsWith('{') && clean.endsWith('}')) {
          const parsed = JSON.parse(clean)
          return {
            totalWorkspaceNotes: parsed.totalWorkspaceNotes ?? 0,
            totalMatched: parsed.totalMatched ?? (parsed.notes ? parsed.notes.length : 0),
            filters: parsed.filters ?? {},
            notes: Array.isArray(parsed.notes) ? parsed.notes : [],
            foldersRepresented: parsed.foldersRepresented ?? [],
            isQuerying: isStreaming || Boolean(parsed.isQuerying)
          }
        }
      } catch (_) {}

      // Fallback: Parse count and table rows from markdown summary table
      const matchFound = clean.match(/Found\s+\*?\*?(\d+)\*?\*?\s+matching notes/i)
      const matchTotal = clean.match(/out of\s+(\d+)\s+total/i)
      const countMatched = matchFound ? parseInt(matchFound[1], 10) : 0
      const countTotal = matchTotal ? parseInt(matchTotal[1], 10) : 0

      const parsedTableNotes: IndexedNoteRecord[] = []
      const lines = clean.split('\n')
      for (const line of lines) {
        const rowMatch = line.match(/^\|\s*\[\[([^\]]+)\]\]\s*\|\s*`?([^`|]*)`?\s*\|\s*([^|]*)\|\s*(\d*)\s*\|\s*(\d*)/i)
        if (rowMatch) {
          const title = rowMatch[1].trim()
          const folder = rowMatch[2].trim() || 'root'
          const rawTags = rowMatch[3].trim()
          const tags = rawTags === '—' ? [] : rawTags.split(/\s+/).map((t) => t.replace(/^#/, '').trim()).filter(Boolean)
          const outCount = parseInt(rowMatch[4], 10) || 0
          const inCount = parseInt(rowMatch[5], 10) || 0
          parsedTableNotes.push({
            id: title,
            title,
            fileName: `${title}.md`,
            folder,
            tags,
            outgoingLinks: new Array(outCount).fill(''),
            backlinksCount: inCount,
            headings: [],
            frontmatter: {},
            contentSnippet: '',
            size: 0,
            wordCount: 0
          })
        }
      }

      return {
        totalWorkspaceNotes: countTotal || parsedTableNotes.length,
        totalMatched: countMatched || parsedTableNotes.length,
        filters: {},
        notes: parsedTableNotes,
        foldersRepresented: [],
        isQuerying: isStreaming
      }
    }, [content, isStreaming])

    const isQuerying = Boolean(data.isQuerying)
    const activeFiltersList = useMemo(() => {
      const list: Array<{ label: string; value: string }> = []
      const f = data.filters || {}
      if (f.folder) list.push({ label: 'folder', value: String(f.folder) })
      if (f.tag) list.push({ label: 'tag', value: `#${String(f.tag).replace(/^#/, '')}` })
      if (f.linksTo) list.push({ label: 'linksTo', value: `[[${f.linksTo}]]` })
      if (f.backlinksFor) list.push({ label: 'backlinksFor', value: `[[${f.backlinksFor}]]` })
      if (f.query) list.push({ label: 'query', value: `"${f.query}"` })
      if (f.hasFrontmatter) list.push({ label: 'frontmatter', value: String(f.hasFrontmatter) })
      return list
    }, [data.filters])

    return (
      <div className={`lumina-index-card ${isQuerying ? 'querying' : 'complete'} ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
        <div
          className="lumina-index-header"
          onClick={() => !isQuerying && setIsExpanded((prev) => !prev)}
        >
          <div className="lumina-index-title-group">
            <ListFilter size={12} className={`lumina-index-icon ${isQuerying ? 'spinning-radar' : ''}`} />
            <span className="lumina-index-main-title">
              {isQuerying ? 'Querying Workspace Index...' : 'Workspace Index Query'}
            </span>
            <span className="lumina-index-stats">
              {isQuerying ? (
                <span className="lumina-index-pulse-dot" />
              ) : (
                <>
                  <span><strong>{data.totalMatched}</strong> notes matched</span>
                  {data.totalWorkspaceNotes > 0 && ` · ${data.totalWorkspaceNotes} total`}
                  {activeFiltersList.length > 0 && (
                    <span className="lumina-index-header-filters">
                      {activeFiltersList.map((f, i) => (
                        <span key={i} className="lumina-index-filter-pill">
                          {f.value}
                        </span>
                      ))}
                    </span>
                  )}
                </>
              )}
            </span>
          </div>

          <div className="lumina-index-controls">
            {isQuerying ? (
              <span className="lumina-index-scanner-track">
                <span className="lumina-index-scanner-beam" />
              </span>
            ) : (
              <span className="lumina-index-chevron">
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            )}
          </div>
        </div>

        {isExpanded && !isQuerying && (
          <div className="lumina-index-body seamless-scrollbar">
            {activeFiltersList.length > 0 && (
              <div className="lumina-index-body-filters">
                <span className="filters-label">Active Filters:</span>
                {activeFiltersList.map((f, i) => (
                  <span key={i} className="lumina-index-body-pill">
                    <span className="filter-key">{f.label}:</span> {f.value}
                  </span>
                ))}
              </div>
            )}
            {data.notes && data.notes.length > 0 ? (
              <div className="lumina-index-notes-list">
                {data.notes.map((note: IndexedNoteRecord, idx: number) => {
                  if (!note) return null
                  const noteTitle = note.title || 'Untitled'
                  const noteFolder = note.folder || 'root'
                  const noteTags = Array.isArray(note.tags) ? note.tags : []
                  const noteOutgoing = Array.isArray(note.outgoingLinks) ? note.outgoingLinks : []
                  const noteBacklinks = typeof note.backlinksCount === 'number' ? note.backlinksCount : 0

                  return (
                    <div
                      key={note.id || `${noteTitle}-${idx}`}
                      className="lumina-index-note-row"
                      onClick={() => openNoteInEditor(noteTitle)}
                    >
                      <div className="lumina-index-note-left">
                        <FileText size={12} className="lumina-index-note-icon" />
                        <span className="lumina-index-note-title" title={`Open ${noteTitle}`}>
                          {noteTitle}
                        </span>
                        <span className="lumina-index-note-folder">
                          <Folder size={10} className="folder-icon-tiny" />
                          {noteFolder}
                        </span>
                      </div>

                      <div className="lumina-index-note-right">
                        {noteTags.length > 0 && (
                          <div className="lumina-index-note-tags">
                            {noteTags.slice(0, 2).map((t, ti) => (
                              <span key={ti} className="lumina-index-mini-tag">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}

                        <div
                          className="lumina-index-conn-counters"
                          title="Outgoing links / Incoming backlinks"
                        >
                          <span className="conn-stat out">
                            <ArrowUpRight size={10} />
                            {noteOutgoing.length}
                          </span>
                          <span className="conn-stat in">
                            <ArrowDownLeft size={10} />
                            {noteBacklinks}
                          </span>
                        </div>

                        <ExternalLink size={11} className="open-note-hover-icon" />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="lumina-index-empty-msg">
                {data.totalMatched === 0 ? 'No notes matched active query.' : 'Workspace note records indexed.'}
              </div>
            )}

            {data.totalMatched > (data.notes?.length || 0) && (
              <div className="lumina-index-more-footer">
                +{data.totalMatched - (data.notes?.length || 0)} additional notes matched query
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)

export default LuminaIndexBadge
