import React, { useState } from 'react'
import { FolderOpen, ChevronDown, ChevronUp, Sun, Moon, BookOpen } from 'lucide-react'
import { ChromePdfIcon } from '../Icons/FileIcon'
import type { Snippet } from '../../core/editor/types'

export type PDFThemeMode = 'original' | 'dark' | 'sepia' | 'invert'

export interface PDFToolbarProps {
  snippet?: Partial<Snippet> | any
  onOpenInFolder: () => void
  currentTheme?: PDFThemeMode
  onSetTheme?: (theme: PDFThemeMode) => void
}

/**
 * Format raw bytes into human-readable file size strings.
 */
function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * PDFToolbar
 *
 * Floating quick-access toolbar in the bottom-right corner of the native PDF viewer.
 * Hosts file size metadata, reading themes (Original / Dark Inverted / Sepia),
 * and folder revelation without cluttering native PDF controls.
 */
export const PDFToolbar: React.FC<PDFToolbarProps> = ({
  snippet,
  onOpenInFolder,
  currentTheme = 'dark',
  onSetTheme
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true)

  return (
    <div
      className={`pdf-viewer-toolbar ${isExpanded ? 'expanded' : 'collapsed'}`}
      role="toolbar"
      aria-label="PDF Document Actions"
    >
      {isExpanded && (
        <div className="pdf-viewer-toolbar-content">
          <ChromePdfIcon size={14} />
          {snippet?.size && (
            <span className="pdf-viewer-badge">{formatFileSize(snippet.size)}</span>
          )}
          <span className="pdf-viewer-badge uppercase">PDF</span>

          {onSetTheme && (
            <>
              <div className="pdf-viewer-divider" />
              <div className="pdf-theme-switch-group" role="group" aria-label="PDF Display Themes">
                <button
                  type="button"
                  className={`pdf-theme-btn ${currentTheme === 'original' ? 'active' : ''}`}
                  title="Original (Standard PDF pages)"
                  aria-label="Set theme to Original"
                  onClick={() => onSetTheme('original')}
                >
                  <Sun size={12} />
                  <span>Original</span>
                </button>
                <button
                  type="button"
                  className={`pdf-theme-btn ${currentTheme === 'dark' || currentTheme === 'invert' ? 'active' : ''}`}
                  title="Dark Mode (Inverted pages to match dark theme)"
                  aria-label="Set theme to Dark Mode"
                  onClick={() => onSetTheme('dark')}
                >
                  <Moon size={12} />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  className={`pdf-theme-btn ${currentTheme === 'sepia' ? 'active' : ''}`}
                  title="Sepia Mode (Warm paper tone for easy reading)"
                  aria-label="Set theme to Sepia Tone"
                  onClick={() => onSetTheme('sepia')}
                >
                  <BookOpen size={12} />
                  <span>Sepia</span>
                </button>
              </div>
            </>
          )}

          <div className="pdf-viewer-divider" />
          <button
            type="button"
            className="pdf-viewer-btn"
            title="Open Containing Folder"
            aria-label="Open Containing Folder"
            onClick={onOpenInFolder}
          >
            <FolderOpen size={14} />
          </button>
          <div className="pdf-viewer-divider" />
        </div>
      )}
      <button
        type="button"
        className="pdf-viewer-btn pdf-viewer-toggle-btn"
        title={isExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </div>
  )
}

export default React.memo(PDFToolbar)
