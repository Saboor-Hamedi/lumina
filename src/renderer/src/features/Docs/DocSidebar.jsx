import React, { useState, useMemo } from 'react'
import { Book, Search, FileText, ChevronDown, Folder, X, Keyboard } from 'lucide-react'

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

const formatFolderName = (folder) => {
  const customFolderNames = {
    references: 'Learning Markdown',
    reference: 'Learning Markdown',
    guides: 'Guides & Tutorials',
    tutorials: 'Tutorials',
    faq: 'FAQ',
    api: 'API Reference'
  }
  if (customFolderNames[folder.toLowerCase()]) return customFolderNames[folder.toLowerCase()]
  return folder
    .replace(/^[0-9]+-/, '')
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const getDocIcon = (path, name) => {
  if (name.toLowerCase().includes('shortcut')) {
    return <Keyboard size={13} style={{ marginRight: '8px', opacity: 0.7 }} />
  }
  if (path.includes('references/') || path.includes('reference/')) {
    return <FileText size={13} style={{ marginRight: '8px', opacity: 0.75 }} />
  }
  return <Book size={13} style={{ marginRight: '8px', opacity: 0.7 }} />
}

const DocSidebar = ({ docs, selectedDoc, setSelectedDoc, isOpen = true }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedFolders, setCollapsedFolders] = useState({})

  const toggleFolder = (folderKey) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey]
    }))
  }

  const { generalDocs, folderSections, totalResults } = useMemo(() => {
    const general = []
    const sections = {}
    const query = searchQuery.toLowerCase().trim()
    const ignoredFiles = ['refrences.md', 'lumina.md', 'scope.md', 'purpose.md']

    Object.keys(docs)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .forEach((path) => {
        if (path.startsWith('specs/')) return
        const parts = path.split('/')
        const filename = parts[parts.length - 1]
        if (ignoredFiles.includes(filename.toLowerCase())) return

        const name = filename.replace(/\.md$/, '')
        const formattedTitle = formatDocTitle(name)

        if (
          query &&
          !name.toLowerCase().includes(query) &&
          !formattedTitle.toLowerCase().includes(query) &&
          !path.toLowerCase().includes(query)
        ) {
          return
        }

        if (parts.length > 1) {
          const folderKey = parts[0]
          if (!sections[folderKey]) {
            sections[folderKey] = []
          }
          sections[folderKey].push({ path, name, formattedTitle })
        } else {
          general.push({ path, name, formattedTitle })
        }
      })

    let count = general.length
    for (const key in sections) {
      count += sections[key].length
    }

    return { generalDocs: general, folderSections: sections, totalResults: count }
  }, [docs, searchQuery])

  return (
    <div className={`docs-sidebar ${isOpen ? '' : 'closed'}`}>
      <div className="docs-sidebar-header">
        <div className="docs-search-wrapper">
          <Search size={13} className="docs-search-icon" />
          <input
            type="text"
            className="docs-search-input"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="docs-search-clear" onClick={() => setSearchQuery('')} title="Clear search">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="docs-sidebar-scrollable">
        {generalDocs.length > 0 && (
          <div className="docs-sidebar-group">
            <div className="docs-sidebar-group-title">
              <span>General</span>
            </div>
            <div className="docs-sidebar-group-items">
              {generalDocs.map(({ path, name, formattedTitle }) => (
                <div
                  key={path}
                  className={`docs-sidebar-item ${selectedDoc === path ? 'active' : ''}`}
                  onClick={() => setSelectedDoc(path)}
                >
                  {getDocIcon(path, name)}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formattedTitle}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.entries(folderSections).map(([folderKey, items]) => {
          const isCollapsed = Boolean(collapsedFolders[folderKey])
          return (
            <div className="docs-sidebar-group" key={folderKey}>
              <div
                className="docs-sidebar-folder"
                onClick={() => toggleFolder(folderKey)}
                title={`Toggle ${formatFolderName(folderKey)}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Folder size={14} style={{ color: 'var(--text-accent)' }} />
                  <span>{formatFolderName(folderKey)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      opacity: 0.6,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '2px',
                      background: 'rgba(255,255,255,0.06)'
                    }}
                  >
                    {items.length}
                  </span>
                  <ChevronDown
                    size={13}
                    className={`docs-folder-chevron ${isCollapsed && !searchQuery ? 'collapsed' : ''}`}
                  />
                </div>
              </div>

              {(!isCollapsed || searchQuery) && (
                <div className="docs-sidebar-subitems-wrap">
                  {items.map(({ path, name, formattedTitle }) => (
                    <div
                      key={path}
                      className={`docs-sidebar-item docs-sidebar-subitem ${selectedDoc === path ? 'active' : ''}`}
                      onClick={() => setSelectedDoc(path)}
                    >
                      {getDocIcon(path, name)}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formattedTitle}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {totalResults === 0 && (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-faint)',
              fontSize: '12px'
            }}
          >
            No documents found matching "{searchQuery}".
          </div>
        )}
      </div>
    </div>
  )
}

export default React.memo(DocSidebar)
