import React, { useState, useEffect, useRef, useCallback, startTransition, useMemo } from 'react'
import {
  Square,
  Copy,
  Book,
  PanelLeftClose,
  PanelLeftOpen,
  Clock,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import { useSettingsStore } from '../../core/store/SettingStore'
import ToolTip from '../../components/atoms/ToolTip'
import DocSidebar from './DocSidebar'
import { PreviewCommandPalette } from '../commandpalette'
import '../modals/css/guide.css'
import './Documentation.css'

type DocLoader = string | (() => Promise<string>)
type DocsMap = Record<string, DocLoader>

export interface DocumentationProps {
  isOpen: boolean
  onClose: () => void
}

interface DocsContentProps {
  content: string
  setSelectedDoc: React.Dispatch<React.SetStateAction<string | null>>
  docs: DocsMap
  selectedDoc: string | null
  prevDoc: string | null
  nextDoc: string | null
}

const markdownFiles = import.meta.glob('../../../../../brain/**/*.md', {
  query: '?raw',
  import: 'default'
}) as Record<string, () => Promise<string>>

const CUSTOM_DOC_TITLES: Record<string, string> = {
  introduction: 'Introduction to Lumina',
  'how-to-ask-lumina': 'How to Ask Lumina',
  'pdf-and-ai-canvas': 'Smart PDFs & AI Canvas',
  shortcuts: 'Keyboard Shortcuts',
  purpose: 'Purpose & Architecture',
  'quick-start': 'Quick Start Guide',
  '01-basic-syntax': '1. Basic Syntax',
  '02-code-and-syntax': '2. Code & Syntax Highlighting',
  '03-tables-and-tasklists': '3. Tables & Task Lists',
  '04-mermaid-diagrams': '4. Mermaid Diagrams',
  '05-math-and-html': '5. Math & HTML Support',
  '06-admonitions-and-advanced': '6. Callouts & Admonitions',
  '07-best-practices': '7. Best Practices & Cheat Sheet'
}

const formatDocTitle = (name: string): string => {
  const lower = name.toLowerCase()
  if (CUSTOM_DOC_TITLES[lower]) return CUSTOM_DOC_TITLES[lower]
  return name
    .replace(/^[0-9]+-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const getDocBaseTitle = (docPath: string): string => {
  const fileName = docPath.split('/').pop() || docPath
  return formatDocTitle(fileName.replace(/\.md$/i, ''))
}

const DocsContent: React.FC<DocsContentProps> = React.memo(
  ({ content, setSelectedDoc, docs, prevDoc, nextDoc }) => {
    const handleCustomLink = useCallback(
      (url: string): boolean => {
        if (!url) return false

        if (url.endsWith('.md')) {
          const targetPath = url.replace(/^(?:\.\/|brain\/)+/, '')
          if (docs && docs[targetPath]) {
            setSelectedDoc(targetPath)
            return true
          }
          const filename = targetPath.split('/').pop() || targetPath
          const match = Object.keys(docs || {}).find((k) => k.endsWith(filename))
          if (match) {
            setSelectedDoc(match)
            return true
          }
        }
        return false
      },
      [docs, setSelectedDoc]
    )

    const sanitizedContent = useMemo(() => {
      if (!content) return ''
      return content.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\/?think>/gi, '')
    }, [content])

    if (!content) {
      return (
        <div className="docs-empty-state">
          <Book size={48} className="docs-empty-state-icon" />
          <p>Select a document to read</p>
        </div>
      )
    }

    const footerNav =
      prevDoc || nextDoc ? (
        <div className="docs-nav-footer">
          {prevDoc ? (
            <button
              type="button"
              className="docs-nav-btn prev-btn"
              onClick={() => setSelectedDoc(prevDoc)}
            >
              <span className="docs-nav-btn-label">
                <ChevronLeft size={12} className="docs-nav-arrow-left" /> Previous
              </span>
              <span className="docs-nav-btn-title">{getDocBaseTitle(prevDoc)}</span>
            </button>
          ) : (
            <div />
          )}

          {nextDoc && (
            <button
              type="button"
              className="docs-nav-btn next-btn"
              onClick={() => setSelectedDoc(nextDoc)}
            >
              <span className="docs-nav-btn-label">
                Next <ChevronRight size={12} className="docs-nav-arrow-right" />
              </span>
              <span className="docs-nav-btn-title">{getDocBaseTitle(nextDoc)}</span>
            </button>
          )}
        </div>
      ) : null

    return (
      <div
        className="docs-content"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          background: 'var(--bg-app)'
        }}
      >
        <PreviewCommandPalette
          content={sanitizedContent}
          customLinkHandler={handleCustomLink}
          footerNav={footerNav}
        />
      </div>
    )
  }
)

