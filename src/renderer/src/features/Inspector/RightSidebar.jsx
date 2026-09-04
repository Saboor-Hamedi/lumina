import React from 'react'
import { Info, List as ListIcon, MessageSquare, ExternalLink, History } from 'lucide-react'
import NoteDetails from './NoteDetails'
import NoteOutline from './NoteOutline'
import { LuminaChatContent } from '../AI/Lumina'
import GlobalErrorHandler from '../../components/GlobalErrorHandler'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import ToolTip from '../../components/atoms/ToolTip'
import './NoteDetails.css'

export const RightSidebar = ({
  rightSidebarTab,
  setRightSidebarTab,
  selectedSnippet,
  isLoading,
  isRightSidebarOpen,
  setIsRightSidebarOpen,
  setShowAIChatModal
}) => {
  useKeyboardShortcuts({
    onEscape: isRightSidebarOpen
      ? () => {
          setIsRightSidebarOpen(false)
          return true
        }
      : null
  })

  const updateSetting = useSettingsStore((state) => state.updateSetting)
  const aiChatDisplayMode = useSettingsStore(
    (state) => state.settings.aiChatDisplayMode || 'sidebar'
  )

  const handlePopOut = () => {
    updateSetting('aiChatDisplayMode', 'modal')
    setRightSidebarTab('details')
    if (setIsRightSidebarOpen) {
      setIsRightSidebarOpen(false)
    }
    if (setShowAIChatModal) {
      setShowAIChatModal(true)
    }
  }

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

        {aiChatDisplayMode === 'sidebar' && (
          <div
            className={`inspector-tab ${rightSidebarTab === 'chat' ? 'active' : ''}`}
            onClick={() => {
              setRightSidebarTab('chat')
              updateSetting('aiChatDisplayMode', 'sidebar')
            }}
          >
            <ToolTip text="AI Chat" position="bottom">
              <div className="tab-context">
                <MessageSquare size={13} className="tab-icon" />
                <span className="tab-title">Chat</span>
              </div>
            </ToolTip>
          </div>
        )}

        <div className="flex-1" style={{ height: '100%', pointerEvents: 'none' }} />
      </div>

      {/* Sub-header under the tabs */}
      {rightSidebarTab === 'details' && (
        <div className="inspector-sub-header">
          <span className="inspector-sub-title">Note Details</span>
          {selectedSnippet?.title && (
            <span className="inspector-sub-badge" title={selectedSnippet.title}>
              {selectedSnippet.title}
            </span>
          )}
        </div>
      )}

      {rightSidebarTab === 'outline' && (
        <div className="inspector-sub-header">
          <span className="inspector-sub-title">Note Outline</span>
          {selectedSnippet?.title && (
            <span className="inspector-sub-badge" title={selectedSnippet.title}>
              {selectedSnippet.title}
            </span>
          )}
        </div>
      )}

      {rightSidebarTab === 'chat' && (
        <div className="inspector-sub-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ToolTip text="Toggle History" position="bottom">
              <button
                className="inspector-action-btn"
                onClick={() => window.dispatchEvent(new CustomEvent('ai-toggle-history'))}
                aria-label="Toggle History"
              >
                <History size={13} />
              </button>
            </ToolTip>
            <span className="inspector-sub-title">AI Assistant</span>
          </div>
          <ToolTip text="Pop out to floating window" position="bottom-right">
            <button
              className="inspector-action-btn"
              onClick={handlePopOut}
              aria-label="Pop out to floating window"
            >
              <ExternalLink size={13} />
            </button>
          </ToolTip>
        </div>
      )}

      {/* Panel content */}
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
            <NoteOutline snippet={selectedSnippet} />
          ) : rightSidebarTab === 'chat' ? (
            <LuminaChatContent isSidebar={true} onPopOut={handlePopOut} />
          ) : (
            <NoteDetails snippet={selectedSnippet} isLoading={isLoading} />
          )}
        </GlobalErrorHandler>
      </div>
    </div>
  )
}

export default RightSidebar
