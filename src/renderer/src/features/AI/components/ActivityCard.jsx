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
  ChevronRight,
  Eye
} from 'lucide-react'
import { openNoteInEditor } from './ChatLink'
import { LuminaTimer } from './luminaTimer.jsx'

export const ActivityCard = React.memo(({ rawContent, isStreaming = false }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const items = useMemo(() => {
    if (!rawContent) return []
    const lines = rawContent.split('\n').map((l) => l.trim()).filter(Boolean)
    const parsed = []
    const seen = new Set()

    for (const line of lines) {
      let added = 0
      let removed = 0
      let cleanLine = line
      const diffMatch = cleanLine.match(/\(\+([0-9]+)(?:,\s*-([0-9]+))?\)/) || cleanLine.match(/\(-([0-9]+)\)/)
      if (diffMatch) {
        if (diffMatch[0].startsWith('(-')) {
          removed = parseInt(diffMatch[1], 10) || 0
        } else {
          added = parseInt(diffMatch[1], 10) || 0
          removed = parseInt(diffMatch[2], 10) || 0
        }
        cleanLine = cleanLine.replace(diffMatch[0], '').trim()
      }

      const extractTarget = (str) => {
        const m =
          str.match(/\[\[(.*?)\]\]/) ||
          str.match(/[`"']([^`"']+)['"`]/) ||
          str.match(/\*\*([^*]+)\*\*/)
        return m ? m[1].trim() : null
      }

      const extractFolder = (str) => {
        const m =
          str.match(/(?:in\s+(?:folder\s+)?|to\s+(?:folder\s+)?)(?:[`"'])([^`"']+)(?:[`"'])/i) ||
          str.match(/(?:in|to)\s+folder\s+([a-zA-Z0-9_\-/\\]+)/i)
        return m ? m[1].trim().replace(/^[/\\]+|[/\\]+$/g, '') : null
      }

      const folder = extractFolder(cleanLine)

      // Active status lines during streaming
      if (cleanLine.includes('*Creating folder') || cleanLine.includes('📁 *Creating')) {
        const target = extractTarget(cleanLine) || 'folder'
        parsed.push({ type: 'folder', target, action: 'create', isActive: isStreaming })
        continue
      }
      if (cleanLine.includes('*Moving folder') || cleanLine.includes('📁 *Moving folder')) {
        const target = extractTarget(cleanLine) || 'folder'
        parsed.push({ type: 'folder', target, action: 'move', isActive: isStreaming })
        continue
      }
      if (cleanLine.includes('*Drafting') || cleanLine.includes('📝 *Drafting')) {
        const target = extractTarget(cleanLine) || 'note'
        parsed.push({ type: 'file', target, folder, action: 'create', isActive: isStreaming })
        continue
      }
      if (cleanLine.includes('*Writing content to') || cleanLine.includes('✍️ *Writing')) {
        const target = extractTarget(cleanLine) || 'note'
        parsed.push({ type: 'file', target, folder, action: 'update', isActive: isStreaming })
        continue
      }
      if (cleanLine.includes('*Updating') || cleanLine.includes('✏️ *Updating')) {
        const target = extractTarget(cleanLine) || 'note'
        parsed.push({ type: 'file', target, folder, action: 'update', isActive: isStreaming })
        continue
      }
      if (cleanLine.includes('*Analyzing') || cleanLine.includes('*Reading') || cleanLine.includes('📄 *Reading')) {
        const target = extractTarget(cleanLine) || 'note'
        parsed.push({ type: 'file', target, action: 'read', isActive: isStreaming })
        continue
      }

      // Completed lines
      if (cleanLine.toLowerCase().includes('created folder')) {
        const target = extractTarget(cleanLine) || cleanLine.replace(/^[-*•\s📁]+/, '').replace(/created folder/i, '').replace(/[`*]/g, '').trim()
        if (target && !seen.has(`folder:${target}`)) {
          seen.add(`folder:${target}`)
          parsed.push({ type: 'folder', target, action: 'create', isActive: false })
        }
        continue
      }

      if (cleanLine.toLowerCase().includes('moved folder')) {
        const target = extractTarget(cleanLine) || cleanLine.replace(/^[-*•\s📁]+/, '').replace(/moved folder/i, '').replace(/[`*]/g, '').trim()
        if (target && !seen.has(`folder:${target}`)) {
          seen.add(`folder:${target}`)
          parsed.push({ type: 'folder', target, action: 'move', isActive: false })
        }
        continue
      }

      if (cleanLine.toLowerCase().includes('renamed folder')) {
        const target = extractTarget(cleanLine) || cleanLine.replace(/^[-*•\s📁]+/, '').replace(/renamed folder/i, '').replace(/[`*]/g, '').trim()
        if (target && !seen.has(`folder:${target}`)) {
          seen.add(`folder:${target}`)
          parsed.push({ type: 'folder', target, action: 'rename', isActive: false })
        }
        continue
      }

      if (cleanLine.toLowerCase().includes('renamed note') || cleanLine.toLowerCase().includes('renamed file')) {
        const target = extractTarget(cleanLine) || cleanLine.replace(/^[-*•\s📝]+/, '').replace(/renamed (?:note|file)/i, '').replace(/[`*]/g, '').trim()
        if (target && !seen.has(`file:${target}`)) {
          seen.add(`file:${target}`)
          parsed.push({ type: 'file', target, action: 'rename', isActive: false })
        }
        continue
      }

      if (
        cleanLine.toLowerCase().includes('updated') ||
        cleanLine.toLowerCase().includes('appended') ||
        cleanLine.toLowerCase().includes('inserted') ||
        cleanLine.includes('✏️') ||
        cleanLine.includes('✍️')
      ) {
        const target = extractTarget(cleanLine)
        if (target && !seen.has(`file:update:${target}`)) {
          seen.add(`file:update:${target}`)
          parsed.push({ type: 'file', target, folder, action: 'update', added, removed, isActive: false })
          continue
        }
      }

      if (
        cleanLine.toLowerCase().includes('deleted') ||
        cleanLine.toLowerCase().includes('cleared') ||
        cleanLine.includes('🗑️') ||
        cleanLine.includes('🧹')
      ) {
        const target = extractTarget(cleanLine)
        if (target && !seen.has(`file:delete:${target}`)) {
          seen.add(`file:delete:${target}`)
          parsed.push({ type: 'file', target, action: 'delete', added, removed, isActive: false })
          continue
        }
      }

      if (cleanLine.toLowerCase().includes('created') || cleanLine.toLowerCase().includes('drafting')) {
        const target = extractTarget(cleanLine)
        if (target && !seen.has(`file:create:${target}`)) {
          seen.add(`file:create:${target}`)
          parsed.push({ type: 'file', target, folder, action: 'create', added, removed, isActive: false })
          continue
        }
      }
    }

    // Deduplicate: If an item has both an in-progress version and a completed version, discard the in-progress one
    const finalItems = []
    const completedKeys = new Set(
      parsed.filter((p) => !p.isActive).map((p) => `${p.type}:${p.target}`)
    )

    for (const p of parsed) {
      const key = `${p.type}:${p.target}`
      if (p.isActive && completedKeys.has(key)) {
        continue
      }
      finalItems.push(p)
    }

    return finalItems
  }, [rawContent, isStreaming])

  const mutationItems = useMemo(() => items.filter((i) => i.action !== 'read'), [items])

  // Build hierarchical folder/file tree (must be called unconditionally before any early return)
  const treeNodes = useMemo(() => {
    const foldersMap = new Map()
    const rootItems = []

    for (const item of mutationItems) {
      if (item.type === 'folder') {
        if (!foldersMap.has(item.target)) {
          foldersMap.set(item.target, { folder: item, children: [] })
        } else {
          foldersMap.get(item.target).folder = item
        }
      }
    }

    for (const item of mutationItems) {
      if (item.type === 'folder') continue

      if (item.folder) {
        if (!foldersMap.has(item.folder)) {
          foldersMap.set(item.folder, {
            folder: {
              type: 'folder',
              target: item.folder,
              action: 'reference',
              isActive: false
            },
            children: []
          })
        }
        foldersMap.get(item.folder).children.push(item)
      } else {
        rootItems.push(item)
      }
    }

    return {
      folderGroups: Array.from(foldersMap.values()),
      rootItems
    }
  }, [mutationItems])

  if (mutationItems.length === 0) {
    return null
  }

  const folderCount = mutationItems.filter((i) => i.type === 'folder' && !i.isActive).length
  const fileCount = mutationItems.filter((i) => i.type === 'file' && i.action === 'create' && !i.isActive).length
  const updateCount = mutationItems.filter((i) => i.action === 'update' && !i.isActive).length
  const deleteCount = mutationItems.filter((i) => i.action === 'delete' && !i.isActive).length
  const renameCount = mutationItems.filter((i) => i.action === 'rename').length
  const totalAdded = mutationItems.reduce((acc, i) => acc + (i.added || 0), 0)
  const totalRemoved = mutationItems.reduce((acc, i) => acc + (i.removed || 0), 0)
  const hasActive = isStreaming && mutationItems.some((i) => i.isActive)

  let headerTitle = 'Working...'
  if (hasActive) {
    const activeItem = mutationItems.find((i) => i.isActive)
    if (activeItem) {
      headerTitle = activeItem.type === 'folder'
        ? `Creating folder '${activeItem.target}'...`
        : `Drafting '${activeItem.target}'...`
    } else {
      headerTitle = 'Working...'
    }
  }

  let completedSummary = ''
  if (folderCount > 0 && fileCount > 0) {
    completedSummary = `${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}, ${fileCount} ${fileCount === 1 ? 'note' : 'notes'}`
  } else if (folderCount > 0 && updateCount > 0) {
    completedSummary = `${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}, updated ${updateCount} ${updateCount === 1 ? 'note' : 'notes'}`
  } else if (folderCount > 0) {
    completedSummary = `Created ${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`
  } else if (fileCount > 0 && updateCount > 0) {
    completedSummary = `Created ${fileCount}, updated ${updateCount} ${updateCount === 1 ? 'note' : 'notes'}`
  } else if (fileCount > 0) {
    completedSummary = `Created ${fileCount} ${fileCount === 1 ? 'note' : 'notes'}`
  } else if (updateCount > 0) {
    completedSummary = `Updated ${updateCount} ${updateCount === 1 ? 'note' : 'notes'}`
  } else if (deleteCount > 0) {
    completedSummary = `Deleted ${deleteCount} ${deleteCount === 1 ? 'note' : 'notes'}`
  } else if (renameCount > 0) {
    completedSummary = `Renamed ${renameCount} ${renameCount === 1 ? 'note' : 'notes'}`
  } else {
    completedSummary = `${mutationItems.length} ${mutationItems.length === 1 ? 'item' : 'items'} updated`
  }

  return (
    <div className={`lumina-activity-card ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="lumina-activity-header" onClick={() => setIsExpanded((prev) => !prev)}>
        <div className="lumina-activity-title-group">
          {hasActive && (
            <div className="lumina-activity-icon-badge">
              <Loader2 size={12} className="lumina-activity-spinner" />
            </div>
          )}
          <span className="lumina-activity-main-title">
            {hasActive ? headerTitle : completedSummary}
          </span>
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
          <span className="lumina-activity-chevron-inline">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        </div>
        <div className="lumina-activity-controls">
          {hasActive ? (
            <span className="lumina-activity-badge streaming">
              <LuminaTimer isRunning={hasActive} />
            </span>
          ) : (
            <button
              type="button"
              className="lumina-activity-review-btn"
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded((prev) => !prev)
              }}
            >
              <Eye size={11} />
              <span>Review</span>
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="lumina-activity-body">
          {/* Folders and their nested children */}
          {treeNodes.folderGroups.map(({ folder, children }, gIdx) => (
            <div key={`fg-${gIdx}`} className="lumina-activity-folder-group">
              <div className="lumina-activity-folder-row">
                <div className="lumina-activity-folder-title">
                  <Folder size={12} className="lumina-folder-icon" />
                  <span className="lumina-folder-name">{folder.target}</span>
                  <span className="lumina-folder-slash">/</span>
                </div>
                <div className="lumina-activity-item-right">
                  <div className="lumina-activity-status-check">
                    {folder.isActive && isStreaming ? (
                      <span className="thinking-dot-pulse" style={{ width: 5, height: 5 }} />
                    ) : (
                      <Check size={11} />
                    )}
                  </div>
                </div>
              </div>

              {children.length > 0 && (
                <div className="lumina-activity-folder-children">
                  {children.map((child, cIdx) => (
                    <div key={`c-${cIdx}`} className="lumina-activity-item is-child-file">
                      <div className="lumina-activity-item-left">
                        <span className="lumina-activity-item-icon">
                          {child.action === 'rename' ? (
                            <RefreshCw size={11} style={{ color: 'var(--text-accent, #40bafa)' }} />
                          ) : child.action === 'delete' ? (
                            <Trash2 size={11} style={{ color: '#ef4444' }} />
                          ) : (
                            <FileText size={11} className="lumina-file-icon" />
                          )}
                        </span>
                        {child.isActive && isStreaming ? (
                          <span className="lumina-activity-item-title">
                            Drafting '{child.target}'...
                          </span>
                        ) : (
                          <span
                            className="lumina-activity-item-link"
                            onClick={(e) => {
                              e.stopPropagation()
                              openNoteInEditor(child.target)
                            }}
                            title={`Click to open ${child.target} in editor`}
                          >
                            {child.target}
                          </span>
                        )}
                      </div>
                      <div className="lumina-activity-item-right">
                        {(child.added > 0 || child.removed > 0) && (
                          <div className="lumina-activity-item-diff">
                            {child.added > 0 && (
                              <span className="lumina-diff-badge added">+{child.added}</span>
                            )}
                            {child.removed > 0 && (
                              <span className="lumina-diff-badge removed">-{child.removed}</span>
                            )}
                          </div>
                        )}
                        <div className="lumina-activity-status-check">
                          {child.isActive && isStreaming ? (
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
          ))}

          {/* Root files */}
          {treeNodes.rootItems.map((item, rIdx) => (
            <div key={`root-${rIdx}`} className="lumina-activity-item is-root-file">
              <div className="lumina-activity-item-left">
                <span className="lumina-activity-item-icon">
                  {item.action === 'rename' ? (
                    <RefreshCw size={11} style={{ color: 'var(--text-accent, #40bafa)' }} />
                  ) : item.action === 'delete' ? (
                    <Trash2 size={11} style={{ color: '#ef4444' }} />
                  ) : item.type === 'folder' ? (
                    <Folder size={11} className="lumina-folder-icon" />
                  ) : (
                    <FileText size={11} className="lumina-file-icon" />
                  )}
                </span>
                {item.isActive && isStreaming ? (
                  <span className="lumina-activity-item-title">
                    Working on '{item.target}'...
                  </span>
                ) : item.type === 'folder' ? (
                  <div className="lumina-activity-folder-title">
                    <span className="lumina-folder-name">{item.target}</span>
                    <span className="lumina-folder-slash">/</span>
                  </div>
                ) : (
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
                )}
              </div>
              <div className="lumina-activity-item-right">
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
                  {item.isActive && isStreaming ? (
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
