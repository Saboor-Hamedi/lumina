import React, { useState, useMemo } from 'react'
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  FileCode,
  Hash,
  RefreshCw,
  Star,
  Clock,
  Database
} from 'lucide-react'
import { FixedSizeList as List } from '../../components/utils/VirtualList'
import { AutoSizer } from '../../components/utils/AutoSizer'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import './FileExplorer.css'

/**
 * Robust Virtualized File Explorer (Google/FB Standard #1)
 * Upgraded to PKM Hub with Sections and Kinetic Icons.
 */
const FileExplorer = () => {
  const { settings, updateSetting } = useSettingsStore()
  const collapsedSections = settings.sidebarCollapsedSections || {
    pinned: false,
    recent: false,
    all: false
  }

  const {
    snippets,
    selectedSnippet,
    setSelectedSnippet,
    isLoading,
    searchQuery,
    setSearchQuery,
    loadVault,
    saveSnippet
  } = useVaultStore()

  const [isRefreshing, setIsRefreshing] = useState(false)

  const toggleSection = (section) => {
    updateSetting('sidebarCollapsedSections', {
      ...collapsedSections,
      [section]: !collapsedSections[section]
    })
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadVault()
    setTimeout(() => setIsRefreshing(false), 800)
  }

  const handleNew = async () => {
    const newSnippet = {
      id: crypto.randomUUID(),
      title: 'New Note',
      code: '',
      language: 'markdown',
      timestamp: Date.now(),
      isPinned: false
    }
    await saveSnippet(newSnippet)
    setSelectedSnippet(newSnippet)
  }

  // Filtered and Sorted Data
  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return snippets.filter((s) => (s.title || '').toLowerCase().includes(query))
  }, [snippets, searchQuery])

  const pinnedItems = useMemo(() => filtered.filter((s) => s.isPinned), [filtered])
  const recentItems = useMemo(
    () => [...filtered].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5),
    [filtered]
  )

  const Row = ({ index, style }) => {
    const snippet = filtered[index]
    if (!snippet) return null

    const isActive = selectedSnippet?.id === snippet.id

    const getIcon = () => {
      const lang = (snippet.language || 'markdown').toLowerCase()
      if (['javascript', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'python', 'py'].includes(lang))
        return <FileCode size={14} className="item-icon" />
      if (lang === 'markdown' || lang === 'md') return <Hash size={14} className="item-icon" />
      return <FileText size={14} className="item-icon" />
    }

    return (
      <div
        style={style}
        className={`tree-item ${isActive ? 'active' : ''}`}
        onClick={() => setSelectedSnippet(snippet)}
        title={snippet.title}
      >
        {getIcon()}
        <span className="item-title">{snippet.title || 'Untitled'}</span>
        {snippet.isPinned && (
          <Star size={10} fill="currentColor" style={{ marginLeft: 'auto', opacity: 0.5 }} />
        )}
      </div>
    )
  }

  return (
    <div className="sidebar-pane">
      <header className="pane-header">
        <div className="pane-title">EXPLORER</div>
        <div className="pane-actions">
          <button className="icon-btn" onClick={handleRefresh} title="Refresh Vault (Sync Disk)">
            <RefreshCw size={14} className={isRefreshing ? 'rotating' : ''} />
          </button>
          <button className="icon-btn" onClick={handleNew} title="New Note">
            <Plus size={16} />
          </button>
        </div>
      </header>

      <div className="explorer-toolbar">
        <div className="explorer-search">
          <Search size={12} />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="explorer-tree">
        {/* PINNED SECTION */}
        {pinnedItems.length > 0 && (
          <div className="tree-section">
            <div className="section-header" onClick={() => toggleSection('pinned')}>
              {collapsedSections.pinned ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <Star size={12} className="section-icon" />
              <span>PINNED</span>
            </div>
            {!collapsedSections.pinned && (
              <div className="section-static-items">
                {pinnedItems.map((item) => (
                  <div
                    key={item.id}
                    className={`tree-item ${selectedSnippet?.id === item.id ? 'active' : ''}`}
                    onClick={() => setSelectedSnippet(item)}
                  >
                    <Hash size={14} className="item-icon" />
                    <span className="item-title">{item.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RECENT SECTION */}
        {recentItems.length > 0 && !searchQuery && (
          <div className="tree-section">
            <div className="section-header" onClick={() => toggleSection('recent')}>
              {collapsedSections.recent ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <Clock size={12} className="section-icon" />
              <span>RECENT</span>
            </div>
            {!collapsedSections.recent && (
              <div className="section-static-items">
                {recentItems.map((item) => (
                  <div
                    key={item.id}
                    className={`tree-item ${selectedSnippet?.id === item.id ? 'active' : ''}`}
                    onClick={() => setSelectedSnippet(item)}
                  >
                    <Hash size={14} className="item-icon" />
                    <span className="item-title">{item.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ALL NOTES SECTION */}
        <div
          className="tree-section"
          style={{
            flex: collapsedSections.all ? '0 0 auto' : 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
          }}
        >
          <div className="section-header" onClick={() => toggleSection('all')}>
            {collapsedSections.all ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            <FileText size={12} className="section-icon" />
            <span>ALL NOTES</span>
            <span className="count-badge">{filtered.length}</span>
          </div>

          {!collapsedSections.all && (
            <div style={{ flex: 1, minHeight: 0 }}>
              {isLoading ? (
                <div className="section-items">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="tree-item skeleton-item">
                      <div className="skeleton skeleton-icon" />
                      <div className="skeleton skeleton-text" />
                    </div>
                  ))}
                </div>
              ) : filtered.length > 0 ? (
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      height={height}
                      itemCount={filtered.length}
                      itemSize={34}
                      width={width}
                      className="virtual-list"
                    >
                      {Row}
                    </List>
                  )}
                </AutoSizer>
              ) : (
                <div className="tree-empty">
                  <div className="empty-icon">📭</div>
                  No notes found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="pane-footer">
        <div className="footer-stat">
          <Database size={10} style={{ opacity: 0.5 }} />
          <span>VAULT:</span>
          <strong>Lumina</strong>
        </div>
        <div className="footer-stat">
          <FileText size={10} style={{ opacity: 0.5 }} />
          {snippets.length} Notes
        </div>
      </footer>
    </div>
  )
}

export default FileExplorer
