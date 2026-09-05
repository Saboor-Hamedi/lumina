import React, { useState, useEffect, useRef, useCallback, startTransition, useMemo } from 'react'
import { Square, Copy, Book, PanelLeftClose, PanelLeftOpen, FileText, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import ModalHeader from '../modals/ModalHeader'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import DocSidebar from './DocSidebar'
import { PreviewCommandPalette } from '../commandpalette/PreviewCommandPalette'
import '../preview/preview.css'
import './Documentation.css'

// Use Vite's glob import to read all markdown files in brain/ directory as raw strings
const markdownFiles = import.meta.glob(['../../../../../brain/**/*.md', '../../../../../brain/*.md'], {
  query: '?raw',
  eager: true,
  import: 'default'
})

const formatDocTitle = (name) => {
  const customTitles = {
    introduction: 'Introduction to Lumina',
    shortcuts: 'Keyboard Shortcuts',
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
        content={content}
        customLinkHandler={handleCustomLink}
        footerNav={footerNav}
      />
    </div>
  )
})

const Documentation = ({ isOpen, onClose }) => {
  const [docs, setDocs] = useState({})
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [content, setContent] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isDraggingModal, setIsDraggingModal] = useState(false)

  const containerRef = useRef()
  const modalPos = useRef(JSON.parse(localStorage.getItem('docs-modal-pos') || '{"x":0,"y":0}'))
  const dragStart = useRef({ x: 0, y: 0 })
  const rafId = useRef(null)

  // Load all docs on mount
  useEffect(() => {
    const loadDocs = async () => {
      const loadedDocs = {}
      for (const path in markdownFiles) {
        // Extract the relative path part after 'brain/'
        const nameMatch = path.match(/brain\/(.*\.md)$/)
        if (nameMatch) {
          loadedDocs[nameMatch[1]] = markdownFiles[path]
        }
      }
      setDocs(loadedDocs)

      // Select default doc (prefer introduction.md or 01-basic-syntax.md)
      const introDoc = Object.keys(loadedDocs).find((k) => k.toLowerCase().includes('introduction'))
      const syntaxDoc = Object.keys(loadedDocs).find((k) => k.includes('01-basic-syntax'))
      const defaultDoc = introDoc || syntaxDoc || Object.keys(loadedDocs)[0]

      if (defaultDoc) {
        setSelectedDoc(defaultDoc)
      }
    }
    loadDocs()
  }, [])

  // Ordered list of docs for next/prev navigation
  const sortedDocList = useMemo(() => {
    const list = []
    const ignored = ['refrences.md', 'lumina.md', 'scope.md']
    Object.keys(docs)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .forEach((path) => {
        const filename = path.split('/').pop()
        if (!ignored.includes(filename.toLowerCase())) {
          list.push(path)
        }
      })
    return list
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
    setIsMaximized((prev) => !prev)
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  // Drag logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingModal || isMaximized) return

      const newX = e.clientX - dragStart.current.x
      const newY = e.clientY - dragStart.current.y
      modalPos.current = { x: newX, y: newY }

      if (rafId.current) cancelAnimationFrame(rafId.current)

      rafId.current = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`
        }
      })
    }

    const handleMouseUp = () => {
      setIsDraggingModal(false)
      if (rafId.current) cancelAnimationFrame(rafId.current)
      if (containerRef.current && !isMaximized) {
        containerRef.current.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        localStorage.setItem('docs-modal-pos', JSON.stringify(modalPos.current))
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [isMaximized, isDraggingModal])

  const handleModalHeaderMouseDown = useCallback(
    (e) => {
      if (isMaximized) return
      setIsDraggingModal(true)

      if (containerRef.current) {
        containerRef.current.style.transition = 'none'
      }

      dragStart.current = {
        x: e.clientX - modalPos.current.x,
        y: e.clientY - modalPos.current.y
      }
    },
    [isMaximized]
  )

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

  const headerStats = (
    <div className="preview-stats-bar" style={{ marginRight: '16px' }}>
      <span className="preview-indicator-tag">DOCS</span>
      <div className="preview-stat-sep" />
      <div className="preview-stat-item">
        <FileText size={12} /> {readingStats.words} words
      </div>
      <div className="preview-stat-sep" />
      <div className="preview-stat-item">
        <Clock size={12} /> ~{readingStats.minutes} min read
      </div>
    </div>
  )

  if (!isOpen) return null

  return (
    <div
      className="nexus-overlay preview-overlay-glass"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className={`nexus-container modal-container preview-modal-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          flexDirection: 'column',
          width: isMaximized ? '100vw' : '92vw',
          height: isMaximized ? '100vh' : '88vh',
          maxWidth: isMaximized ? 'none' : '1100px',
          maxHeight: isMaximized ? 'none' : '90vh',
          transform: isMaximized
            ? 'none'
            : `translate3d(${modalPos.current.x}px, ${modalPos.current.y}px, 0)`,
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          borderRadius: isMaximized ? '0' : '6px'
        }}
      >
        <ModalHeader
          title="Lumina Documentation"
          icon={<Book size={16} />}
          onClose={onClose}
          onMouseDown={handleModalHeaderMouseDown}
          style={{ cursor: isMaximized ? 'default' : 'grab' }}
          left={
            <button
              className="win-btn"
              onClick={handleToggleSidebar}
              title={isSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
              style={{ marginLeft: '-10px' }}
            >
              {isSidebarOpen ? (
                <PanelLeftClose size={12} strokeWidth={2} />
              ) : (
                <PanelLeftOpen size={12} strokeWidth={2} />
              )}
            </button>
          }
          right={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {headerStats}
              <button
                className="win-btn"
                onClick={handleToggleMaximize}
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? (
                  <Copy size={12} strokeWidth={2} />
                ) : (
                  <Square size={12} strokeWidth={2} />
                )}
              </button>
            </div>
          }
        />

        <div className="docs-container">
          {isSidebarOpen && (
            <DocSidebar docs={docs} selectedDoc={selectedDoc} setSelectedDoc={setSelectedDoc} />
          )}

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
