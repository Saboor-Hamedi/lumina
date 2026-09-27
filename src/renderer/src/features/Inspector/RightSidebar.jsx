import React from 'react'
import { Info, List as ListIcon } from 'lucide-react'
import NoteDetails from './NoteDetails'
import NoteOutline from './NoteOutline'
import GlobalErrorHandler from '../../components/GlobalErrorHandler'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import ToolTip from '../../components/atoms/ToolTip'
import RightSidebarFooter from './RightSidebarFooter'
import './NoteDetails.css'

export const RightSidebar = React.memo(({
  rightSidebarTab,
  setRightSidebarTab,
  selectedNote,
  isLoading,
  isRightSidebarOpen,
  setIsRightSidebarOpen
}) => {
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

  return (
    <div className="inspector-panel">
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
            ) : (
              <NoteDetails note={selectedNote} isLoading={isLoading} />
            )}
          </GlobalErrorHandler>
        </div>
      </div>

      <RightSidebarFooter
        selectedNote={selectedNote}
        rightSidebarTab={rightSidebarTab}
        onClose={() => setIsRightSidebarOpen?.(false)}
      />
    </div>
  )
})

RightSidebar.displayName = 'RightSidebar'

export default RightSidebar
