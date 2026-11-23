import React from 'react'
import NoteDetails from './NoteDetails'
import NoteOutline from './NoteOutline'
import Backlinks from './Backlinks'
import GlobalErrorHandler from '../../components/GlobalErrorHandler'
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

  return (
    <div className="inspector-panel" ref={panelRef} aria-hidden={!isRightSidebarOpen}>
      {/* Sub-header */}
      <div className="inspector-body-card">
        {rightSidebarTab === 'details' && (
          <div className="inspector-sub-header">
            <span className="inspector-sub-title">Note Details</span>
          </div>
        )}

        {rightSidebarTab === 'outline' && (
          <div className="inspector-sub-header">
            <span className="inspector-sub-title">Note Outline</span>
          </div>
        )}

        {rightSidebarTab === 'backlinks' && (
          <div className="inspector-sub-header">
            <span className="inspector-sub-title">Backlinks</span>
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
