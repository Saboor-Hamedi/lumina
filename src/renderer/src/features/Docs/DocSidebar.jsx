import React, { useState, useMemo } from 'react'
import { Book, Search } from 'lucide-react'

const DocSidebar = ({ docs, selectedDoc, setSelectedDoc }) => {
  const [searchQuery, setSearchQuery] = useState('')

  // Group docs by folder and filter by search query
  const groupedDocs = useMemo(() => {
    const groups = { root: [] }
    const query = searchQuery.toLowerCase()
    
    Object.keys(docs).forEach(path => {
      const name = path.split('/').pop().replace('.md', '')
      if (query && !name.toLowerCase().includes(query)) return
      
      const parts = path.split('/')
      if (parts.length === 1) {
        groups.root.push(path)
      } else {
        const folder = parts[0]
        if (!groups[folder]) groups[folder] = []
        groups[folder].push(path)
      }
    })
    return groups
  }, [docs, searchQuery])

  return (
    <div className="docs-sidebar">
      <div className="docs-sidebar-header">
        <div className="docs-search-wrapper">
          <Search size={14} className="docs-search-icon" />
          <input 
            type="text" 
            className="docs-search-input" 
            placeholder="Search docs..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="docs-sidebar-scrollable">
        {Object.keys(groupedDocs).map(folder => {
          const files = groupedDocs[folder]
          if (files.length === 0) return null
          return (
            <div key={folder} className="docs-sidebar-group">
              <div className="docs-sidebar-group-title">{folder === 'root' ? 'General' : folder}</div>
              {files.map(path => {
                const name = path.split('/').pop().replace('.md', '')
                return (
                  <div 
                    key={path}
                    className={`docs-sidebar-item ${selectedDoc === path ? 'active' : ''}`}
                    onClick={() => setSelectedDoc(path)}
                  >
                    <Book size={14} style={{ marginRight: '8px', opacity: 0.7 }} />
                    {name}
                  </div>
                )
              })}
            </div>
          )
        })}
        {Object.keys(groupedDocs).every(folder => groupedDocs[folder].length === 0) && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>
            No documents found.
          </div>
        )}
      </div>
    </div>
  )
}

export default React.memo(DocSidebar)
