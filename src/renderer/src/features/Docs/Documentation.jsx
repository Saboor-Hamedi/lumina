import React, { useState, useEffect, useRef, useCallback, startTransition } from 'react'
import { Square, Copy, Book, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import ModalHeader from '../Overlays/ModalHeader'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import DocSidebar from './DocSidebar'
import './Documentation.css'

// Use Vite's glob import to read all markdown files in brain/ directory as raw strings
const markdownFiles = import.meta.glob('../../../../../brain/**/*.md', { query: '?raw', eager: true, import: 'default' })

const DocsContent = React.memo(({ content, setSelectedDoc, docs }) => (
  <div className="docs-content">
    <div className="docs-content-inner">
      {content ? (
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ node, href, children, ...props }) => {
              return (
                <a 
                  href={href} 
                  {...props} 
                  onClick={(e) => {
                    e.preventDefault();
                    if (!href) return;
                    
                    // Only handle internal brain/.md links
                    if (href.endsWith('.md')) {
                      // Normalize the path by removing leading './' or 'brain/'
                      let targetPath = href.replace(/^(?:\.\/|brain\/)+/, '');
                      
                      // Support relative paths like 'features/01-architecture.md'
                      // If targetPath exists in docs, select it
                      if (docs && docs[targetPath]) {
                        if (setSelectedDoc) setSelectedDoc(targetPath);
                      } else {
                        // Attempt to find by filename only
                        const filename = targetPath.split('/').pop();
                        const match = Object.keys(docs || {}).find(k => k.endsWith(filename));
                        if (match && setSelectedDoc) setSelectedDoc(match);
                        else if (setSelectedDoc) setSelectedDoc(targetPath);
                      }
                    }
                    // Vault or external links do nothing
                  }}
                >
                  {children}
                </a>
              )
            }
          }}
        >
          {content}
        </ReactMarkdown>
      ) : (
        <div className="docs-empty-state">
          <Book size={48} className="docs-empty-state-icon" />
          <p>Select a document to read</p>
        </div>
      )}
    </div>
  </div>
))

const Documentation = ({ isOpen, onClose }) => {
  const [docs, setDocs] = useState({})
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [content, setContent] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isDraggingModal, setIsDraggingModal] = useState(false)
  
  const containerRef = useRef()
  const modalPos = useRef(
    JSON.parse(localStorage.getItem('docs-modal-pos') || '{"x":0,"y":0}')
  )
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
      
      // Select the first doc by default (e.g. introduction.md)
      const introDoc = Object.keys(loadedDocs).find(k => k.includes('introduction.md'))
      const defaultDoc = introDoc || Object.keys(loadedDocs)[0]
      
      if (defaultDoc) {
        setSelectedDoc(defaultDoc)
      }
    }
    loadDocs()
  }, [])

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
            .then(text => {
              startTransition(() => setContent(text))
            })
            .catch(err => {
              startTransition(() => {
                setContent(`# Error\n\nFailed to load document: \`${selectedDoc}\`\n\n*Error details: ${err.message}*`)
              })
            })
        } else {
          startTransition(() => {
            setContent(String(docs[selectedDoc]))
          })
        }
      } else {
        startTransition(() => {
          setContent(`# Document Not Found\n\nThe requested documentation file \`${selectedDoc}\` could not be found or has been renamed.\n\nPlease select another document from the sidebar.`)
        })
      }
    } else {
      startTransition(() => {
        setContent('')
      })
    }
  }, [selectedDoc, docs])

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized(prev => !prev)
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev)
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

  const handleModalHeaderMouseDown = useCallback((e) => {
    if (isMaximized) return
    setIsDraggingModal(true)
    
    if (containerRef.current) {
      containerRef.current.style.transition = 'none'
    }

    dragStart.current = {
      x: e.clientX - modalPos.current.x,
      y: e.clientY - modalPos.current.y
    }
  }, [isMaximized])

  useKeyboardShortcuts({
    onEscape: () => {
      if (isOpen && onClose) {
        onClose()
        return true
      }
      return false
    }
  })

  if (!isOpen) return null

  return (
    <div className="nexus-overlay" onClick={onClose} style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.4)' }}>
      <div
        ref={containerRef}
        className={`nexus-container modal-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{ 
          flexDirection: 'column',
          width: isMaximized ? '100%' : '90%',
          height: isMaximized ? '100%' : '700px',
          maxWidth: isMaximized ? 'none' : '1000px',
          maxHeight: isMaximized ? 'none' : '85vh',
          transform: isMaximized ? 'none' : `translate3d(${modalPos.current.x}px, ${modalPos.current.y}px, 0)`,
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden'
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
              {isSidebarOpen ? <PanelLeftClose size={12} strokeWidth={2} /> : <PanelLeftOpen size={12} strokeWidth={2} />}
            </button>
          }
          right={
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
          }
        />

        <div className="docs-container">
          {isSidebarOpen && (
            <DocSidebar 
              docs={docs} 
              selectedDoc={selectedDoc} 
              setSelectedDoc={setSelectedDoc} 
            />
          )}
          
          <DocsContent content={content} docs={docs} setSelectedDoc={setSelectedDoc} />
        </div>
      </div>
    </div>
  )
}

export default React.memo(Documentation)
