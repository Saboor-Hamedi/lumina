import React from 'react'
import {
  Search,
  NotebookText,
  Star,
  FilePenLine,
  FolderInput,
  RefreshCw,
  FoldVertical
} from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import NoteNumbers from './NoteNumbers'

export interface ExplorerHeaderProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>
  displayQuery: string
  setDisplayQuery: (val: string) => void
  debounceTimerRef: React.MutableRefObject<any>
  setQuery: (val: string) => void
  setCollapsedDuringSearch: (val: Set<string>) => void
  setSelectedIndex?: (val: number) => void
  selectItemAtIndex?: (val: number) => void
  setSidebarFocus?: (val: string | null) => void
  virtuosoRef: React.RefObject<any>
  flatTree: any[]
  selectedIndex: number
  handleSelect: (item: any) => void
  toggleFolder: (id: string) => void
  activeTab: string
  setActiveTab: (tab: string) => void
  setCreating: (val: { type: 'file' | 'folder'; parentId?: string | null } | null) => void
  isQueryActive: boolean
  filteredSnippets: any[]
  allSnippets: any[]
  lastClickedFolder?: string | null
  setExpandedFolders: (fn: (prev: Set<string>) => Set<string>) => void
  loadWorkspace: () => void
  isLoading?: boolean
  collapseAllFolders: () => void
}

export const ExplorerHeader: React.FC<ExplorerHeaderProps> = ({
  searchInputRef,
  displayQuery,
  setDisplayQuery,
  debounceTimerRef,
  setQuery,
  setCollapsedDuringSearch,
  setSelectedIndex,
  selectItemAtIndex,
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
  loadWorkspace,
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
            if (displayQuery.trim() && setSidebarFocus) {
              setSidebarFocus('note')
            }
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (displayQuery.trim() && setSidebarFocus) {
              setSidebarFocus('note')
            }
          }}
          onChange={(e) => {
            const v = e.target.value
            setDisplayQuery(v)
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = setTimeout(() => {
              setQuery(v)
              setCollapsedDuringSearch(new Set())
            }, 120)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (!flatTree || flatTree.length === 0) return
              const next = selectedIndex < 0 ? 0 : Math.min(selectedIndex + 1, flatTree.length - 1)
              if (selectItemAtIndex) {
                selectItemAtIndex(next)
              } else {
                setSelectedIndex?.(next)
              }
              virtuosoRef.current?.scrollToIndex({ index: next, align: 'center' })
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              if (!flatTree || flatTree.length === 0) return
              const next = Math.max(selectedIndex - 1, 0)
              if (selectItemAtIndex) {
                selectItemAtIndex(next)
              } else {
                setSelectedIndex?.(next)
              }
              virtuosoRef.current?.scrollToIndex({ index: next, align: 'center' })
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
            type="button"
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
            type="button"
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
                type="button"
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
                <FilePenLine size={14} />
              </button>
            </ToolTip>
            <ToolTip text="New Folder">
              <button
                type="button"
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
                <FolderInput size={14} />
              </button>
            </ToolTip>
            <ToolTip text="Refresh Explorer">
              <button
                type="button"
                className="sort-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  loadWorkspace()
                }}
                disabled={isLoading}
                style={{ opacity: isLoading ? 0.5 : 1 }}
              >
                <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
              </button>
            </ToolTip>
            <ToolTip text="Collapse Folders in Explorer">
              <button type="button" className="sort-toggle-btn" onClick={collapseAllFolders}>
                <FoldVertical size={14} />
              </button>
            </ToolTip>
          </div>
        </div>
      )}
    </div>
  )
}

export default React.memo(ExplorerHeader)
