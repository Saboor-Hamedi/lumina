import React, { useState, useMemo } from 'react'
import {
  FolderTree,
  Folder,
  RefreshCw,
  Trash2,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { openNoteInEditor } from './LuminaChatLink'
import { getEntityIconForTarget } from './LuminaEntityMention'
import { LuminaTimer } from './LuminaTimer'
import { parseActivityItems, buildActivityTree } from '../services/activityParser'
import '../css/folderTree.css'

export interface ActivityCardProps {
  rawContent: string
  isStreaming?: boolean
}

/**
 * ActivityCard renders atomic workspace tool mutations (<lumina-activity>)
 * using the unified LuminaFolderTree visual card with branch lines, folder/file icons, and diff counters.
 */
export const ActivityCard: React.FC<ActivityCardProps> = React.memo(({ rawContent, isStreaming = false }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true)

  const items = useMemo(() => parseActivityItems(rawContent), [rawContent])
  const mutationItems = useMemo(() => items.filter((i: any) => i.action !== 'read'), [items])
  const treeNodes = useMemo(() => buildActivityTree(mutationItems), [mutationItems])

  if (mutationItems.length === 0) {
    return null
  }

  const folderCount = treeNodes.folderGroups.length + treeNodes.rootItems.filter((i: any) => i.type === 'folder').length
  const fileItems = mutationItems.filter((i: any) => i.type === 'file')
  const fileCount = fileItems.filter((i: any) => i.action === 'create' && !i.isActive).length
  const updateCount = fileItems.filter((i: any) => i.action === 'update' && !i.isActive).length
  const deleteCount = fileItems.filter((i: any) => i.action === 'delete' && !i.isActive).length
  const renameCount = fileItems.filter((i: any) => i.action === 'rename').length
  const hasActive = isStreaming && mutationItems.some((i: any) => i.isActive)

  let headerTitle = 'Working...'
  if (hasActive) {
    const activeItem = mutationItems.find((i: any) => i.isActive)
    if (activeItem) {
      headerTitle = activeItem.type === 'folder'
        ? `Creating folder '${activeItem.target}'...`
        : `Drafting '${activeItem.target}'...`
    } else {
      headerTitle = 'Working...'
    }
  }

  let completedSummary = 'Folder Structure'
  if (folderCount === 0) {
    if (fileCount > 0 && updateCount > 0) {
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
      completedSummary = 'Workspace Activity'
    }
  }

  const statsParts: string[] = []
  if (folderCount > 0) {
    statsParts.push(`${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`)
  }
  if (fileItems.length > 0) {
    statsParts.push(`${fileItems.length} ${fileItems.length === 1 ? 'file' : 'files'}`)
  }

  const totalTopLevel = treeNodes.folderGroups.length + treeNodes.rootItems.length

  const actionTag: Record<string, string> = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    rename: 'Renamed',
    move: 'Moved'
  }

  return (
    <div
      className={`lumina-folder-tree-card lumina-activity-card ${
        isExpanded ? 'is-expanded expanded' : 'is-collapsed collapsed'
      }`}
    >
      <div className="lumina-folder-tree-header" onClick={() => setIsExpanded((prev) => !prev)}>
        <div className="lumina-folder-tree-title-group">
          {hasActive ? (
            <Loader2 size={12} className="lumina-activity-spinner lumina-folder-tree-icon" />
          ) : (
            <FolderTree size={12} className="lumina-folder-tree-icon" />
          )}
          <span className="lumina-folder-tree-main-title">
            {hasActive ? headerTitle : completedSummary}
          </span>
          {statsParts.length > 0 && (
            <span className="lumina-folder-tree-stats">{statsParts.join(' · ')}</span>
          )}
        </div>
        <div className="lumina-folder-tree-controls">
          {hasActive && (
            <span className="lumina-activity-badge streaming">
              <LuminaTimer isRunning={hasActive} />
            </span>
          )}
          <span className="lumina-folder-tree-chevron">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="lumina-folder-tree-body seamless-scrollbar">
          {/* Folders and their nested children */}
          {treeNodes.folderGroups.map(({ folder, children }: any, gIdx: number) => {
            const isLastTopLevel = gIdx === totalTopLevel - 1
            const folderBranch = isLastTopLevel ? '└── ' : '├── '
            const childIndentGuide = isLastTopLevel ? '    ' : '│   '
            const cleanFolderTarget = String(folder.target || '').replace(/\/+$/, '')

            return (
              <React.Fragment key={`fg-${gIdx}`}>
                <div
                  className="lumina-folder-tree-line is-interactive"
                  onClick={() => openNoteInEditor(`folder:${cleanFolderTarget}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="lumina-folder-tree-line-left">
                    <span className="lumina-folder-tree-branch">{folderBranch}</span>
                    <span className="lumina-folder-tree-node-item">
                      <Folder size={11} className="lumina-folder-tree-folder-icon" />
                      <span className="lumina-folder-tree-label is-folder is-clickable">
                        {cleanFolderTarget}/
                      </span>
                    </span>
                  </span>
                  <span className="lumina-folder-tree-line-meta">
                    {folder.action && folder.action !== 'reference' && (
                      <span className={`lumina-folder-tree-action-badge action-${folder.action}d`}>
                        {actionTag[folder.action] || 'Folder'}
                      </span>
                    )}
                    {folder.isActive && isStreaming ? (
                      <span className="thinking-dot-pulse" style={{ width: 5, height: 5 }} />
                    ) : (
                      <Check size={11} style={{ color: '#4ade80', opacity: 0.85 }} />
                    )}
                  </span>
                </div>

                {children.map((child: any, cIdx: number) => {
                  const isLastChild = cIdx === children.length - 1
                  const childBranch = `${childIndentGuide}${isLastChild ? '└── ' : '├── '}`
                  const canOpen = !child.isActive && child.action !== 'delete'

                  return (
                    <div
                      key={`c-${gIdx}-${cIdx}`}
                      className="lumina-folder-tree-line is-interactive"
                      onClick={() => canOpen && openNoteInEditor(child.target, cleanFolderTarget)}
                      style={canOpen ? { cursor: 'pointer' } : undefined}
                    >
                      <span className="lumina-folder-tree-line-left">
                        <span className="lumina-folder-tree-branch">{childBranch}</span>
                        <span className="lumina-folder-tree-node-item">
                          {child.action === 'rename' ? (
                            <RefreshCw size={11} className="lumina-folder-tree-file-icon" />
                          ) : child.action === 'delete' ? (
                            <Trash2 size={11} style={{ color: '#f87171', flexShrink: 0 }} />
                          ) : (
                            <span className="lumina-folder-tree-file-icon-wrap">
                              {getEntityIconForTarget(`${cleanFolderTarget}/${child.target}`, 11)}
                            </span>
                          )}
                          <span
                            className={`lumina-folder-tree-label is-file ${canOpen ? 'is-clickable' : ''}`}
                            title={canOpen ? `Click to open ${child.target} in editor` : undefined}
                          >
                            {child.isActive && isStreaming
                              ? `Drafting '${child.target}'...`
                              : child.target}
                          </span>
                        </span>
                      </span>
                      <span className="lumina-folder-tree-line-meta">
                        {child.action && actionTag[child.action] && (
                          <span className={`lumina-folder-tree-action-badge action-${child.action}d`}>
                            {actionTag[child.action]}
                          </span>
                        )}
                        {(child.added > 0 || child.removed > 0) && (
                          <span className="lumina-folder-tree-diff">
                            {child.added > 0 && (
                              <span className="lumina-folder-tree-diff-added">+{child.added}w</span>
                            )}
                            {child.removed > 0 && (
                              <span className="lumina-folder-tree-diff-removed">−{child.removed}w</span>
                            )}
                          </span>
                        )}
                        {child.isActive && isStreaming ? (
                          <span className="thinking-dot-pulse" style={{ width: 5, height: 5 }} />
                        ) : (
                          <Check size={11} style={{ color: '#4ade80', opacity: 0.85 }} />
                        )}
                      </span>
                    </div>
                  )
                })}
              </React.Fragment>
            )
          })}

          {/* Root files */}
          {treeNodes.rootItems.map((item: any, rIdx: number) => {
            const topIdx = treeNodes.folderGroups.length + rIdx
            const isLastRoot = topIdx === totalTopLevel - 1
            const branch = isLastRoot ? '└── ' : '├── '
            const isFolder = item.type === 'folder'
            const canOpen = !isFolder && !item.isActive && item.action !== 'delete'

            return (
              <div
                key={`root-${rIdx}`}
                className="lumina-folder-tree-line is-interactive"
                onClick={() => canOpen && openNoteInEditor(item.target)}
                style={canOpen ? { cursor: 'pointer' } : undefined}
              >
                <span className="lumina-folder-tree-line-left">
                  <span className="lumina-folder-tree-branch">{branch}</span>
                  <span className="lumina-folder-tree-node-item">
                    {item.action === 'rename' ? (
                      <RefreshCw size={11} className="lumina-folder-tree-file-icon" />
                    ) : item.action === 'delete' ? (
                      <Trash2 size={11} style={{ color: '#f87171', flexShrink: 0 }} />
                    ) : isFolder ? (
                      <Folder size={11} className="lumina-folder-tree-folder-icon" />
                    ) : (
                      <span className="lumina-folder-tree-file-icon-wrap">
                        {getEntityIconForTarget(item.target, 11)}
                      </span>
                    )}
                    <span
                      className={`lumina-folder-tree-label ${
                        isFolder ? 'is-folder' : `is-file ${canOpen ? 'is-clickable' : ''}`
                      }`}
                      title={canOpen ? `Click to open ${item.target} in editor` : undefined}
                    >
                      {item.isActive && isStreaming
                        ? `Drafting '${item.target}'...`
                        : isFolder
                          ? `${String(item.target || '').replace(/\/+$/, '')}/`
                          : item.target}
                    </span>
                  </span>
                </span>
                <span className="lumina-folder-tree-line-meta">
                  {item.action && actionTag[item.action] && (
                    <span className={`lumina-folder-tree-action-badge action-${item.action}d`}>
                      {actionTag[item.action]}
                    </span>
                  )}
                  {(item.added > 0 || item.removed > 0) && (
                    <span className="lumina-folder-tree-diff">
                      {item.added > 0 && (
                        <span className="lumina-folder-tree-diff-added">+{item.added}w</span>
                      )}
                      {item.removed > 0 && (
                        <span className="lumina-folder-tree-diff-removed">−{item.removed}w</span>
                      )}
                    </span>
                  )}
                  {item.isActive && isStreaming ? (
                    <span className="thinking-dot-pulse" style={{ width: 5, height: 5 }} />
                  ) : (
                    <Check size={11} style={{ color: '#4ade80', opacity: 0.85 }} />
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

export const LuminaActivityCard = ActivityCard
export default ActivityCard
