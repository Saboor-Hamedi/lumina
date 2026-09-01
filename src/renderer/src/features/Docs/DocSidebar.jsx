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

const getDocIcon = (path, name) => {
  if (name.toLowerCase().includes('shortcut')) {
    return <Keyboard size={13} style={{ marginRight: '8px', opacity: 0.7 }} />
  }
  if (path.includes('references/') || path.includes('reference/')) {
    return <FileText size={13} style={{ marginRight: '8px', opacity: 0.75 }} />
  }
  return <Book size={13} style={{ marginRight: '8px', opacity: 0.7 }} />
}

const DocSidebar = ({ docs, selectedDoc, setSelectedDoc }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isMarkdownCollapsed, setIsMarkdownCollapsed] = useState(false)

  // Filter and organize docs into clean sections
  const { generalDocs, referenceDocs } = useMemo(() => {
    const general = []
    const references = []
    const query = searchQuery.toLowerCase().trim()

    // Exclude old/duplicate non-doc files
    const ignoredFiles = ['refrences.md', 'lumina.md', 'scope.md']

    Object.keys(docs)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .forEach((path) => {
        const filename = path.split('/').pop()
        if (ignoredFiles.includes(filename.toLowerCase())) return

        const name = filename.replace('.md', '')
        const formattedTitle = formatDocTitle(name)

        if (
          query &&
          !name.toLowerCase().includes(query) &&
          !formattedTitle.toLowerCase().includes(query) &&
          !path.toLowerCase().includes(query)
        ) {
          return
        }

        if (path.startsWith('references/') || path.startsWith('reference/')) {
          references.push({ path, name, formattedTitle })
        } else {
          general.push({ path, name, formattedTitle })
        }
      })

    return { generalDocs: general, referenceDocs: references }
  }, [docs, searchQuery])

  const totalResults = generalDocs.length + referenceDocs.length

  return (
    <div className="docs-sidebar">
      {/* Search Header */}
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

      {/* Navigable Sidebar Tree */}
      <div className="docs-sidebar-scrollable">
        {/* 1. GENERAL SECTION */}
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

        {/* 2. LEARNING MARKDOWN (COLLAPSIBLE DROPDOWN FOLDER) */}
        {referenceDocs.length > 0 && (
          <div className="docs-sidebar-group">
            <div
              className="docs-sidebar-folder"
              onClick={() => setIsMarkdownCollapsed((prev) => !prev)}
              title="Toggle Markdown Guide"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Folder size={14} style={{ color: 'var(--text-accent)' }} />
                <span>Learning Markdown</span>
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
                  {referenceDocs.length}
                </span>
                <ChevronDown
                  size={13}
                  className={`docs-folder-chevron ${isMarkdownCollapsed && !searchQuery ? 'collapsed' : ''}`}
                />
              </div>
            </div>

            {/* Chapters with tree line */}
            {(!isMarkdownCollapsed || searchQuery) && (
              <div className="docs-sidebar-subitems-wrap">
                {referenceDocs.map(({ path, name, formattedTitle }) => (
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
        )}

        {/* Empty State */}
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
