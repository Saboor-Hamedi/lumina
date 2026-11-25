import React, { useState } from 'react'
import { FolderOpen, ChevronDown, ChevronUp, Sun, Moon, BookOpen } from 'lucide-react'
import { ChromePdfIcon } from '../Icons/FileIcon'
import ToolTip from '../../components/atoms/ToolTip'
import type { Snippet } from '../../core/editor/types'

export type PDFThemeMode = 'original' | 'dark' | 'sepia' | 'invert'

export interface PDFToolbarProps {
  snippet?: Partial<Snippet> | any
  onOpenInFolder: () => void
  currentTheme?: PDFThemeMode
  onSetTheme?: (theme: PDFThemeMode) => void
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const PDFToolbar: React.FC<PDFToolbarProps> = ({
  snippet,
  onOpenInFolder,
  currentTheme = 'original',
  onSetTheme
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true)
  const formattedSize = formatFileSize(snippet?.size)

  return (
    <div
      className={`pdf-viewer-toolbar ${isExpanded ? 'expanded' : 'collapsed'}`}
      role="toolbar"
      aria-label="PDF Document Actions"
    >
      {isExpanded && (
        <div className="pdf-viewer-toolbar-content">
          <div className="pdf-meta-group">
            <span className="pdf-icon-wrap" aria-hidden="true">
              <ChromePdfIcon size={14} />
            </span>
            <span className="pdf-viewer-badge is-format">PDF</span>
            {formattedSize && (
              <span className="pdf-viewer-badge is-size">{formattedSize}</span>
            )}
          </div>

          {onSetTheme && (
            <>
              <div className="pdf-viewer-divider" aria-hidden="true" />
              <div className="pdf-theme-switch-group" role="group" aria-label="PDF Reading Appearance">
                <ToolTip text="Light pages (Original)" position="top">
                  <button
                    type="button"
                    className={`pdf-theme-btn ${currentTheme === 'original' ? 'active' : ''}`}
                    aria-label="Light PDF appearance"
                    aria-pressed={currentTheme === 'original'}
                    onClick={() => onSetTheme('original')}
                  >
                    <Sun size={12} />
                    <span>Light</span>
                  </button>
                </ToolTip>
                <ToolTip text="Dark pages" position="top">
                  <button
                    type="button"
                    className={`pdf-theme-btn ${currentTheme === 'dark' || currentTheme === 'invert' ? 'active' : ''}`}
                    aria-label="Dark PDF appearance"
                    aria-pressed={currentTheme === 'dark' || currentTheme === 'invert'}
                    onClick={() => onSetTheme('dark')}
                  >
                    <Moon size={12} />
                    <span>Dark</span>
                  </button>
                </ToolTip>
                <ToolTip text="Warm parchment pages" position="top">
                  <button
                    type="button"
                    className={`pdf-theme-btn ${currentTheme === 'sepia' ? 'active' : ''}`}
                    aria-label="Parchment PDF appearance"
                    aria-pressed={currentTheme === 'sepia'}
                    onClick={() => onSetTheme('sepia')}
                  >
                    <BookOpen size={12} />
                    <span>Parchment</span>
                  </button>
                </ToolTip>
              </div>
            </>
          )}

          <div className="pdf-viewer-divider" aria-hidden="true" />
          <ToolTip text="Reveal in system file manager" position="top">
            <button
              type="button"
              className="pdf-viewer-btn"
              aria-label="Open Containing Folder"
              onClick={onOpenInFolder}
            >
              <FolderOpen size={14} />
            </button>
          </ToolTip>
        </div>
      )}

      <ToolTip text={isExpanded ? 'Collapse PDF toolbar' : 'Expand PDF toolbar'} position="top">
        <button
          type="button"
          className="pdf-viewer-btn pdf-viewer-toggle-btn"
          aria-label={isExpanded ? 'Collapse PDF toolbar' : 'Expand PDF toolbar'}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </ToolTip>
    </div>
  )
}

export default React.memo(PDFToolbar)
