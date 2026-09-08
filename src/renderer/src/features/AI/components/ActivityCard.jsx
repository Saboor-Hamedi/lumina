import React, { useState, useMemo } from 'react'
import {
  Folder,
  FileText,
  Edit3,
  RefreshCw,
  Trash2,
  Check,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { openNoteInEditor } from './ChatLink'
import { LuminaTimer } from './luminaTimer.jsx'

export const ActivityCard = React.memo(({ rawContent, isStreaming = false }) => {
  const [isExpanded, setIsExpanded] = useState(isStreaming)
  const prevStreamingRef = React.useRef(isStreaming)

  React.useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      setIsExpanded(false)
    } else if (!prevStreamingRef.current && isStreaming) {
      setIsExpanded(true)
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming])

  const items = useMemo(() => {
    if (!rawContent) return []
    const lines = rawContent.split('\n').map((l) => l.trim()).filter(Boolean)
    const parsed = []
    const seen = new Set()

    for (const line of lines) {
      let added = 0
      let removed = 0
      const diffMatch = line.match(/\(\+([0-9]+)(?:,\s*-([0-9]+))?\)/)
      const singleMinusMatch = line.match(/\(-([0-9]+)\)/)
      if (diffMatch) {
        added = parseInt(diffMatch[1], 10) || 0
        removed = parseInt(diffMatch[2], 10) || 0
      } else if (singleMinusMatch) {
        removed = parseInt(singleMinusMatch[1], 10) || 0
      }
      if (line.includes('*Creating folder') || line.includes('📁 *Creating')) {
        const m = line.match(/`([^`]+)`/)
        const target = m ? m[1] : '...'
        parsed.push({ type: 'folder', target, isActive: true })
        continue
      }
      if (line.includes('*Moving folder') || line.includes('📁 *Moving folder')) {
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
      if (line.includes('*Analyzing') || line.includes('📄 *Analyzing') || line.includes('*Reading') || line.includes('📄 *Reading')) {
        const m = line.match(/`([^`]+)`/)
        const target = m ? m[1] : 'note'
        parsed.push({
          type: 'file',
          target,
          action: 'read',
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

      if (line.toLowerCase().includes('moved folder')) {
        let clean = line
          .replace(/^[-*•\s📁]+/, '')
          .replace(/moved folder/i, '')
          .replace(/[`*]/g, '')
          .replace(/\.$/, '')
          .trim()
        if (clean && !seen.has(`folder:${clean}`)) {
          seen.add(`folder:${clean}`)
          parsed.push({
            type: 'folder',
            target: clean,
            rawText: line.replace(/^[-*•\s📁]+/, ''),
            action: 'move',
            isActive: false
          })
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
          parsed.push({
            type: 'folder',
            target: `Renamed to ${clean.split(' to ').pop() || clean}`,
            rawText: line.replace(/^[-*•\s📁]+/, ''),
            action: 'rename',
            isActive: false
          })
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
          parsed.push({
            type: 'file',
            target: newPart,
            rawText: line.replace(/^[-*•\s📝]+/, ''),
            action: 'rename',
            isActive: false
          })
        }
        continue
      }

      if (line.toLowerCase().includes('read') || line.toLowerCase().includes('analyzed')) {
        let clean = line
          .replace(/^[-*•\s📄]+/, '')
          .replace(/(?:read|analyzed)\s+/i, '')
          .replace(/[`*]/g, '')
          .replace(/\.$/, '')
          .trim()
        if (clean && !seen.has(`file:read:${clean}`)) {
          seen.add(`file:read:${clean}`)
          parsed.push({
            type: 'file',
            target: clean,
            rawText: `Analyzed '${clean}'`,
            action: 'read',
            isActive: false
          })
          continue
        }
      }

      if (
        line.toLowerCase().includes('updated') ||
        line.toLowerCase().includes('appended') ||
        line.toLowerCase().includes('inserted') ||
        line.includes('✏️') ||
        line.includes('✍️')
      ) {
        let title = ''
        const wikiMatch = line.match(/\[\[(.*?)\]\]/)
        const boldMatch = line.match(/\*\*([^*]+)\*\*/)
        if (wikiMatch) {
          title = wikiMatch[1].trim()
        } else if (boldMatch) {
          title = boldMatch[1].trim()
        } else {
          const m = line.match(/(?:updated|appended to|inserted into)\s+`?([^`(\n]+)`?/i)
          if (m) title = m[1].trim()
        }
        if (title && !seen.has(`file:update:${title}`)) {
          seen.add(`file:update:${title}`)
          parsed.push({
            type: 'file',
            target: title,
            action: 'update',
            added,
            removed,
            isActive: false
          })
          continue
        }
      }

      if (
        line.toLowerCase().includes('deleted') ||
        line.toLowerCase().includes('cleared') ||
        line.includes('🗑️') ||
        line.includes('🧹')
      ) {
        let title = ''
        const wikiMatch = line.match(/\[\[(.*?)\]\]/)
        const boldMatch = line.match(/\*\*([^*]+)\*\*/)
        if (wikiMatch) {
          title = wikiMatch[1].trim()
        } else if (boldMatch) {
          title = boldMatch[1].trim()
        } else {
          const m = line.match(/(?:deleted|cleared)(?:\s+note)?\s+`?([^`(\n]+)`?/i)
          if (m) title = m[1].trim()
        }
        if (title && !seen.has(`file:delete:${title}`)) {
          seen.add(`file:delete:${title}`)
          parsed.push({
            type: 'file',
            target: title,
            action: 'delete',
            added,
            removed,
            isActive: false
          })
          continue
        }
      }

      if (line.toLowerCase().includes('created') || line.toLowerCase().includes('drafting')) {
        let title = ''
        let folder = ''

        const wikiLinkMdMatch = line.match(/\[([^\]]+)\]\((?:wikilink:[^)]+|https?:[^)]+)\)/)
        const wikiMatch = line.match(/\[\[(.*?)\]\]/)
        if (wikiLinkMdMatch) {
          title = wikiLinkMdMatch[1].trim()
        } else if (wikiMatch) {
          title = wikiMatch[1].trim()
        } else {
          const boldMatch = line.match(/\*\*([^*]+)\*\*/)
          if (boldMatch) {
            title = boldMatch[1].trim()
          } else {
            const createdMatch = line.match(
              /created\s+(?:note\s+)?([^"in`]+?)(?:\s+in\s+folder|\s+in\s+`|\s+in\s+"|$)/i
            )
            if (createdMatch) {
              title = createdMatch[1].trim()
            }
          }
        }

        const folderMatch = line.match(
          /in\s+(?:folder\s+)?(?:`|"|')?([^`"'\n]+?)(?:`|"|')?(?:\s+covering|$|\.)/i
        )
        if (folderMatch) {
          folder = folderMatch[1].trim().replace(/^[/\\]+|[/\\]+$/g, '')
        }

        if (title && !seen.has(`file:${title}`)) {
          seen.add(`file:${title}`)
          parsed.push({
            type: 'file',
            target: title,
            folder: folder || null,
            action: 'create',
            added,
            removed,
            isActive: false
          })
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
          added,
          removed,
          isActive: false
        })
      }
    }

    return parsed
  }, [rawContent])

  if (items.length === 0) return null

  const folderCount = items.filter((i) => i.type === 'folder' && !i.isActive).length
  const fileCount = items.filter((i) => i.type === 'file' && i.action === 'create' && !i.isActive).length
  const updateCount = items.filter((i) => i.action === 'update' && !i.isActive).length
  const deleteCount = items.filter((i) => i.action === 'delete' && !i.isActive).length
  const renameCount = items.filter((i) => i.action === 'rename').length
  const readCount = items.filter((i) => i.action === 'read' && !i.isActive).length
  const totalAdded = items.reduce((acc, i) => acc + (i.added || 0), 0)
  const totalRemoved = items.reduce((acc, i) => acc + (i.removed || 0), 0)
  const hasActive = items.some((i) => i.isActive) || isStreaming

  let headerTitle = 'Workspace Actions'
  if (hasActive) {
    const activeItem = items.find((i) => i.isActive)
    if (activeItem?.action === 'read') {
      headerTitle = `Analyzing '${activeItem.target}'...`
    } else {
      headerTitle = 'Working...'
    }
  } else if (renameCount > 0 && renameCount === items.length) {
    headerTitle = `Renamed ${renameCount} ${renameCount === 1 ? 'item' : 'items'}`
  } else if (folderCount > 0 && fileCount > 0) {
    headerTitle = `Created ${folderCount} ${folderCount === 1 ? 'folder' : 'folders'} & ${fileCount} ${fileCount === 1 ? 'note' : 'notes'}`
  } else if (folderCount > 0 && updateCount > 0) {
    headerTitle = `Created ${folderCount} ${folderCount === 1 ? 'folder' : 'folders'} & updated ${updateCount} ${updateCount === 1 ? 'note' : 'notes'}`
  } else if (folderCount > 0) {
    headerTitle = `Created ${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`
  } else if (fileCount > 0 && updateCount > 0) {
    headerTitle = `Created ${fileCount} & updated ${updateCount} notes`
  } else if (fileCount > 0) {
    headerTitle = `Created ${fileCount} ${fileCount === 1 ? 'note' : 'notes'}`
  } else if (updateCount > 0) {
    headerTitle = `Updated ${updateCount} ${updateCount === 1 ? 'note' : 'notes'}`
  } else if (deleteCount > 0) {
    headerTitle = `Deleted ${deleteCount} ${deleteCount === 1 ? 'note' : 'notes'}`
  } else if (readCount > 0) {
    headerTitle = `Analyzed ${readCount} ${readCount === 1 ? 'note' : 'notes'}`
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
          {!hasActive && (totalAdded > 0 || totalRemoved > 0) && (
            <span className="lumina-activity-diff-totals">
              {totalAdded > 0 && (
                <span className="lumina-diff-pill added">+{totalAdded}</span>
              )}
              {totalRemoved > 0 && (
                <span className="lumina-diff-pill removed">-{totalRemoved}</span>
              )}
            </span>
          )}
          {!hasActive && items.length > 0 && (
            <span className="lumina-activity-stats">({items.length})</span>
          )}
        </div>
        <div className="lumina-activity-controls">
          {hasActive ? (
            <span className="lumina-activity-badge streaming">
              <LuminaTimer isRunning={hasActive} />
            </span>
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
                  ) : item.action === 'delete' ? (
                    <Trash2 size={11} style={{ color: '#ef4444' }} />
                  ) : item.type === 'folder' ? (
                    <Folder size={12} style={{ color: 'var(--text-accent, #40bafa)' }} />
                  ) : item.action === 'update' ? (
                    <Edit3 size={11} style={{ color: 'var(--text-accent, #40bafa)' }} />
                  ) : item.type === 'file' ? (
                    <FileText size={12} style={{ color: 'var(--text-normal)' }} />
                  ) : (
                    <Edit3 size={11} style={{ color: 'var(--text-muted)' }} />
                  )}
                </span>
                {item.action === 'read' && !item.isActive ? (
                  <span className="lumina-activity-item-title">
                    Analyzed{' '}
                    <span
                      className="lumina-activity-item-link"
                      onClick={(e) => {
                        e.stopPropagation()
                        openNoteInEditor(item.target)
                      }}
                      title={`Click to open ${item.target} in editor`}
                    >
                      '{item.target}'
                    </span>
                  </span>
                ) : item.action === 'read' && item.isActive ? (
                  <span className="lumina-activity-item-title">
                    Analyzing '{item.target}'...
                  </span>
                ) : item.type === 'file' && item.isActive ? (
                  <span className="lumina-activity-item-title">
                    Drafting '{item.target}'...
                  </span>
                ) : item.type === 'folder' && item.isActive ? (
                  <span className="lumina-activity-item-title">
                    Creating folder '{item.target}'...
                  </span>
                ) : item.rawText ? (
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
              <div className="lumina-activity-item-right">
                {item.folder && (
                  <span className="lumina-activity-folder-tag" title={item.folder}>
                    <Folder size={9} /> {item.folder}
                  </span>
                )}
                {(item.added > 0 || item.removed > 0) && (
                  <div className="lumina-activity-item-diff">
                    {item.added > 0 && (
                      <span className="lumina-diff-badge added">+{item.added}</span>
                    )}
                    {item.removed > 0 && (
                      <span className="lumina-diff-badge removed">-{item.removed}</span>
                    )}
                  </div>
                )}
                <div className="lumina-activity-status-check">
                  {item.isActive ? (
                    <span className="thinking-dot-pulse" style={{ width: 5, height: 5 }} />
                  ) : (
                    <Check size={11} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

export default ActivityCard