DocsContent.displayName = 'DocsContent'

const getInitialDocs = (): DocsMap => {
  const loaded: DocsMap = {}
  for (const path in markdownFiles) {
    const nameMatch = path.match(/brain\/(.*\.md)$/)
    if (nameMatch) {
      loaded[nameMatch[1]] = markdownFiles[path]
    }
  }
  return loaded
}

const INITIAL_DOCS = getInitialDocs()
const INITIAL_DEFAULT_DOC: string | null =
  Object.keys(INITIAL_DOCS).find((k) => k.toLowerCase().includes('introduction')) ||
  Object.keys(INITIAL_DOCS).find((k) => k.includes('01-basic-syntax')) ||
  Object.keys(INITIAL_DOCS)[0] ||
  null

const IGNORED_DOCS = new Set(['refrences.md', 'lumina.md', 'scope.md'])

const Documentation: React.FC<DocumentationProps> = ({ isOpen, onClose }) => {
  const [docs] = useState<DocsMap>(INITIAL_DOCS)
  const [selectedDoc, setSelectedDoc] = useState<string | null>(INITIAL_DEFAULT_DOC)
  const [content, setContent] = useState<string>('')
  const [isEditorReady, setIsEditorReady] = useState<boolean>(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true)
  const isMaximized = useSettingsStore((s: any) => s.settings?.docsModalMaximized ?? false)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const docCacheRef = useRef<Record<string, string>>({})

  // Paint modal shell immediately on open, then mount heavy CodeMirror preview on next frame
  useEffect(() => {
    if (!isOpen) {
      setIsEditorReady(false)
      return
    }
    const raf = requestAnimationFrame(() => setIsEditorReady(true))
    return () => cancelAnimationFrame(raf)
  }, [isOpen])

  // Ordered list of docs for next/prev navigation matching sidebar visual order
  const sortedDocList = useMemo(() => {
    const general: string[] = []
    const technical: string[] = []
    const references: string[] = []
    const others: string[] = []

    Object.keys(docs)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .forEach((path) => {
        if (path.startsWith('specs/')) return
        const filename = (path.split('/').pop() || path).toLowerCase()
        if (IGNORED_DOCS.has(filename)) return

        if (filename === 'purpose.md' || path.startsWith('technical/')) {
          technical.push(path)
        } else if (path.includes('references/') || path.includes('reference/')) {
          references.push(path)
        } else if (!path.includes('/')) {
          general.push(path)
        } else {
          others.push(path)
        }
      })
    return [...general, ...technical, ...references, ...others]
  }, [docs])

  const currentIndex = selectedDoc ? sortedDocList.indexOf(selectedDoc) : -1
  const prevDoc = currentIndex > 0 ? sortedDocList[currentIndex - 1] : null
  const nextDoc =
    currentIndex >= 0 && currentIndex < sortedDocList.length - 1
      ? sortedDocList[currentIndex + 1]
      : null

  // Load content when selectedDoc changes (lazy + cached)
  useEffect(() => {
    if (!isOpen) return
    if (!selectedDoc) {
      setContent('')
      return
    }

    if (docCacheRef.current[selectedDoc]) {
      setContent(docCacheRef.current[selectedDoc])
      return
    }

    const entry = docs[selectedDoc]
    if (!entry) {
      setContent(
        `# Document Not Found\n\nThe requested documentation file \`${selectedDoc}\` could not be found or has been renamed.\n\nPlease select another document from the sidebar.`
      )
      return
    }

    if (typeof entry === 'string') {
      docCacheRef.current[selectedDoc] = entry
      setContent(entry)
      return
    }

    let cancelled = false
    entry()
      .then((text) => {
        docCacheRef.current[selectedDoc] = text
        if (!cancelled) startTransition(() => setContent(text))
      })
      .catch((err: Error) => {
        if (!cancelled) {
          startTransition(() => {
            setContent(
              `# Error\n\nFailed to load document: \`${selectedDoc}\`\n\n*Error details: ${err.message}*`
            )
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, selectedDoc, docs])

  const handleToggleMaximize = useCallback(() => {
    const { settings, updateSettings } = useSettingsStore.getState() as any
    updateSettings({ docsModalMaximized: !(settings?.docsModalMaximized ?? false) })
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  useKeyboardShortcuts({
    onEscape: () => {
      if (isOpen && onClose) {
        onClose()
        return true
      }
      return false
    }
  })

  const readingStats = useMemo(() => {
    const words = content ? content.split(/\s+/).filter(Boolean).length : 0
    const minutes = Math.max(1, Math.ceil(words / 200))
    return { words, minutes }
  }, [content])

  const flatDocList = useMemo(() => {
    return Object.keys(docs || {})
      .filter((p) => {
        if (p.startsWith('specs/')) return false
        const name = (p.split('/').pop() || p).toLowerCase()
        return !IGNORED_DOCS.has(name)
      })
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  }, [docs])

  // Keyboard navigation parity (ArrowDown / ArrowUp)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const idx = selectedDoc ? flatDocList.indexOf(selectedDoc) : -1
        const nextIndex = Math.min(flatDocList.length - 1, (idx === -1 ? 0 : idx) + 1)
        if (flatDocList[nextIndex]) setSelectedDoc(flatDocList[nextIndex])
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const idx = selectedDoc ? flatDocList.indexOf(selectedDoc) : -1
        const prevIndex = Math.max(0, (idx === -1 ? 0 : idx) - 1)
        if (flatDocList[prevIndex]) setSelectedDoc(flatDocList[prevIndex])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, flatDocList, selectedDoc])

  if (!isOpen) return null

  const activeDocTitle = selectedDoc ? getDocBaseTitle(selectedDoc) : ''

  return (
    <div className="guide-modal-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className={`docs-modal-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="docs-modal-header"
          onDoubleClick={handleToggleMaximize}
          style={{ cursor: 'default' }}
        >
          <div
            className="docs-header-left"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ToolTip text={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'} position="bottom">
              <button
                type="button"
                className="docs-sidebar-toggle-btn"
                onClick={handleToggleSidebar}
                aria-label={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
              >
                {isSidebarOpen ? (
                  <PanelLeftClose size={15} strokeWidth={2} />
                ) : (
                  <PanelLeftOpen size={15} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 500,
                color: 'var(--text-main)',
                letterSpacing: '-0.01em',
                background: 'transparent',
                padding: 0
              }}
            >
              Documentation
            </span>
            {activeDocTitle && (
              <>
                <span style={{ opacity: 0.35, color: 'var(--text-muted)', fontSize: '12px' }}>
                  /
                </span>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 400,
                    color: 'var(--text-muted)',
                    maxWidth: '240px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    background: 'transparent',
                    padding: 0
                  }}
                  title={activeDocTitle}
                >
                  {activeDocTitle}
                </span>
              </>
            )}
          </div>

          <div className="docs-header-right">
            <ToolTip text={`${readingStats.words} words`} position="bottom">
              <div className="docs-header-stat">
                <Clock size={12} />
                <span>~{readingStats.minutes} min read</span>
              </div>
            </ToolTip>
            <ToolTip text={isMaximized ? 'Restore Window' : 'Maximize Window'} position="bottom">
              <button
                type="button"
                className="docs-window-btn"
                onClick={handleToggleMaximize}
                aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
              >
                {isMaximized ? (
                  <Copy size={13} strokeWidth={2} />
                ) : (
                  <Square size={13} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
            <ToolTip text="Close (Esc)" position="bottom">
              <button
                type="button"
                className="guide-close-btn"
                onClick={onClose}
                aria-label="Close Documentation (Esc)"
              >
                <X size={17} />
              </button>
            </ToolTip>
          </div>
        </div>

        <div className={`docs-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <DocSidebar
            docs={docs}
            selectedDoc={selectedDoc}
            setSelectedDoc={setSelectedDoc}
            isOpen={isSidebarOpen}
          />

          <DocsContent
            content={isEditorReady ? content : ''}
            docs={docs}
            selectedDoc={selectedDoc}
            setSelectedDoc={setSelectedDoc}
            prevDoc={prevDoc}
            nextDoc={nextDoc}
          />
        </div>
      </div>
    </div>
  )
}

export default React.memo(Documentation)
