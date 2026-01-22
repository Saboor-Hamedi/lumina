import React, { useState, useMemo } from 'react'
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  RefreshCw,
  Star,
  History,
  FolderOpen,
  HardDrive
} from 'lucide-react'
import SidebarItem from './components/SidebarItem'
import { FixedSizeList as List } from '../../components/utils/VirtualList'
import { AutoSizer } from '../../components/utils/AutoSizer'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import './FileExplorer.css'

/**
 * Robust Virtualized File Explorer (Google/FB Standard #1)
 * Upgraded to PKM Hub with Sections and Kinetic Icons.
 * Memoized for performance - only re-renders when props change.
 */
const FileExplorer = React.memo(({ onNavigate }) => {
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
    saveSnippet,
    dirtySnippetIds
  } = useVaultStore()

  // Track which section user clicked from to avoid "Triple Highlight" annoyance
  const [activeSection, setActiveSection] = useState('all')

  const handleSelect = (snippet, section = 'all') => {
    setSelectedSnippet(snippet)
    setActiveSection(section)
    if (onNavigate) onNavigate()
  }

  const [isRefreshing, setIsRefreshing] = useState(false)

  const toggleSection = (section) => {
    updateSetting('sidebarCollapsedSections', {
      ...collapsedSections,
      [section]: !collapsedSections[section]
    })
  }

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      await loadVault()
      setTimeout(() => setIsRefreshing(false), 800)
    } catch (error) {
      console.error('Failed to refresh vault:', error)
      setIsRefreshing(false)
    }
  }

  const handleNew = async () => {
    try {
      const newSnippet = {
        id: crypto.randomUUID(),
        title: 'New Notes',
        code: '',
        language: 'markdown',
        timestamp: Date.now(),
        isPinned: false
      }
      await saveSnippet(newSnippet)
      handleSelect(newSnippet, 'all')
    } catch (error) {
      console.error('Failed to create new note:', error)
    }
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
    return (
      <SidebarItem
        snippet={snippet}
        isActive={selectedSnippet?.id === snippet.id && activeSection === 'all'}
        onClick={() => handleSelect(snippet, 'all')}
        style={style}
      />
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
              <Star size={14} className="section-icon" />
              <span>PINNED</span>
            </div>
            {!collapsedSections.pinned && (
              <div className="section-static-items">
                {pinnedItems.map((item) => (
                  <SidebarItem
                    key={item.id}
                    snippet={item}
                    isActive={selectedSnippet?.id === item.id && activeSection === 'pinned'}
                    onClick={() => handleSelect(item, 'pinned')}
                  />
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
              <History size={14} className="section-icon" />
              <span>RECENT</span>
            </div>
            {!collapsedSections.recent && (
              <div className="section-static-items">
                {recentItems.map((item) => (
                  <SidebarItem
                    key={item.id}
                    snippet={item}
                    isActive={selectedSnippet?.id === item.id && activeSection === 'recent'}
                    onClick={() => handleSelect(item, 'recent')}
                  />
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
            <FolderOpen size={14} className="section-icon" />
            <span>ALL NOTES</span>
            <span className="count-badge">{filtered.length}</span>
          </div>

          {!collapsedSections.all && (
            <div className="section-items" style={{ flex: 1, minHeight: 0 }}>
              {isLoading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="tree-item skeleton-item">
                      <div className="skeleton skeleton-icon" />
                      <div className="skeleton skeleton-text" />
                    </div>
                  ))}
                </>
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

    </div>
  )
})

FileExplorer.displayName = 'FileExplorer'

export default FileExplorer
