import { useCallback, useEffect, useRef } from 'react'
import { openSidebarView } from '../../Navigation/sidebarViewStore'
import { createUntitledSnippet } from '../../Breadcrumbs/utils/breadcrumbUtils'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { useSettingsStore } from '../../../core/store/SettingStore'
import { populateStarterWorkspace } from '../../../core/utils/starterWorkspace'
import type { ToastType } from '../../../core/notification'

export function isCanvasNote(note: any): boolean {
  return Boolean(
    note &&
      (note.type === 'canvas' || note.language === 'canvas' || note.fileName?.endsWith('.canvas'))
  )
}

export interface UseWorkspaceActionsOptions {
  selectedSnippet: any
  saveSnippet: (note: any) => Promise<any>
  setSelectedSnippet: (note: any) => void
  setActiveTab: (tab: string) => void
  setShowPalette: (show: boolean) => void
  setShowSettings: (show: boolean) => void
  setShowDocsModal: (show: boolean) => void
  setShowExplorerModal: React.Dispatch<React.SetStateAction<boolean>>
  setShowAIChatModal: React.Dispatch<React.SetStateAction<boolean>>
  snippetToDelete: any
  setSnippetToDelete: (note: any) => void
  showToast: (message: string, type?: ToastType) => void
}

export function useWorkspaceActions({
  selectedSnippet,
  saveSnippet,
  setSelectedSnippet,
  setActiveTab,
  setShowPalette,
  setShowSettings,
  setShowDocsModal,
  setShowExplorerModal,
  setShowAIChatModal,
  snippetToDelete,
  setSnippetToDelete,
  showToast
}: UseWorkspaceActionsOptions) {
  const handleOpenOrCreateCanvasTabRef = useRef<() => void>(() => {})

  const handleNew = useCallback(async () => {
    try {
      const ws = useWorkspaceStore.getState() as any
      const targetFolder: string = ws?.selectedFolder || selectedSnippet?.folderId || ''

      const notes: any[] = ws?.notes || []
      const newSnippet: any = createUntitledSnippet(targetFolder, notes)
      await saveSnippet(newSnippet)

      // Activate the new note exactly like an explorer click: expand target
      // folder without marking it selected, then select the note in the tree
      if (targetFolder) {
        window.dispatchEvent(
          new CustomEvent('reveal-folder-in-explorer', {
            detail: { folderId: targetFolder, select: false }
          })
        )
      }
      useWorkspaceStore.getState().setSelectedFolder(null)
      setSelectedSnippet(newSnippet)
      window.dispatchEvent(
        new CustomEvent('select-note-in-explorer', {
          detail: { noteId: newSnippet.id }
        })
      )
      setActiveTab('files')
      setShowPalette(false)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('focus-editor-start'))
      }, 50)
    } catch (error) {
      console.error('[MainLayout] Failed to create new note:', error)
      showToast('Failed to create note. Please try again.', 'error')
    }
  }, [selectedSnippet, saveSnippet, setSelectedSnippet, setActiveTab, setShowPalette, showToast])

  const handleNewCanvas = useCallback(async () => {
    try {
      const existingNotes: any[] = useWorkspaceStore.getState().notes || []
      const takenPaths = new Set(
        existingNotes.map((n: any) =>
          String(n?.relativePath || n?.fileName || n?.id || '').toLowerCase()
        )
      )
      let baseTitle = 'Untitled Canvas'
      let fileName = `${baseTitle}.canvas`
      let suffix = 2
      while (takenPaths.has(fileName.toLowerCase())) {
        baseTitle = `Untitled Canvas ${suffix}`
        fileName = `${baseTitle}.canvas`
        suffix += 1
      }

      const defaultCanvasData = {
        nodes: [
          {
            id: `node-${Date.now()}`,
            type: 'text',
            title: 'Idea Board',
            text: 'Welcome to Lumina Canvas! Double-click to add ideas or connect cards.',
            x: 120,
            y: 120,
            width: 260,
            height: 160,
            color: 'default'
          }
        ],
        edges: [],
        strokes: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
      const newSnippet = {
        // Canonical relativePath ID matches the disk scanner 1:1 so workspace reloads never close the tab
        id: fileName,
        title: baseTitle,
        fileName,
        relativePath: fileName,
        code: JSON.stringify(defaultCanvasData, null, 2),
        language: 'canvas',
        type: 'canvas',
        tags: '',
        folderId: '',
        timestamp: Date.now(),
        isPinned: false,
        isLearned: false
      }
      // Optimistically insert into workspace store & open immediately (0ms perceived latency)
      useWorkspaceStore.setState((state: any) => {
        const currentNotes = state.notes || []
        if (currentNotes.some((n: any) => n.id === newSnippet.id)) return state
        return { notes: [...currentNotes, newSnippet] }
      })
      setSelectedSnippet(newSnippet)
      setActiveTab('files')
      setShowPalette(false)

      // Persist to disk in the background
      void saveSnippet(newSnippet).catch((error) => {
        console.error('[MainLayout] Failed to persist new canvas:', error)
        showToast('Failed to save canvas. Please try again.', 'error')
      })
    } catch (error) {
      console.error('[MainLayout] Failed to create new canvas:', error)
      showToast('Failed to create canvas. Please try again.', 'error')
    }
  }, [saveSnippet, setSelectedSnippet, setActiveTab, setShowPalette, showToast])

  const handleOpenOrCreateCanvasTab = useCallback(async () => {
    try {
      const state = useWorkspaceStore.getState()
      const allNotes = state.notes || (state as any).snippets || []

      // 1. Is the currently active tab already a canvas?
      const currentActive = allNotes.find((n: any) => n.id === state.activeTabId)
      if (isCanvasNote(currentActive)) {
        return
      }

      // 2. Is there an open canvas in openTabs?
      const openCanvasId = state.openTabs.find((tabId: string) => {
        const note = allNotes.find((n: any) => n.id === tabId)
        return isCanvasNote(note)
      })

      if (openCanvasId) {
        const targetNote = allNotes.find((n: any) => n.id === openCanvasId)
        if (targetNote) {
          state.setSelectedNote(targetNote)
          setActiveTab('files')
          return
        }
      }

      // 3. No canvas tab is currently open — create a fresh new canvas
      await handleNewCanvas()
    } catch (err) {
      console.error('[MainLayout] Failed to open or create canvas tab:', err)
    }
  }, [handleNewCanvas, setActiveTab])

  useEffect(() => {
    handleOpenOrCreateCanvasTabRef.current = handleOpenOrCreateCanvasTab
  }, [handleOpenOrCreateCanvasTab])

  const handleConfirmDelete = useCallback(async () => {
    if (snippetToDelete) {
      try {
        await useWorkspaceStore.getState().deleteNote(snippetToDelete.id, true)
        setSnippetToDelete(null)
      } catch (error) {
        console.error('[MainLayout] Failed to delete snippet:', error)
        showToast('Failed to delete note. Please try again.', 'error')
      }
    }
  }, [snippetToDelete, setSnippetToDelete, showToast])

  const handleLoadStarterWorkspace = useCallback(async () => {
    try {
      const created = await populateStarterWorkspace((snippet: any) => saveSnippet(snippet))
      if (created && created.length > 0) {
        const welcomeSnippet = created.find((s: any) => s.id === 'starter-welcome') || created[0]
        setSelectedSnippet(welcomeSnippet)
        setActiveTab('files')
      }
    } catch (error) {
      console.error('[MainLayout] Failed to populate starter workspace:', error)
      showToast('Failed to load starter notes', 'error')
    }
  }, [saveSnippet, setSelectedSnippet, setActiveTab, showToast])

  const handleOpenSettings = useCallback(() => setShowSettings(true), [setShowSettings])
  const handleOpenTheme = useCallback(() => openSidebarView('theme'), [])
  const handleToggleGraph = useCallback(() => {
    useWorkspaceStore.getState().openGraphTab()
  }, [])
  const handleOpenDocs = useCallback(() => setShowDocsModal(true), [setShowDocsModal])
  const handleToggleExplorerModal = useCallback(
    () => setShowExplorerModal((prev) => !prev),
    [setShowExplorerModal]
  )
  const handleToggleAIChat = useCallback(() => {
    const currentMode =
      (useSettingsStore.getState().settings as any)?.aiChatDisplayMode || 'sidebar'
    if (currentMode === 'modal') {
      setShowAIChatModal((prev) => !prev)
    } else {
      useWorkspaceStore.getState().openLuminaTab()
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('focus-ai-composer'))
    }, 50)
  }, [setShowAIChatModal])

  return {
    handleNew,
    handleNewCanvas,
    handleOpenOrCreateCanvasTab,
    handleOpenOrCreateCanvasTabRef,
    handleConfirmDelete,
    handleLoadStarterWorkspace,
    handleOpenSettings,
    handleOpenTheme,
    handleToggleGraph,
    handleOpenDocs,
    handleToggleExplorerModal,
    handleToggleAIChat
  }
}
