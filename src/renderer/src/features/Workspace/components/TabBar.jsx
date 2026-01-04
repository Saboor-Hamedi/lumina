import React, { useRef } from 'react'
import { X, Hash, FileCode, FileText, Star } from 'lucide-react'
import { useVaultStore } from '../../../core/store/useVaultStore'

/**
 * TabBar Component
 * High-performance, premium workspace tab management.
 * Features: Native feel, dirty indicators, active states, and overflow handling.
 */
const TabBar = () => {
  const { 
    openTabs, 
    activeTabId, 
    snippets, 
    setSelectedSnippet, 
    closeTab, 
    dirtySnippetIds 
  } = useVaultStore()

  const tabsRef = useRef(null)

  if (openTabs.length === 0) return null

  const handleTabClick = (id) => {
    const snippet = snippets.find(s => s.id === id)
    if (snippet) setSelectedSnippet(snippet)
  }

  const handleClose = (e, id) => {
    e.stopPropagation()
    closeTab(id)
  }

  return (
    <div className="workspace-tabbar" ref={tabsRef}>
      <div className="tabs-container">
        {openTabs.map((id) => {
          const snippet = snippets.find(s => s.id === id)
          if (!snippet) return null

          const isActive = activeTabId === id
          const isDirty = dirtySnippetIds.includes(id)

          const getIcon = () => {
            const lang = (snippet.language || 'markdown').toLowerCase()
            if (['javascript', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'python', 'py'].includes(lang))
              return <FileCode size={12} className="tab-icon" />
            if (lang === 'markdown' || lang === 'md') return <Hash size={12} className="tab-icon" />
            return <FileText size={12} className="tab-icon" />
          }

          return (
            <div
              key={id}
              className={`workspace-tab ${isActive ? 'active' : ''} ${isDirty ? 'is-dirty' : ''}`}
              onClick={() => handleTabClick(id)}
              onAuxClick={(e) => e.button === 1 && handleClose(e, id)}
              title={snippet.title}
            >
              <div className="tab-context">
                {getIcon()}
                <span className="tab-title">{snippet.title || 'Untitled'}</span>
              </div>
              
              <div className="tab-actions">
                {isDirty ? (
                  <div className="dirty-indicator tab-dirty" />
                ) : (
                  <button className="tab-close-btn" onClick={(e) => handleClose(e, id)}>
                    <X size={12} />
                  </button>
                )}
              </div>
              
              {isActive && <div className="tab-active-indicator" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TabBar
