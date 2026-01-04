import React, { useState, useEffect } from 'react'
import TitleBar from './TitleBar'
import ActivityBar from '../Navigation/ActivityBar'
import FileExplorer from '../Navigation/FileExplorer'
import MarkdownEditor from '../Workspace/MarkdownEditor'
import SettingsModal from '../Overlays/SettingsModal'
import CommandPalette from '../Overlays/CommandPalette'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import './AppShell.css'

const AppShell = () => {
  const { 
    snippets, 
    selectedSnippet, 
    setSelectedSnippet, 
    saveSnippet, 
    isLoading,
    loadVault
  } = useVaultStore()

  const [activeTab, setActiveTab] = useState('files')
  const [showSettings, setShowSettings] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false)

  // Initialize vault & settings on mount
  // Initialize vault & settings on mount
  useEffect(() => {
    loadVault().then(() => {
      // Restore last open note
      const { settings } = useSettingsStore.getState()
      if (settings.lastSnippetId) {
        // We need to wait for snippets to load... loadVault loads them.
        // We can access fresh snippets via useVaultStore.getState().snippets
        const allSnippets = useVaultStore.getState().snippets
        const last = allSnippets.find(s => s.id === settings.lastSnippetId)
        if (last) {
           setSelectedSnippet(last)
        }
      }
    })
    useSettingsStore.getState().init()
  }, [])

  // Persist Last Snippet
  useEffect(() => {
    if (selectedSnippet) {
      useSettingsStore.getState().updateSetting('lastSnippetId', selectedSnippet.id)
    }
  }, [selectedSnippet?.id])

  useKeyboardShortcuts({
    onEscape: () => {
      if (showPalette) {
        setShowPalette(false)
        return true
      }
      return false
    },
    onTogglePalette: () => {
      setShowPalette(true)
    }
  })

  const handleNew = async () => {
    const newSnippet = {
      id: crypto.randomUUID(),
      title: 'New Note',
      code: '',
      language: 'markdown',
      tags: '',
      timestamp: Date.now()
    }
    await saveSnippet(newSnippet)
    setSelectedSnippet(newSnippet)
    setActiveTab('files')
  }

  return (
    <div className={`app-shell ${isLeftSidebarOpen ? 'left-open' : 'left-closed'} ${isRightSidebarOpen ? 'right-open' : 'right-closed'}`}>
      <header className="shell-header">
        <TitleBar />
      </header>

      <nav className="shell-ribbon">
        <ActivityBar 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          onSettingsClick={() => setShowSettings(true)}
        />
      </nav>

      <aside className="shell-sidebar-left">
        <FileExplorer />
      </aside>

      <main className="shell-main">
        {selectedSnippet ? (
          <MarkdownEditor 
            snippet={selectedSnippet} 
            onSave={saveSnippet} 
            onToggleInspector={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          />
        ) : (
          <div className="welcome-placeholder">
            <div className="welcome-hero">
              <h1 className="hero-title">Lumina</h1>
              <p className="hero-subtitle">Your personal knowledge vault.</p>
              <button className="btn btn-primary big-new-btn" onClick={handleNew}>Create New Note</button>
            </div>
          </div>
        )}
      </main>

      <aside className="shell-sidebar-right">
        <div className="inspector-panel">
          <div className="panel-header">Metadata & Stats</div>
          <div className="panel-content">
            {isLoading ? (
              <div className="skeleton-inspector">
                <div className="skeleton skeleton-text" style={{ width: '40%', marginBottom: '12px' }} />
                <div className="skeleton skeleton-text" style={{ width: '80%', marginBottom: '12px' }} />
                <div className="skeleton skeleton-text" style={{ width: '60%' }} />
              </div>
            ) : selectedSnippet ? (
              <div className="meta-info">
                <div className="meta-section">
                  <div className="meta-label">Properties</div>
                  <div className="meta-row">
                    <span>Modified</span>
                    <span className="meta-value">{new Date(selectedSnippet.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className="meta-row">
                    <span>Type</span>
                    <span className="meta-value badge">{selectedSnippet.language}</span>
                  </div>
                  <div className="meta-row">
                    <span>Location</span>
                    <span className="meta-value path-hint" title={useSettingsStore.getState().settings.vaultPath || 'Default'}>
                      {(useSettingsStore.getState().settings.vaultPath || 'Default Vault').split(/[\\\/]/).pop()}
                    </span>
                  </div>
                </div>

                <div className="meta-separator" />

                <div className="meta-section">
                  <div className="meta-label">Statistics</div>
                  <div className="meta-grid">
                    <div className="stat-box">
                      <div className="stat-value">{selectedSnippet.code?.length || 0}</div>
                      <div className="stat-label">Chars</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-value">
                        {selectedSnippet.code?.trim() ? selectedSnippet.code.trim().split(/\s+/).length : 0}
                      </div>
                      <div className="stat-label">Words</div>
                    </div>
                    <div className="stat-box">
                      <div className="stat-value">
                        {Math.ceil((selectedSnippet.code?.trim().split(/\s+/).length || 0) / 200)}m
                      </div>
                      <div className="stat-label">Read</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="panel-empty">No file selected</div>
            )}
          </div>
        </div>
      </aside>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      <CommandPalette 
        isOpen={showPalette} 
        onClose={() => setShowPalette(false)} 
        items={snippets}
        onSelect={setSelectedSnippet}
      />
    </div>
  )
}

export default AppShell
