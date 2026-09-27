import React from 'react'
import { Info, List as ListIcon, Link2 } from 'lucide-react'
import NoteDetails from './NoteDetails'
import NoteOutline from './NoteOutline'
import Backlinks from './Backlinks'
import GlobalErrorHandler from '../../components/GlobalErrorHandler'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import ToolTip from '../../components/atoms/ToolTip'
import RightSidebarFooter from './RightSidebarFooter'
import './NoteDetails.css'
export interface RightSidebarProps {
  rightSidebarTab: string
  setRightSidebarTab: (tab: string) => void
  selectedNote?: any
  isLoading?: boolean
  isRightSidebarOpen: boolean
  setIsRightSidebarOpen: (open: boolean) => void
  setSettingsInitialTab?: (tab: string) => void
  setShowSettings?: (show: boolean) => void
  setSavedRightSidebarState?: (state: any) => void
  rightWidth?: number
  setShowAIChatModal?: (show: boolean) => void
}

export const RightSidebar: React.FC<RightSidebarProps> = React.memo(({
  rightSidebarTab,
  setRightSidebarTab,
  selectedNote,
  isLoading = false,
  isRightSidebarOpen,
  setIsRightSidebarOpen
}) => {
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  useKeyboardShortcuts({
    onEscape: isRightSidebarOpen
      ? () => {
          if (document.querySelector('.command-palette-overlay, .command-palette-container, .modal-overlay')) {
            return false
          }
          setIsRightSidebarOpen(false)
          return true
        }
      : null
  })

  // Do not execute or render anything when right sidebar is closed
  if (!isRightSidebarOpen) {
    return null
  }

  return (
    <div className="inspector-panel" ref={panelRef}>
      {/* Tab-style header */}
      <div className="panel-header-tabs inspector-tabbar">
        <div
          className={`inspector-tab ${rightSidebarTab === 'details' ? 'active' : ''}`}
          onClick={() => setRightSidebarTab('details')}
        >
          <ToolTip text="Note Details" position="bottom">
            <div className="tab-context">
              <Info size={13} className="tab-icon" />
              <span className="tab-title">Details</span>
            </div>
          </ToolTip>
        </div>

        <div
          className={`inspector-tab ${rightSidebarTab === 'outline' ? 'active' : ''}`}
          onClick={() => setRightSidebarTab('outline')}
        >
          <ToolTip text="Note Outline" position="bottom">
            <div className="tab-context">
              <ListIcon size={13} className="tab-icon" />
              <span className="tab-title">Outline</span>
            </div>
          </ToolTip>
        </div>

        <div
          className={`inspector-tab ${rightSidebarTab === 'backlinks' ? 'active' : ''}`}
          onClick={() => setRightSidebarTab('backlinks')}
        >
          <ToolTip text="Backlinks" position="bottom">
            <div className="tab-context">
              <Link2 size={13} className="tab-icon" />
              <span className="tab-title">Backlinks</span>
            </div>
          </ToolTip>
        </div>

        <div className="flex-1" style={{ height: '100%', pointerEvents: 'none' }} />
      </div>

      {/* Sub-header under the tabs */}
      <div className="inspector-body-card">
        {rightSidebarTab === 'details' && (
          <div className="inspector-sub-header">
            <span className="inspector-sub-title">Note Details</span>
            {selectedNote?.title && (
              <span className="inspector-sub-badge" title={selectedNote.title}>
                {selectedNote.title}
              </span>
            )}
          </div>
        )}

        {rightSidebarTab === 'outline' && (
          <div className="inspector-sub-header">
            <span className="inspector-sub-title">Note Outline</span>
            {selectedNote?.title && (
              <span className="inspector-sub-badge" title={selectedNote.title}>
                {selectedNote.title}
              </span>
            )}
          </div>
        )}

        {rightSidebarTab === 'backlinks' && (
          <div className="inspector-sub-header">
            <span className="inspector-sub-title">Backlinks</span>
            {selectedNote?.title && (
              <span className="inspector-sub-badge" title={selectedNote.title}>
                {selectedNote.title}
              </span>
            )}
          </div>
        )}

        <div
          className="panel-content"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
            minHeight: 0
          }}
        >
          <GlobalErrorHandler>
            {rightSidebarTab === 'outline' ? (
              <NoteOutline note={selectedNote} />
            ) : rightSidebarTab === 'backlinks' ? (
              <Backlinks note={selectedNote} />
            ) : (
              <NoteDetails note={selectedNote} isLoading={isLoading} />
            )}
          </GlobalErrorHandler>
        </div>
      </div>

      <RightSidebarFooter
        selectedNote={selectedNote}
        selectedSnippet={selectedNote}
        rightSidebarTab={rightSidebarTab}
        onClose={() => setIsRightSidebarOpen?.(false)}
      />
    </div>
  )
})

RightSidebar.displayName = 'RightSidebar'
export default RightSidebar
