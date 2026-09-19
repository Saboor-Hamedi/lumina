import React, { useState, useMemo } from 'react'
import { FolderTree, Folder, FileText, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react'
import '../css/treeBadge.css'

export interface LuminaTreeBadgeProps {
  content?: string
  rawCode?: string
  title?: string
}

export interface TreeLineNode {
  indent: string
  branch: string
  label: string
  isFolder: boolean
  raw: string
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
 * LuminaTreeBadge
 * Extracted dedicated badge and visual explorer for folder structure trees in chat.
 * Renders theme-aware branch lines, folder icons, item counts, and quick copy.
 */
export const LuminaTreeBadge: React.FC<LuminaTreeBadgeProps> = React.memo(
  ({ content = '', rawCode = '', title = 'Folder Structure' }) => {
    const [isExpanded, setIsExpanded] = useState<boolean>(true)
    const [copied, setCopied] = useState<boolean>(false)

    const fullText = (content || rawCode || '').replace(/\n$/, '')

    const parsedLines: TreeLineNode[] = useMemo(() => {
      if (!fullText) return []
      const lines = fullText.split('\n')
      return lines.map((line) => {
        const isFolder =
          /📁/.test(line) ||
          line.trim().endsWith('/') ||
          !/\.[a-zA-Z0-9]+$/.test(line.trim().replace(/^[│├└┌─\s]+/, ''))

        const match = line.match(/^([│├└┌─\s]+)(.*)$/)
        if (match) {
          return {
            indent: '',
            branch: match[1],
            label: match[2].trim(),
            isFolder,
            raw: line
          }
        }
        return {
          indent: '',
          branch: '',
          label: line.trim(),
          isFolder,
          raw: line
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
      <div className={`lumina-tree-card ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
        <div className="lumina-tree-header" onClick={() => setIsExpanded((prev) => !prev)}>
          <div className="lumina-tree-title-group">
            <FolderTree size={12} className="lumina-tree-icon" />
            <span className="lumina-tree-main-title">{title}</span>
            <span className="lumina-tree-stats">
              {folderCount} {folderCount === 1 ? 'folder' : 'folders'}
              {totalItems > folderCount ? ` · ${totalItems - folderCount} files` : ''}
            </span>
          </div>

          <div className="lumina-tree-controls">
            <button
              type="button"
              className={`lumina-tree-copy-btn ${copied ? 'copied' : ''}`}
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
            <span className="lumina-tree-chevron">
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="lumina-tree-body seamless-scrollbar">
            {parsedLines.map((node, idx) => (
              <div key={`tree-${idx}`} className="lumina-tree-line">
                {node.branch ? (
                  <span className="lumina-tree-branch">{node.branch}</span>
                ) : null}
                <span className="lumina-tree-node-item">
                  {node.isFolder ? (
                    <Folder size={12} className="lumina-tree-folder-icon" />
                  ) : (
                    <FileText size={11} className="lumina-tree-file-icon" />
                  )}
                  <span
                    className={`lumina-tree-label ${
                      node.isFolder ? 'is-folder' : 'is-file'
                    }`}
                  >
                    {node.label}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
)

export default LuminaTreeBadge
