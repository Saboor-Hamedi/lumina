import React, { useState, useEffect, useRef, useCallback, startTransition, useMemo } from 'react'
import { Square, Copy, Book, PanelLeftClose, PanelLeftOpen, FileText, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import ToolTip from '../../components/atoms/ToolTip'
import DocSidebar from './DocSidebar'
import { PreviewCommandPalette } from '../commandpalette/PreviewCommandPalette'
import '../modals/css/guide.css'
import '../preview/preview.css'
import './Documentation.css'

const markdownFiles = import.meta.glob('../../../../../brain/**/*.md', {
  query: '?raw',
  eager: true,
  import: 'default'
})

const formatDocTitle = (name) => {
  const customTitles = {
    introduction: 'Introduction to Lumina',
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
  if (customTitles[name.toLowerCase()]) return customTitles[name.toLowerCase()]
  return name
    .replace(/^[0-9]+-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const DocsContent = React.memo(({ content, setSelectedDoc, docs, selectedDoc, prevDoc, nextDoc }) => {
  const handleCustomLink = useCallback(
    (url) => {
      if (!url) return false

      if (url.endsWith('.md')) {
        let targetPath = url.replace(/^(?:\.\/|brain\/)+/, '')
        if (docs && docs[targetPath]) {
          if (setSelectedDoc) setSelectedDoc(targetPath)
          return true
        }
        const filename = targetPath.split('/').pop()
        const match = Object.keys(docs || {}).find((k) => k.endsWith(filename))
        if (match && setSelectedDoc) {
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

  const footerNav = (prevDoc || nextDoc) ? (
    <div className="docs-nav-footer">
      {prevDoc ? (
        <button
          className="docs-nav-btn prev-btn"
          onClick={() => setSelectedDoc(prevDoc)}
        >
          <span className="docs-nav-btn-label">
            <ChevronLeft size={12} className="docs-nav-arrow-left" /> Previous
          </span>
          <span className="docs-nav-btn-title">
            {formatDocTitle(prevDoc.split('/').pop().replace('.md', ''))}
          </span>
        </button>
      ) : (
        <div />
      )}

      {nextDoc && (
        <button
          className="docs-nav-btn next-btn"
          onClick={() => setSelectedDoc(nextDoc)}
        >
          <span className="docs-nav-btn-label">
            Next <ChevronRight size={12} className="docs-nav-arrow-right" />
          </span>
          <span className="docs-nav-btn-title">
            {formatDocTitle(nextDoc.split('/').pop().replace('.md', ''))}
          </span>
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
})

const getInitialDocs = () => {
  const loaded = {}
  for (const path in markdownFiles) {
    const nameMatch = path.match(/brain\/(.*\.md)$/)
    if (nameMatch) {
      loaded[nameMatch[1]] = markdownFiles[path]
    }
  }
  return loaded
}

const INITIAL_DOCS = getInitialDocs()
const INITIAL_DEFAULT_DOC =
  Object.keys(INITIAL_DOCS).find((k) => k.toLowerCase().includes('introduction')) ||
  Object.keys(INITIAL_DOCS).find((k) => k.includes('01-basic-syntax')) ||
  Object.keys(INITIAL_DOCS)[0] ||
  null
const INITIAL_CONTENT = INITIAL_DEFAULT_DOC ? INITIAL_DOCS[INITIAL_DEFAULT_DOC] : ''

const Documentation = ({ isOpen, onClose }) => {
  const [docs, setDocs] = useState(INITIAL_DOCS)
  const [selectedDoc, setSelectedDoc] = useState(INITIAL_DEFAULT_DOC)
  const [content, setContent] = useState(INITIAL_CONTENT)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isMaximized = useSettingsStore((s) => s.settings.docsModalMaximized ?? false)

  const containerRef = useRef()

  // Clean up any previously stored drag positions so modal is always perfectly centered
  useEffect(() => {
    try {
      localStorage.removeItem('docs-modal-pos')
    } catch {
      // ignore
    }
  }, [])

  // Ensure docs are synced if hot-reloaded
  useEffect(() => {
    const loaded = getInitialDocs()
    setDocs(loaded)
    if (!selectedDoc) {
      const defaultDoc =
        Object.keys(loaded).find((k) => k.toLowerCase().includes('introduction')) ||
        Object.keys(loaded).find((k) => k.includes('01-basic-syntax')) ||
        Object.keys(loaded)[0]
      if (defaultDoc) setSelectedDoc(defaultDoc)
    }
  }, [])

  // Ordered list of docs for next/prev navigation matching sidebar visual order
  const sortedDocList = useMemo(() => {
    const general = []
    const technical = []
    const references = []
    const others = []
    const ignored = ['refrences.md', 'lumina.md', 'scope.md']

    Object.keys(docs)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .forEach((path) => {
        if (path.startsWith('specs/')) return
        const filename = path.split('/').pop()
        if (ignored.includes(filename.toLowerCase())) return

        if (filename.toLowerCase() === 'purpose.md' || path.startsWith('technical/')) {
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

  const currentIndex = sortedDocList.indexOf(selectedDoc)
  const prevDoc = currentIndex > 0 ? sortedDocList[currentIndex - 1] : null
  const nextDoc = currentIndex >= 0 && currentIndex < sortedDocList.length - 1 ? sortedDocList[currentIndex + 1] : null

  // Load content when selectedDoc changes
  useEffect(() => {
    if (selectedDoc) {
      if (docs[selectedDoc]) {
        if (typeof docs[selectedDoc] === 'string') {
          startTransition(() => {
            setContent(docs[selectedDoc])
          })
        } else if (typeof docs[selectedDoc] === 'function') {
          docs[selectedDoc]()
            .then((text) => {
              startTransition(() => setContent(text))
            })
            .catch((err) => {
              startTransition(() => {
                setContent(
                  `# Error\n\nFailed to load document: \`${selectedDoc}\`\n\n*Error details: ${err.message}*`
                )
              })
            })
        } else {
          startTransition(() => {
            setContent(String(docs[selectedDoc]))
          })
        }
      } else {
        startTransition(() => {
          setContent(
            `# Document Not Found\n\nThe requested documentation file \`${selectedDoc}\` could not be found or has been renamed.\n\nPlease select another document from the sidebar.`
          )
        })
      }
    } else {
      startTransition(() => {
        setContent('')
      })
    }
  }, [selectedDoc, docs])

  const handleToggleMaximize = useCallback(() => {
    const { settings, updateSettings } = useSettingsStore.getState()
    updateSettings({ docsModalMaximized: !(settings.docsModalMaximized ?? false) })
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

  if (!isOpen) return null

  return (
    <div
      className="guide-modal-overlay"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className={`docs-modal-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="docs-modal-header"
          style={{ cursor: 'default' }}
        >
          <div className="docs-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ToolTip text={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'} position="bottom">
              <button
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
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-main)',
                letterSpacing: '-0.01em',
                background: 'transparent',
                padding: 0
              }}
            >
              Documentation
            </span>
            {selectedDoc && (
              <>
                <span style={{ opacity: 0.35, color: 'var(--text-muted)', fontSize: '12px' }}>/</span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 450,
                    color: 'var(--text-muted)',
                    maxWidth: '240px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    background: 'transparent',
                    padding: 0
                  }}
                  title={formatDocTitle(selectedDoc.split('/').pop().replace('.md', ''))}
                >
                  {formatDocTitle(selectedDoc.split('/').pop().replace('.md', ''))}
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
            content={content}
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
