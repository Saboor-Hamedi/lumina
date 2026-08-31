import React from 'react'
import { Info, List as ListIcon, MessageSquare, ExternalLink, PanelLeftClose } from 'lucide-react'
import SnippetDetails from './SnippetDetails'
import SnippetOutline from './SnippetOutline'
import { LuminaChatContent } from '../AI/LuminaChat'
import ErrorBoundary from '../../components/ErrorBoundary'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import './SnippetDetails.css'

const TabbedSidebar = ({
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
      <div className="panel-header-tabs workspace-tabbar">
        <div
          className={`workspace-tab ${rightSidebarTab === 'details' ? 'active' : ''}`}
          onClick={() => setRightSidebarTab('details')}
        >
          <div className="tab-context">
            <Info size={13} className="tab-icon" />
            <span className="tab-title">Details</span>
          </div>
        </div>

        <div
          className={`workspace-tab ${rightSidebarTab === 'outline' ? 'active' : ''}`}
          onClick={() => setRightSidebarTab('outline')}
        >
          <div className="tab-context">
            <ListIcon size={13} className="tab-icon" />
            <span className="tab-title">Outline</span>
          </div>
        </div>

        {aiChatDisplayMode === 'sidebar' && (
          <div
            className={`workspace-tab ${rightSidebarTab === 'chat' ? 'active' : ''}`}
            onClick={() => {
              setRightSidebarTab('chat')
              updateSetting('aiChatDisplayMode', 'sidebar')
            }}
          >
            <div className="tab-context">
              <MessageSquare size={13} className="tab-icon" />
              <span className="tab-title">Chat</span>
            </div>
          </div>
        )}

        <div className="flex-1" style={{ WebkitAppRegion: 'drag', height: '100%' }} />
      </div>

      {/* Sub-header under the tabs — consistent 28px height across all tabs */}
      {rightSidebarTab === 'details' && (
        <div className="inspector-sub-header">
          <span className="inspector-sub-title">File Details</span>
          {selectedSnippet?.title && (
            <span className="inspector-sub-badge" title={selectedSnippet.title}>
              {selectedSnippet.title}
            </span>
          )}
        </div>
      )}

      {rightSidebarTab === 'outline' && (
        <div className="inspector-sub-header">
          <span className="inspector-sub-title">Document Outline</span>
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
            <button
              className="inspector-action-btn"
              onClick={() => window.dispatchEvent(new CustomEvent('ai-toggle-history'))}
              title="Toggle History"
              aria-label="Toggle History"
            >
              <PanelLeftClose size={13} />
            </button>
            <span className="inspector-sub-title">AI Assistant</span>
          </div>
          <button
            className="inspector-action-btn"
            onClick={handlePopOut}
            title="Pop out to floating window"
            aria-label="Pop out to floating window"
          >
            <ExternalLink size={13} />
          </button>
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
        <ErrorBoundary>
          {rightSidebarTab === 'outline' ? (
            <SnippetOutline snippet={selectedSnippet} />
          ) : rightSidebarTab === 'chat' ? (
            <LuminaChatContent isSidebar={true} onPopOut={handlePopOut} />
          ) : (
            <SnippetDetails snippet={selectedSnippet} isLoading={isLoading} />
          )}
        </ErrorBoundary>
      </div>
    </div>
  )
}

export default TabbedSidebar
