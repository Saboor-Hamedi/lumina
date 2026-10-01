/**
 * AppModals.tsx
 * 
 * Global Floating Dialogs, Modals, and Overlay Layer for Lumina.
 * 
 * Architecture & Responsibilities:
 * - Decouples all application-level floating modals from MainLayout.
 * - Centralizes modal state transitions and handlers for:
 *     1. Settings Modal (general app preferences, look & feel, editor settings)
 *     2. Theme Modal (theme picker & custom CSS styling)
 *     3. Lumina AI Chat Modal (floating AI assistant with docking capabilities)
 *     4. Command Palette (quick search, switcher, actions, shortcuts)
 *     5. Graph View Modal (interactive 2D/3D knowledge graph)
 *     6. Documentation & Quick Guide Modals (user help, starter templates)
 *     7. Delete Confirmation Modal (destructive note deletion prompt)
 *     8. Rename Modal (renaming notes and folders)
 *     9. Icon Picker Modal (custom note icon selection)
 *    10. Toast Notifications (system alert messages)
 *    11. Background services UI (Indexing progress & Voice Capsule)
 * - Uses React.memo to prevent unnecessary re-renders when editor keystrokes occur in MainLayout.
 */

import React from 'react'
import { CommandPalette } from '../commandpalette'
import Confirm from '../modals/Confirm'
import Rename from '../modals/Rename'
import IconPicker from '../Icons/IconPicker'
import ToastNotification from '../../core/notification'
import Indexing from '../../components/Indexing'
import { VoiceCapsule } from '../voice'

import GlobalErrorHandler from '../../components/GlobalErrorHandler'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { renameNote } from '../../core/hooks/renameNote'

// Lazy-load heavy modals and panels to optimize initial bundle evaluation time
const LuminaChat = React.lazy(() => import('../AI/Lumina'))
const Settings = React.lazy(() => import('../Settings/Settings'))
const Theme = React.lazy(() => import('../theme/Theme'))
const Documentation = React.lazy(() => import('../Docs/Documentation'))
const Graph = React.lazy(() => import('../graph/Graph'))
const Guide = React.lazy(() => import('../modals/Guide'))
const CanvasDrawerModal = React.lazy(() => import('../canvas/CanvasDrawerModal'))

export interface RenameModalState {
  isOpen: boolean
  item?: any
  newName: string
}

export interface AppModalsProps {
  showSettings: boolean
  setShowSettings: (val: boolean) => void
  settingsInitialTab: string
  setSettingsInitialTab: (tab: string) => void
  showThemeModal: boolean
  setShowThemeModal: (val: boolean) => void
  showAIChatModal: boolean
  setShowAIChatModal: (val: boolean) => void
  setSavedRightSidebarState: (state: any) => void
  setRightSidebarTab: (tab: any) => void
  updateRightSidebarOpen: (open: boolean) => void
  showPalette: boolean
  setShowPalette: (val: boolean) => void
  paletteInitialQuery: string
  snippets: any[]
  selectedSnippet: any
  setSelectedSnippet: (snippet: any) => void
  setActiveTab: (tab: string) => void
  handleNew: () => void
  renameModal: RenameModalState
  setRenameModal: (modal: RenameModalState) => void
  showGraph: boolean
  setShowGraph: (val: boolean) => void
  showDocsModal: boolean
  setShowDocsModal: (val: boolean) => void
  showGuideModal: boolean
  setShowGuideModal: (val: boolean) => void
  handleLoadStarterWorkspace: () => Promise<void>
  showDeleteConfirm: boolean
  setShowDeleteConfirm: (val: boolean) => void
  snippetToDelete: any
  handleConfirmDelete: () => void
  saveSnippet: (snippet: any) => Promise<any> | void
  loadWorkspace: () => Promise<void> | void
  showToast: (msg: string, type?: any, duration?: number) => void
  showActiveIconPicker: boolean
  setShowActiveIconPicker: (val: boolean) => void
  activeTabId: string | null
  toast: any
  clearToast: () => void
}

