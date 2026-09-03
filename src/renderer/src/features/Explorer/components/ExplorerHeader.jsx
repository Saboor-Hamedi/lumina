import React from 'react'
import {
  Search,
  NotebookText,
  Star,
  FilePlus,
  FolderPlus,
  RefreshCw,
  ChevronsUp
} from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import NoteNumbers from './NoteNumbers'

/**
 * Top header component for the File Explorer modal/panel.
 * Renders the search bar with keyboard navigation, tab switcher, note counts,
 * and quick-action buttons (New Note, New Folder, Refresh, Collapse All).
 *
 * @param {Object} props
 * @param {React.RefObject} props.searchInputRef - Ref attached to the search input element
 * @param {string} props.displayQuery - Immediate display value in search input
 * @param {Function} props.setDisplayQuery - Setter for display query
 * @param {React.RefObject} props.debounceTimerRef - Debounce timer ref
 * @param {Function} props.setQuery - Setter for debounced search query
 * @param {Function} props.setCollapsedDuringSearch - Setter for search-time collapse state
 * @param {Function} props.setSelectedIndex - Setter for keyboard-navigated index
 * @param {React.RefObject} props.virtuosoRef - Ref to Virtuoso virtual list for smooth scroll
 * @param {Array<Object>} props.flatTree - Flattened items in file tree
 * @param {number} props.selectedIndex - Currently selected index in the tree
 * @param {Function} props.handleSelect - Note selection handler
 * @param {Function} props.toggleFolder - Folder expansion toggler
 * @param {string} props.activeTab - Active tab ('all' | 'favorites')
 * @param {Function} props.setActiveTab - Tab change handler
 * @param {Function} props.setCreating - Setter for inline creation state
 * @param {boolean} props.isQueryActive - Whether a search filter is currently active
 * @param {Array<Object>} props.filteredSnippets - Filtered notes matching search
 * @param {Array<Object>} props.allSnippets - All workspace notes
 * @param {string|null} props.lastClickedFolder - Last clicked folder path
 * @param {Function} props.setExpandedFolders - Setter for expanded folder IDs
 * @param {Function} props.loadVault - Vault reload handler
 * @param {boolean} props.isLoading - Whether the vault is actively reloading
 * @param {Function} props.collapseAllFolders - Handler to collapse all folders
 */
export const ExplorerHeader = ({
  searchInputRef,
  displayQuery,
  setDisplayQuery,
  debounceTimerRef,
  setQuery,
  setCollapsedDuringSearch,
  setSelectedIndex,
  setSidebarFocus,
  virtuosoRef,
  flatTree,
  selectedIndex,
  handleSelect,
  toggleFolder,
  activeTab,
  setActiveTab,
  setCreating,
  isQueryActive,
  filteredSnippets,
  allSnippets,
  lastClickedFolder,
  setExpandedFolders,
  loadVault,
  isLoading,
  collapseAllFolders
}) => {
  return (
    <div
      className="explorer-header-container"
      onClick={(e) => {
        e.stopPropagation()
        if (setSidebarFocus) setSidebarFocus(null)
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        if (setSidebarFocus) setSidebarFocus(null)
      }}
    >
      {/* Search Bar with Keyboard Navigation */}
      <div className="start-menu-search relative">
        <Search size={12} className="search-icon" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search notes..."
          value={displayQuery}
          onFocus={() => {
            if (setSidebarFocus) setSidebarFocus(null)
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (setSidebarFocus) setSidebarFocus(null)
          }}
          onChange={(e) => {
            const v = e.target.value
            setDisplayQuery(v)
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = setTimeout(() => {
              setQuery(v)
              setCollapsedDuringSearch(new Set())
            }, 300)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSelectedIndex((prev) => {
                const next = prev < 0 ? 0 : Math.min(prev + 1, flatTree.length - 1)
                virtuosoRef.current?.scrollToIndex({ index: next, align: 'center' })
                return next
              })
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSelectedIndex((prev) => {
                const next = Math.max(prev - 1, 0)
                virtuosoRef.current?.scrollToIndex({ index: next, align: 'center' })
                return next
              })
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (selectedIndex >= 0 && selectedIndex < flatTree.length) {
                const item = flatTree[selectedIndex]
                if (item?.type === 'file') {
                  handleSelect(item.snippet)
                } else if (item?.type === 'folder') {
                  toggleFolder(item.id)
                }
              }
            }
          }}
          className="w-full"
        />
      </div>

      {/* Segmented Tabs (All Notes vs Favorites) */}
      <div className="explorer-segmented-tabs">
        <ToolTip text="All Notes" position="bottom">
          <button
            className={`segmented-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('all')
              setCreating(null)
            }}
          >
            <NotebookText size={12} />
            <span>All Notes</span>
          </button>
        </ToolTip>
        <ToolTip text="Favorites" position="bottom">
          <button
            className={`segmented-tab ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('favorites')
              setCreating(null)
            }}
          >
            <Star size={12} />
            <span>Favorites</span>
          </button>
        </ToolTip>
      </div>

      {/* Section Header with Actions (Only rendered on 'all' tab) */}
      {activeTab === 'all' && (
        <div className="start-section-header">
          <div className="section-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isQueryActive && <h3>Search Results</h3>}
            <NoteNumbers
              count={isQueryActive ? filteredSnippets.length : allSnippets.length}
              total={allSnippets.length}
              isQueryActive={isQueryActive}
            />
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: '4px' }}>
            <ToolTip text="New Note">
              <button
                className="sort-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  const targetParent = lastClickedFolder || ''
                  setCreating({ type: 'file', parentId: targetParent })
                  if (targetParent) {
                    setExpandedFolders((prev) => new Set(prev).add(targetParent))
                  }
                }}
              >
                <FilePlus size={14} />
              </button>
            </ToolTip>
            <ToolTip text="New Folder">
              <button
                className="sort-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  const targetParent = lastClickedFolder || null
                  setCreating({ type: 'folder', parentId: targetParent })
                  if (targetParent) {
                    setExpandedFolders((prev) => new Set(prev).add(targetParent))
                  }
                }}
              >
                <FolderPlus size={14} />
              </button>
            </ToolTip>
            <ToolTip text="Refresh Explorer">
              <button
                className="sort-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  loadVault()
                }}
                disabled={isLoading}
                style={{ opacity: isLoading ? 0.5 : 1 }}
              >
                <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
              </button>
            </ToolTip>
            <ToolTip text="Collapse Folders in Explorer">
              <button className="sort-toggle-btn" onClick={collapseAllFolders}>
                <ChevronsUp size={14} />
              </button>
            </ToolTip>
          </div>
        </div>
      )}
    </div>
  )
}

export default React.memo(ExplorerHeader)
