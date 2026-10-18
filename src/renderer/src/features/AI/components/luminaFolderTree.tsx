import React, { useState, useMemo } from 'react'
import { FolderTree, Folder, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'
import {
  resolveWorkspaceEntity,
  navigateToWorkspaceEntity,
  stripLeadingEntityEmoji,
  type ResolvedWorkspaceEntity
} from '../services/entityResolver'
import { renderResolvedEntityIcon } from './LuminaEntityMention'
import '../css/folderTree.css'

export interface LuminaFolderTreeProps {
  content?: string
  rawCode?: string
  title?: string
}

export interface FolderTreeLineNode {
  indent: string
  branch: string
  label: string
  isFolder: boolean
  raw: string
  entity: ResolvedWorkspaceEntity
}

/**
 * Helper to detect if a text block contains ASCII directory tree lines
 */
export const isAsciiTree = (text?: string): boolean => {
  if (!text || typeof text !== 'string') return false
  const hasTreeChars = /[├└][─-]+|│\s+/.test(text)
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length < 2) return false
  const branchLineCount = lines.filter((l) => /[├└│]/.test(l)).length
  return hasTreeChars && branchLineCount >= 2
}

/**
 * LuminaFolderTree
 * Dedicated, self-contained badge and visual explorer for folder structure trees in chat.
 * Renders theme-aware branch lines, entity-aware icons (folders, notes, PDFs, images, diagrams, code), item counts, and quick copy.
 */