export const AppModals: React.FC<AppModalsProps> = ({
  showSettings,
  setShowSettings,
  settingsInitialTab,
  setSettingsInitialTab,
  showThemeModal,
  setShowThemeModal,
  showAIChatModal,
  setShowAIChatModal,
  setSavedRightSidebarState,
  showPalette,
  setShowPalette,
  paletteInitialQuery,
  snippets,
  selectedSnippet,
  setSelectedSnippet,
  setActiveTab,
  handleNew,
  renameModal,
  setRenameModal,
  showGraph,
  setShowGraph,
  showDocsModal,
  setShowDocsModal,
  showGuideModal,
  setShowGuideModal,
  handleLoadStarterWorkspace,
  showDeleteConfirm,
  setShowDeleteConfirm,
  snippetToDelete,
  handleConfirmDelete,
  saveSnippet,
  loadWorkspace,
  showToast,
  showActiveIconPicker,
  setShowActiveIconPicker,
  activeTabId,
  toast,
  clearToast
}) => {
  // Preload settings bundle during idle time to eliminate modal opening latency
  React.useEffect(() => {
    const idleId =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? window.requestIdleCallback(() => {
            import('../Settings/Settings').catch(() => {})
          })
        : setTimeout(() => {
            import('../Settings/Settings').catch(() => {})
          }, 800)

    return () => {
      if (
        typeof window !== 'undefined' &&
        'cancelIdleCallback' in window &&
        typeof idleId === 'number'
      ) {
        window.cancelIdleCallback(idleId)
      } else {
        clearTimeout(idleId as any)
      }
    }
  }, [])

  return (
    <>
      {/* Settings Modal */}
      {showSettings && (
        <React.Suspense fallback={null}>
          <Settings
            onClose={() => {
              setShowSettings(false)
              setSettingsInitialTab('look-and-feel')
            }}
            onOpenTheme={() => {
              setShowSettings(false)
              setShowThemeModal(true)
            }}
            initialTab={settingsInitialTab}
          />
        </React.Suspense>
      )}

      {/* Theme Customizer Modal */}
      {showThemeModal && (
        <React.Suspense fallback={null}>
          <Theme isOpen={showThemeModal} onClose={() => setShowThemeModal(false)} />
        </React.Suspense>
      )}

      {/* Floating AI Chat Assistant (Dockable into right sidebar) */}
      {showAIChatModal && (
        <GlobalErrorHandler>
          <React.Suspense fallback={null}>
            <LuminaChat
              isOpen={showAIChatModal}
              onClose={() => {
                setShowAIChatModal(false)
                setSavedRightSidebarState(null)
              }}
            />
          </React.Suspense>
        </GlobalErrorHandler>
      )}

      {/* Universal Command Palette / Quick Switcher */}
      <CommandPalette
        isOpen={showPalette}
        initialQuery={paletteInitialQuery}
        onClose={() => setShowPalette(false)}
        items={snippets}
        onSelect={(snippet) => {
          setSelectedSnippet(snippet)
          setActiveTab('files')
        }}
        onNew={handleNew}
        onToggleSettings={(tab) => {
          setSettingsInitialTab(tab || 'look-and-feel')
          setShowSettings(true)
        }}
        onToggleGraph={() => setShowGraph(true)}
        onToggleChat={() => setShowAIChatModal(true)}
        onToggleDocs={() => setShowDocsModal(true)}
        onRename={() => {
          if (selectedSnippet) {
            setRenameModal({ isOpen: true, item: selectedSnippet, newName: selectedSnippet.title })
          }
        }}
      />

      {/* Interactive 2D/3D Knowledge Graph */}
      {showGraph && (
        <GlobalErrorHandler>
          <React.Suspense fallback={null}>
            <Graph
              isOpen={showGraph}
              onClose={() => {
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem('lumina_graph_display_mode', 'modal')
                }
                setShowGraph(false)
              }}
              onNavigate={(snippet: any) => {
                setSelectedSnippet(snippet)
                setActiveTab('files')
                setShowGraph(false)
              }}
            />
          </React.Suspense>
        </GlobalErrorHandler>
      )}

      {/* Help & Documentation Modal */}
      {showDocsModal && (
        <React.Suspense fallback={null}>
          <Documentation isOpen={showDocsModal} onClose={() => setShowDocsModal(false)} />
        </React.Suspense>
      )}

      {/* Onboarding Starter Guide */}
      {showGuideModal && (
        <React.Suspense fallback={null}>
          <Guide
            isOpen={showGuideModal}
            onClose={() => setShowGuideModal(false)}
            onLoadStarterNotes={handleLoadStarterWorkspace}
            onOpenDocs={() => setShowDocsModal(true)}
          />
        </React.Suspense>
      )}

      {/* Delete Item Confirmation Dialog */}
      {showDeleteConfirm && (
        <Confirm
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleConfirmDelete}
          title="Delete Note?"
          message={`Are you sure you want to delete "${snippetToDelete?.title || 'this note'}"? This cannot be undone.`}
        />
      )}

      {/* Note & Folder Rename Dialog */}
      <Rename
        isOpen={renameModal.isOpen}
        initialName={renameModal.newName}
        itemType={renameModal.item?.type === 'folder' ? 'folder' : 'note'}
        onClose={() => setRenameModal({ isOpen: false, item: null, newName: '' })}
        onRename={async (newName: string) => {
          if (renameModal.item?.type === 'folder') {
            const folderId = renameModal.item.id
            const parentPath = folderId.includes('/')
              ? folderId.substring(0, folderId.lastIndexOf('/'))
              : ''
            const newFolderPath = parentPath ? `${parentPath}/${newName}` : newName
            if (newFolderPath !== folderId) {
              try {
                await (window as any).api.renameFolder(folderId, newFolderPath)
                useWorkspaceStore.getState().setSelectedFolder(newFolderPath)
                await loadWorkspace()
              } catch (err) {
                console.error('Failed to rename folder:', err)
                showToast('❌ Failed to rename folder', 'error')
              }
            }
            setRenameModal({ isOpen: false, item: null, newName: '' })
          } else {
            renameNote({
              renameModal: { ...renameModal, newName },
              saveNote: saveSnippet,
              saveSnippet,
              setSelectedNote: setSelectedSnippet,
              setSelectedSnippet,
              setRenameModal,
              setIsCreatingSnippet: () => {},
              showToast
            } as any)
          }
        }}
      />

      {/* Note Icon Picker */}
      {showActiveIconPicker && (
        <IconPicker
          isOpen={showActiveIconPicker}
          onClose={() => setShowActiveIconPicker(false)}
          currentIcon={(selectedSnippet || snippets.find((s) => s.id === activeTabId))?.customIcon}
          onSelect={(iconName: string) => {
            const active = selectedSnippet || snippets.find((s) => s.id === activeTabId)
            if (active) {
              saveSnippet({ ...active, customIcon: iconName })
            }
          }}
        />
      )}

      {/* System Toast Alerts */}
      <ToastNotification toast={toast} onClose={clearToast} />

      {/* Background Indexing Indicator */}
      <Indexing />

      {/* Voice Capsule Recording Assistant */}
      <VoiceCapsule />

      {/* Spatial Canvas Slide-up Drawer Modal */}
      <React.Suspense fallback={null}>
        <CanvasDrawerModal />
      </React.Suspense>
    </>
  )
}

export default React.memo(AppModals)
