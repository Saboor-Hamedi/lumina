import React from 'react'
import { Bot, Info, List as ListIcon, History, Trash2, Maximize2 } from 'lucide-react'
import AIChatPanel from '../../AI/AIChatPanel'
import SnippetDetails from '../../Inspector/SnippetDetails'
import SnippetOutline from '../../Inspector/SnippetOutline'
import PanelHeaderDropdown from './PanelHeaderDropdown'
import ErrorBoundary from '../../../components/ErrorBoundary'
import { useAIStore } from '../../../core/store/useAIStore'
import { useToast } from '../../../core/hooks/useToast'

const TabbedSidebar = ({
  rightSidebarTab,
  setRightSidebarTab,
  setSettingsInitialTab,
  setShowSettings,
  setSavedRightSidebarState,
  isRightSidebarOpen,
  rightWidth,
  setIsRightSidebarOpen,
  setShowAIChatModal,
  selectedSnippet,
  isLoading
}) => {
  const { chatMessages, clearChat } = useAIStore()
  const { showToast } = useToast()

  return (
    <div className="inspector-panel">
      {/* Tab-style header - matches workspace tabs */}
      <div
        className="panel-header-tabs workspace-tabbar"
        style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
      >
        <div 
          className={`workspace-tab ${rightSidebarTab === 'ai' ? 'active' : ''}`}
          onClick={() => setRightSidebarTab('ai')}
          style={{ cursor: 'pointer', borderRight: '1px solid var(--border-subtle)', paddingRight: rightSidebarTab === 'ai' ? '12px' : '16px' }}
        >
          <div
            className="tab-context"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Bot size={13} style={{ opacity: rightSidebarTab === 'ai' ? 1 : 0.6 }} />
            <span className="tab-title" style={{ opacity: rightSidebarTab === 'ai' ? 1 : 0.6 }}>AI Chat</span>
            {rightSidebarTab === 'ai' && (
              <>
                <button
                  className="tab-close-btn"
                  style={{ opacity: 0.6 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    window.dispatchEvent(new CustomEvent('ai-toggle-history'))
                  }}
                  title="Toggle chat history"
                >
                  <History size={11} />
                </button>
                <button
                  className="tab-close-btn"
                  style={{ opacity: 0.6 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    try {
                      clearChat()
                      showToast('Chat cleared')
                    } catch {}
                  }}
                  title="Clear chat"
                >
                  <Trash2 size={11} />
                </button>
              </>
            )}
          </div>
        </div>
        <div 
          className={`workspace-tab ${rightSidebarTab === 'details' ? 'active' : ''}`}
          onClick={() => setRightSidebarTab('details')}
          style={{ cursor: 'pointer', borderRight: '1px solid var(--border-subtle)', paddingRight: '16px' }}
        >
          <div
            className="tab-context"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Info size={13} style={{ opacity: rightSidebarTab === 'details' ? 1 : 0.6 }} />
            <span className="tab-title" style={{ opacity: rightSidebarTab === 'details' ? 1 : 0.6 }}>Details</span>
          </div>
        </div>
        <div 
          className={`workspace-tab ${rightSidebarTab === 'outline' ? 'active' : ''}`}
          onClick={() => setRightSidebarTab('outline')}
          style={{ cursor: 'pointer', paddingRight: '16px' }}
        >
          <div
            className="tab-context"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ListIcon size={13} style={{ opacity: rightSidebarTab === 'outline' ? 1 : 0.6 }} />
            <span className="tab-title" style={{ opacity: rightSidebarTab === 'outline' ? 1 : 0.6 }}>Outline</span>
          </div>
        </div>
        {/* Right side buttons - Float and Dropdown */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0',
            marginLeft: 'auto',
            height: '32px' /* Match panel header height */,
            WebkitAppRegion: 'no-drag'
          }}
        >
          <button
            className="tab-float-btn-right"
            onClick={(e) => {
              e.stopPropagation()
              try {
                // Save current sidebar state and close it before opening modal
                setSavedRightSidebarState({
                  isOpen: isRightSidebarOpen,
                  width: rightWidth
                })
                setIsRightSidebarOpen(false)
                setShowAIChatModal(true)
              } catch (error) {
                console.error('[AppShell] Failed to float AI chat:', error)
              }
            }}
            title="Float (Open as modal)"
            aria-label="Float"
          >
            <Maximize2 size={12} />
          </button>
          <PanelHeaderDropdown
            onOpenSettings={() => {
              setSettingsInitialTab('ai')
              setShowSettings(true)
            }}
            onClearChat={() => {
              try {
                clearChat()
                showToast('Chat history cleared')
              } catch (error) {
                console.error('[AppShell] Failed to clear chat:', error)
                showToast('Failed to clear chat history')
              }
            }}
            onExportChat={() => {
              try {
                const chatData = {
                  messages: chatMessages,
                  exportedAt: new Date().toISOString(),
                  version: '1.0'
                }
                const blob = new Blob([JSON.stringify(chatData, null, 2)], {
                  type: 'application/json'
                })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `lumina-chat-${new Date().toISOString().split('T')[0]}.json`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
                showToast('Chat exported successfully')
              } catch (error) {
                console.error('[AppShell] Failed to export chat:', error)
                showToast('Failed to export chat')
              }
            }}
            onViewStats={() => {
              const stats = {
                totalMessages: chatMessages.length,
                userMessages: chatMessages.filter((m) => m.role === 'user').length,
                assistantMessages: chatMessages.filter((m) => m.role === 'assistant').length,
                totalCharacters: chatMessages.reduce(
                  (sum, m) => sum + (m.content?.length || 0),
                  0
                ),
                averageMessageLength:
                  chatMessages.length > 0
                    ? Math.round(
                        chatMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0) /
                          chatMessages.length
                      )
                    : 0
              }
              const statsText =
                `Chat Statistics:\n\n` +
                `Total Messages: ${stats.totalMessages}\n` +
                `User Messages: ${stats.userMessages}\n` +
                `Assistant Messages: ${stats.assistantMessages}\n` +
                `Total Characters: ${stats.totalCharacters.toLocaleString()}\n` +
                `Avg Message Length: ${stats.averageMessageLength} chars`
              showToast(statsText, 5000)
            }}
            chatMessagesCount={chatMessages.length}
          />
        </div>
      </div>

      {/* Panel content */}
      <div className="panel-content">
        <ErrorBoundary>
          {rightSidebarTab === 'ai' ? (
            <AIChatPanel />
          ) : rightSidebarTab === 'outline' ? (
            <SnippetOutline snippet={selectedSnippet} />
          ) : (
            <SnippetDetails snippet={selectedSnippet} isLoading={isLoading} />
          )}
        </ErrorBoundary>
      </div>
    </div>
  )
}

export default TabbedSidebar
