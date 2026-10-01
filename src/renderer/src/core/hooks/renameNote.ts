/**
 * renameNote.ts
 *
 * Core rename engine for Lumina notes, folders, PDFs, and image assets.
 * Handles in-place filesystem moves for media files and optimistic updates with revert on failure.
 */

import { useWorkspaceStore } from '../store/workspaceStore'

export interface RenameModalData {
  isOpen: boolean
  item: any
  newName?: string
}

export interface RenameNoteParams {
  renameModal: RenameModalData
  saveNote?: (snippet: any) => Promise<any> | void
  saveSnippet?: (snippet: any) => Promise<any> | void
  setSelectedNote?: (snippet: any) => void
  setSelectedSnippet?: (snippet: any) => void
  setRenameModal: (modal: { isOpen: boolean; item: any; newName?: string }) => void
  setIsCreatingSnippet?: (isCreating: boolean) => void
  showToast?: (message: string, type?: 'info' | 'error' | 'success') => void
}

export const renameNote = async ({
  renameModal,
  saveNote,
  saveSnippet,
  setSelectedNote,
  setSelectedSnippet,
  setRenameModal,
  setIsCreatingSnippet,
  showToast
}: RenameNoteParams): Promise<void> => {
  if (!renameModal.item) {
    if (showToast) showToast('❌ Cannot rename: No note selected.', 'error')
    setRenameModal({ isOpen: false, item: null })
    return
  }

  const item = renameModal.item
  const baseName = (renameModal.newName || item.title || '').trim() || 'Untitled'

  // If nothing changed, skip saving and close modal
  if (item.title === baseName) {
    if (showToast) showToast('No changes', 'info')
    setRenameModal({ isOpen: false, item: null })
    if (setIsCreatingSnippet) setIsCreatingSnippet(false)
    return
  }

  // --- PDF Rename Handling (In-place workspace rename, no duplication) ---
  if (item.type === 'pdf') {
    const base = baseName.replace(/\.[^/.]+$/, '').trim() || 'Untitled'
    const targetFileName = `${base}.pdf`
    const normFolder = (item.folderId || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    const oldRel = item.relativePath || (normFolder ? `${normFolder}/${item.fileName}` : item.fileName)
    const newRel = normFolder ? `${normFolder}/${targetFileName}` : targetFileName

    if (oldRel === newRel) {
      setRenameModal({ isOpen: false, item: null })
      if (setIsCreatingSnippet) setIsCreatingSnippet(false)
      return
    }

    try {
      const api = (window as any).api
      await api?.moveFile?.(oldRel, newRel)
      const loadWorkspace = useWorkspaceStore.getState().loadWorkspace
      await loadWorkspace?.()

      const freshSnippets = useWorkspaceStore.getState().notes || []
      const newSnippet = freshSnippets.find(
        (s: any) =>
          s.relativePath === newRel ||
          (s.fileName === targetFileName && (s.folderId || '') === (item.folderId || ''))
      )

      if (newSnippet) {
        useWorkspaceStore.setState((state: any) => {
          const nextTabs = state.openTabs.map((tid: string) => (tid === item.id ? newSnippet.id : tid))
          const nextActiveId = state.activeTabId === item.id ? newSnippet.id : state.activeTabId
          const nextPinned = state.pinnedTabIds.map((pid: string) => (pid === item.id ? newSnippet.id : pid))
          return {
            openTabs: nextTabs,
            activeTabId: nextActiveId,
            pinnedTabIds: nextPinned,
            selectedNote: newSnippet
          }
        })
      }
    } catch (err: any) {
      console.error('Failed to rename PDF:', err)
      if (showToast) showToast(err?.message || '❌ Failed to rename PDF.', 'error')
    } finally {
      setRenameModal({ isOpen: false, item: null })
      if (setIsCreatingSnippet) setIsCreatingSnippet(false)
    }
    return
  }

  // --- Image Rename Handling (In-place workspace rename, no duplication) ---
  if (item.type === 'image') {
    const ext = item.ext || (item.fileName ? `.${item.fileName.split('.').pop()}` : '')
    let targetFileName = baseName.trim()
    if (ext && !targetFileName.toLowerCase().endsWith(ext.toLowerCase())) {
      targetFileName = `${targetFileName}${ext}`
    }
    const normFolder = (item.folderId || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    const oldRel = item.relativePath || (normFolder ? `${normFolder}/${item.fileName}` : item.fileName)
    const newRel = normFolder ? `${normFolder}/${targetFileName}` : targetFileName

    if (oldRel === newRel) {
      setRenameModal({ isOpen: false, item: null })
      if (setIsCreatingSnippet) setIsCreatingSnippet(false)
      return
    }

    try {
      const api = (window as any).api
      await api?.moveFile?.(oldRel, newRel)
      const loadWorkspace = useWorkspaceStore.getState().loadWorkspace
      await loadWorkspace?.()

      const freshSnippets = useWorkspaceStore.getState().notes || []
      const newSnippet = freshSnippets.find(
        (s: any) =>
          s.relativePath === newRel ||
          (s.fileName === targetFileName && (s.folderId || '') === (item.folderId || ''))
      )

      if (newSnippet) {
        useWorkspaceStore.setState((state: any) => {
          const nextTabs = state.openTabs.map((tid: string) => (tid === item.id ? newSnippet.id : tid))
          const nextActiveId = state.activeTabId === item.id ? newSnippet.id : state.activeTabId
          const nextPinned = state.pinnedTabIds.map((pid: string) => (pid === item.id ? newSnippet.id : pid))
          return {
            openTabs: nextTabs,
            activeTabId: nextActiveId,
            pinnedTabIds: nextPinned,
            selectedNote: newSnippet
          }
        })
      }
    } catch (err: any) {
      console.error('Failed to rename image:', err)
      if (showToast) showToast(err?.message || '❌ Failed to rename image.', 'error')
    } finally {
      setRenameModal({ isOpen: false, item: null })
      if (setIsCreatingSnippet) setIsCreatingSnippet(false)
    }
    return
  }

  // --- Standard Note Rename Logic ---
  const extMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown'
  }

  let lang = item.language || 'markdown'
  const match = baseName.match(/\.([a-zA-Z0-9]+)$/)
  if (match) {
    const ext = match[1].toLowerCase()
    if (extMap[ext]) {
      lang = extMap[ext]
    }
  }

  const updatedItem = {
    ...item,
    title: baseName,
    language: lang
  }

  const setSelectionAction =
    setSelectedNote || setSelectedSnippet || useWorkspaceStore.getState().setSelectedNote
  const saveAction = saveNote || saveSnippet || useWorkspaceStore.getState().saveNote

  if (setSelectionAction) {
    setSelectionAction(updatedItem)
  }

  try {
    if (saveAction) await saveAction(updatedItem)
  } catch (error) {
    console.error('Failed to save item after rename:', error)
    if (showToast) showToast('❌ Failed to rename note.', 'error')
    if (setSelectionAction) {
      setSelectionAction(item)
    }
  } finally {
    setRenameModal({ isOpen: false, item: null })
    if (setIsCreatingSnippet) setIsCreatingSnippet(false)
  }
}

// Backwards-compatibility alias
export const handleRenameSnippet = renameNote
export default renameNote