export const LuminaFolderTree: React.FC<LuminaFolderTreeProps> = React.memo(
  ({ content = '', rawCode = '', title = 'Folder Structure' }) => {
    const [isExpanded, setIsExpanded] = useState<boolean>(true)
    const [copied, setCopied] = useState<boolean>(false)

    const fullText = (content || rawCode || '').replace(/\n$/, '')

    const parsedLines: FolderTreeLineNode[] = useMemo(() => {
      if (!fullText) return []
      const lines = fullText.split('\n').filter((l) => l.trim().length > 0)
      const hasBoxBranches = lines.some((l) => /[├└│]/.test(l))
      const folderStack: Array<{ depth: number; path: string }> = []

      return lines.map((line, idx) => {
        const strippedPrefix = line.trim().replace(/^[│├└┌─\s\-*•]+/, '').trim()
        const cleanLabel = stripLeadingEntityEmoji(strippedPrefix)
        const cleanTargetName = cleanLabel
          .replace(/\s*\(.*?\)\s*$/, '')
          .replace(/\/+$/, '')
          .trim()

        let branch = ''
        let depth = 0

        if (hasBoxBranches) {
          const match = line.match(/^([│├└┌─\s]+)(.*)$/)
          if (match) {
            branch = match[1]
            depth = Math.max(1, Math.floor(branch.replace(/\s/g, ' ').length / 3))
          }
        } else {
          const leadingSpaces = (line.match(/^\s*/) || [''])[0].length
          depth = Math.floor(leadingSpaces / 2)
          if (!(idx === 0 && depth === 0 && lines.length > 1)) {
            const isLastAtDepth = (() => {
              for (let j = idx + 1; j < lines.length; j++) {
                const nextDepth = Math.floor(((lines[j].match(/^\s*/) || [''])[0].length) / 2)
                if (nextDepth < depth) return true
                if (nextDepth === depth) return false
              }
              return true
            })()
            const prefixGuides = depth > 1 ? '│   '.repeat(depth - 1) : ''
            const connector = isLastAtDepth ? '└── ' : '├── '
            branch = `${prefixGuides}${connector}`
          }
        }

        while (folderStack.length > 0 && folderStack[folderStack.length - 1].depth >= depth) {
          folderStack.pop()
        }
        const contextFolder =
          folderStack.length > 0 ? folderStack[folderStack.length - 1].path : undefined

        const hasFolderHint =
          /[📁📂]/u.test(line) ||
          strippedPrefix.endsWith('/') ||
          (idx === 0 && depth === 0 && lines.length > 1)

        const resolved = resolveWorkspaceEntity(cleanTargetName, cleanLabel, {
          contextFolder,
          preferFolder: hasFolderHint
        })

        const isFolder =
          resolved.exists
            ? resolved.type === 'folder'
            : hasFolderHint || !/\.[a-zA-Z0-9]+$/.test(cleanLabel)

        if (isFolder) {
          const folderPath = resolved.exists
            ? resolved.relativePath
            : contextFolder
              ? `${contextFolder}/${cleanTargetName}`
              : cleanTargetName
          folderStack.push({ depth, path: folderPath })
        }

        return {
          indent: '',
          branch,
          label: cleanLabel,
          isFolder,
          raw: line,
          entity: resolved
        }
      })
    }, [fullText])

    const totalItems = useMemo(() => {
      return parsedLines.filter((l) => Boolean(l.label)).length
    }, [parsedLines])

    const folderCount = useMemo(() => {
      return parsedLines.filter((l) => l.isFolder && Boolean(l.label)).length
    }, [parsedLines])

    const handleCopy = async (e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await navigator.clipboard.writeText(fullText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy tree:', err)
      }
    }

    if (!fullText) return null

    return (
      <div className={`lumina-folder-tree-card ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
        <div className="lumina-folder-tree-header" onClick={() => setIsExpanded((prev) => !prev)}>
          <div className="lumina-folder-tree-title-group">
            <FolderTree size={12} className="lumina-folder-tree-icon" />
            <span className="lumina-folder-tree-main-title">{title}</span>
            <span className="lumina-folder-tree-stats">
              {folderCount} {folderCount === 1 ? 'folder' : 'folders'}
              {totalItems > folderCount ? ` · ${totalItems - folderCount} files` : ''}
            </span>
          </div>

          <div className="lumina-folder-tree-controls">
            <button
              type="button"
              className={`lumina-folder-tree-copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              title={copied ? 'Copied to clipboard' : 'Copy folder structure'}
              aria-label="Copy folder structure"
            >
              {copied ? (
                <>
                  <Check size={11} strokeWidth={2.5} />
                  <span>Copied</span>
                </>
              ) : (
                <Copy size={11} />
              )}
            </button>
            <span className="lumina-folder-tree-chevron">
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="lumina-folder-tree-body seamless-scrollbar">
            {parsedLines.map((node, idx) => {
              const cleanFileTarget = node.label
                .replace(/\s*\(.*?\)\s*$/, '')
                .replace(/\/+$/, '')
                .replace(/\.md$/i, '')
                .trim()
              return (
                <div key={`tree-${idx}`} className="lumina-folder-tree-line">
                  {node.branch ? (
                    <span className="lumina-folder-tree-branch">{node.branch}</span>
                  ) : null}
                  <span
                    className={`lumina-folder-tree-node-item entity-type-${
                      node.isFolder ? 'folder' : node.entity.type
                    }`}
                  >
                    {node.isFolder ? (
                      <Folder
                        size={11}
                        className="lumina-folder-tree-folder-icon"
                        style={node.entity.color ? { color: node.entity.color } : undefined}
                      />
                    ) : (
                      <span className="lumina-folder-tree-file-icon-wrap">
                        {renderResolvedEntityIcon(node.entity, 11)}
                      </span>
                    )}
                    <span
                      className={`lumina-folder-tree-label ${
                        node.isFolder ? 'is-folder is-clickable' : 'is-file is-clickable'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (node.entity.exists) {
                          navigateToWorkspaceEntity(node.entity)
                        } else if (cleanFileTarget) {
                          navigateToWorkspaceEntity(cleanFileTarget)
                        }
                      }}
                      title={
                        node.isFolder
                          ? `Folder: ${node.entity.relativePath || cleanFileTarget}`
                          : `Open ${node.entity.relativePath || cleanFileTarget}`
                      }
                    >
                      {node.label}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }
)

export default LuminaFolderTree
