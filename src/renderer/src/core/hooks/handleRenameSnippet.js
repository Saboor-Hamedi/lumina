import { useVaultStore } from '../store/workspaceStore'

export const handleRenameSnippet = async ({
  renameModal,
  saveSnippet,
  setSelectedSnippet,
  setRenameModal,
  setIsCreatingSnippet,
  showToast
}) => {
  if (!renameModal.item) {
    if (showToast) showToast('❌ Cannot rename: No note selected.', 'error')
    setRenameModal({ isOpen: false, item: null })
    return
  }

  const item = renameModal.item
  let baseName = (renameModal.newName || item.title || '').trim() || 'Untitled'

  // If nothing changed, skip saving and close modal
  if (item.title === baseName) {
    if (showToast) showToast('No changes', 'info')
    setRenameModal({ isOpen: false, item: null })
    setIsCreatingSnippet(false)
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
      setIsCreatingSnippet(false)
      return
    }

    try {
      await window.api?.moveFile?.(oldRel, newRel)
      const loadVault = useVaultStore.getState().loadVault
      await loadVault?.()

      const freshSnippets = useVaultStore.getState().snippets || []
      const newSnippet = freshSnippets.find(
        (s) =>
          s.relativePath === newRel ||
          (s.fileName === targetFileName && (s.folderId || '') === (item.folderId || ''))
      )

      if (newSnippet) {
        useVaultStore.setState((state) => {
          const nextTabs = state.openTabs.map((tid) => (tid === item.id ? newSnippet.id : tid))
          const nextActiveId = state.activeTabId === item.id ? newSnippet.id : state.activeTabId
          const nextPinned = state.pinnedTabIds.map((pid) => (pid === item.id ? newSnippet.id : pid))
          return {
            openTabs: nextTabs,
            activeTabId: nextActiveId,
            pinnedTabIds: nextPinned,
            selectedSnippet: newSnippet
          }
        })
      }
      if (showToast) showToast('✓ PDF renamed successfully', 'success')
    } catch (err) {
      console.error('Failed to rename PDF:', err)
      if (showToast) showToast(err?.message || '❌ Failed to rename PDF.', 'error')
    } finally {
      setRenameModal({ isOpen: false, item: null })
      setIsCreatingSnippet(false)
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
      setIsCreatingSnippet(false)
      return
    }

    try {
      await window.api?.moveFile?.(oldRel, newRel)
      const loadVault = useVaultStore.getState().loadVault
      await loadVault?.()

      const freshSnippets = useVaultStore.getState().snippets || []
      const newSnippet = freshSnippets.find(
        (s) =>
          s.relativePath === newRel ||
          (s.fileName === targetFileName && (s.folderId || '') === (item.folderId || ''))
      )

      if (newSnippet) {
        useVaultStore.setState((state) => {
          const nextTabs = state.openTabs.map((tid) => (tid === item.id ? newSnippet.id : tid))
          const nextActiveId = state.activeTabId === item.id ? newSnippet.id : state.activeTabId
          const nextPinned = state.pinnedTabIds.map((pid) => (pid === item.id ? newSnippet.id : pid))
          return {
            openTabs: nextTabs,
            activeTabId: nextActiveId,
            pinnedTabIds: nextPinned,
            selectedSnippet: newSnippet
          }
        })
      }
      if (showToast) showToast('✓ Image renamed successfully', 'success')
    } catch (err) {
      console.error('Failed to rename image:', err)
      if (showToast) showToast(err?.message || '❌ Failed to rename image.', 'error')
    } finally {
      setRenameModal({ isOpen: false, item: null })
      setIsCreatingSnippet(false)
    }
    return
  }

  // --- Standard Note Rename Logic ---
  const hasExt = /\.[0-9a-z]+$/i.test(baseName)
  const extMap = {
    md: 'markdown',
    markdown: 'markdown',
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    html: 'html',
    css: 'css',
    py: 'python'
  }
  let lang = item.language || 'markdown'

  if (hasExt) {
    const ext = baseName.split('.').pop().toLowerCase()
    if (extMap[ext]) {
      lang = extMap[ext]
    }
  }

  const updatedItem = {
    ...item,
    title: baseName,
    language: lang
  }

  if (setSelectedSnippet) {
    setSelectedSnippet(updatedItem)
  }

  try {
    await saveSnippet(updatedItem)
    if (showToast) showToast('✓ Note renamed successfully', 'success')
  } catch (error) {
    console.error('Failed to save item after rename:', error)
    if (showToast) showToast('❌ Failed to rename note.', 'error')
    if (setSelectedSnippet) {
      setSelectedSnippet(item)
    }
  } finally {
    setRenameModal({ isOpen: false, item: null })
    setIsCreatingSnippet(false)
  }
}
