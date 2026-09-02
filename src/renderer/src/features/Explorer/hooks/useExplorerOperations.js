import { useState, useRef, useEffect, useCallback } from 'react'
import { useVaultStore } from '../../../core/store/useVaultStore'
import { useSettingsStore } from '../../../core/store/useSettingsStore'

/**
 * @typedef {Object} CreatingItemState
 * @property {'file' | 'folder'} type - The kind of item being created
 * @property {string} parentId - The parent folder ID, or empty string for root
 */

/**
 * Custom hook managing folder & note creation, folder renaming, folder tree expansion/collapsing,
 * and folder hierarchy persistence for the File Explorer.
 *
 * @param {Object} params
 * @param {Array<Object>} params.snippets - All workspace note snippets
 * @param {Array<string>} params.visibleFolders - Visible folder paths
 * @param {string} params.selectedSnippetId - ID of currently selected snippet
 * @param {string} params.query - Current search query string
 * @param {Array<Object>} params.flatTree - Flattened tree items
 * @param {React.RefObject} params.virtuosoRef - Reference to Virtuoso virtual list
 * @param {Function} params.setSidebarFocus - Setter for explorer sidebar focus
 * @param {Function} params.handleSelect - Note selection handler
 * @param {string|null} params.lastClickedFolder - Last clicked folder path
 * @returns {Object} Explorer operations state and action handlers
 */
export function useExplorerOperations({
  snippets,
  visibleFolders,
  selectedSnippetId,
  query,
  flatTree,
  virtuosoRef,
  setSidebarFocus,
  handleSelect,
  lastClickedFolder
}) {
  const { settings, updateSetting } = useSettingsStore()
  const saveSnippet = useVaultStore((state) => state.saveSnippet)
  const loadVault = useVaultStore((state) => state.loadVault)

  // Folder Expansion State
  const [expandedFolders, setExpandedFolders] = useState(
    () => new Set(settings.expandedFolders || [])
  )
  const [collapsedDuringSearch, setCollapsedDuringSearch] = useState(() => new Set())
  const expandedFoldersRef = useRef(expandedFolders)
  const lastAutoExpandedSnippetRef = useRef(null)

  useEffect(() => {
    expandedFoldersRef.current = expandedFolders
  }, [expandedFolders])

  // Sync folderOrder setting if new folders appear on disk
  useEffect(() => {
    if (visibleFolders && visibleFolders.length > 0) {
      const currentOrder = settings.folderOrder || []
      const missing = visibleFolders.filter((f) => !currentOrder.includes(f))
      if (missing.length > 0) {
        updateSetting('folderOrder', [...currentOrder, ...missing])
      }
    }
  }, [visibleFolders, settings.folderOrder, updateSetting])

  // Inline Creation State
  const [creating, setCreating] = useState(null) // { type: 'file' | 'folder', parentId: string } | null
  const [creatingValue, setCreatingValue] = useState('')

  // Inline Rename State
  const [renamingFolder, setRenamingFolder] = useState(null) // folderId | null
  const [renamingValue, setRenamingValue] = useState('')

  // Auto-scroll to creation input when created
  useEffect(() => {
    if (creating && flatTree && flatTree.length > 0) {
      const idx = flatTree.findIndex((item) => item.type === 'input')
      if (idx !== -1 && virtuosoRef.current) {
        setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({ index: idx, align: 'center' })
        }, 50)
      }
    }
  }, [creating, flatTree, virtuosoRef])

  // Auto-expand parent folders of active snippet when switching notes
  useEffect(() => {
    if (!selectedSnippetId) return
    if (lastAutoExpandedSnippetRef.current === selectedSnippetId) return
    const activeSnippet = snippets.find((s) => s.id === selectedSnippetId)
    if (!activeSnippet || !activeSnippet.folderId) {
      lastAutoExpandedSnippetRef.current = selectedSnippetId
      return
    }

    lastAutoExpandedSnippetRef.current = selectedSnippetId

    const foldersToExpand = []
    const cleanFolderId = activeSnippet.folderId.replace(/\\/g, '/')
    const parts = cleanFolderId.split('/').filter(Boolean)
    let currentPath = ''

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      foldersToExpand.push(currentPath)
    }

    const currentSet = expandedFoldersRef.current
    const next = new Set(currentSet)
    let changed = false

    for (const id of foldersToExpand) {
      if (!next.has(id)) {
        next.add(id)
        changed = true
      }
    }

    if (changed) {
      setExpandedFolders(next)
      updateSetting('expandedFolders', Array.from(next))
    }
  }, [selectedSnippetId, snippets, updateSetting])

  // External trigger for creating new note
  useEffect(() => {
    const handleTriggerNewNote = () => {
      let targetFolderId = lastClickedFolder
      if (targetFolderId === null) {
        const activeSnippet = snippets.find((s) => s.id === selectedSnippetId)
        targetFolderId = activeSnippet?.folderId || ''
      }

      if (targetFolderId) {
        setExpandedFolders((prev) => new Set(prev).add(targetFolderId))
      }
      setCreating({ type: 'file', parentId: targetFolderId })
      setCreatingValue('')
    }

    window.addEventListener('trigger-new-note', handleTriggerNewNote)
    return () => window.removeEventListener('trigger-new-note', handleTriggerNewNote)
  }, [lastClickedFolder, selectedSnippetId, snippets])

  /**
   * Toggles folder expansion state and persists to settings store.
   */
  const toggleFolder = useCallback(
    (folderId, e) => {
      if (e) e.stopPropagation()
      useVaultStore.getState().setSelectedFolder(folderId)
      if (query.trim()) {
        setCollapsedDuringSearch((prev) => {
          const next = new Set(prev)
          if (next.has(folderId)) next.delete(folderId)
          else next.add(folderId)
          return next
        })
      } else {
        const currentSet = expandedFoldersRef.current
        const next = new Set(currentSet)
        if (next.has(folderId)) next.delete(folderId)
        else next.add(folderId)

        setExpandedFolders(next)
        updateSetting('expandedFolders', Array.from(next))
      }
    },
    [updateSetting, query]
  )

  /**
   * Collapses all open folders in the explorer.
   */
  const collapseAllFolders = useCallback(
    (e) => {
      if (e) e.stopPropagation()
      setExpandedFolders(new Set())
      updateSetting('expandedFolders', [])
    },
    [updateSetting]
  )

  /**
   * Cancels the active folder inline rename.
   */
  const cancelRename = useCallback(() => setRenamingFolder(null), [])

  /**
   * Submits inline folder or note creation.
   */
  const submitCreation = useCallback(
    async (value) => {
      const valToUse = typeof value === 'string' ? value : creatingValue
      if (!creating || !valToUse.trim()) {
        setCreating(null)
        return
      }

      const sanitizedName = valToUse.trim().replace(/[<>:"/\\|?*]/g, '')
      if (!sanitizedName) {
        setCreating(null)
        return
      }

      try {
        if (creating.type === 'folder') {
          const folderPath = creating.parentId
            ? `${creating.parentId}/${sanitizedName}`
            : sanitizedName
          const currentOrder = settings.folderOrder || []
          if (!currentOrder.includes(folderPath)) {
            await updateSetting('folderOrder', [...currentOrder, folderPath])
          }
          await window.api.createFolder(folderPath)
          setExpandedFolders((prev) => new Set(prev).add(folderPath))
          await loadVault()
        } else {
          const newId = crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 15)
          const folderId = creating.parentId || ''
          const newSnippet = {
            id: newId,
            title: sanitizedName,
            code: '',
            language: 'markdown',
            tags: '',
            folderId: folderId,
            timestamp: Date.now()
          }
          await saveSnippet(newSnippet)
          if (folderId) setExpandedFolders((prev) => new Set(prev).add(folderId))
          handleSelect(newSnippet)
        }
      } catch (err) {
        console.error('Failed to create item:', err)
      }
      setCreating(null)
      setCreatingValue('')
      setSidebarFocus(null)
    },
    [creating, creatingValue, settings.folderOrder, updateSetting, loadVault, saveSnippet, handleSelect, setSidebarFocus]
  )

  /**
   * Submits inline folder renaming.
   */
  const submitRename = useCallback(
    async (value) => {
      const valToUse = typeof value === 'string' ? value : renamingValue
      if (!renamingFolder || !valToUse.trim()) {
        setRenamingFolder(null)
        return
      }

      const sanitizedName = valToUse.trim().replace(/[<>:"/\\|?*]/g, '')
      if (!sanitizedName) {
        setRenamingFolder(null)
        return
      }

      try {
        const parts = renamingFolder.split('/')
        parts[parts.length - 1] = sanitizedName
        const newPath = parts.join('/')

        if (newPath !== renamingFolder) {
          await window.api.renameFolder(renamingFolder, newPath)
          await loadVault()
        }
      } catch (err) {
        console.error('Rename failed:', err)
      }
      setRenamingFolder(null)
    },
    [renamingFolder, renamingValue, loadVault]
  )

  return {
    expandedFolders,
    setExpandedFolders,
    collapsedDuringSearch,
    setCollapsedDuringSearch,
    creating,
    setCreating,
    creatingValue,
    setCreatingValue,
    renamingFolder,
    setRenamingFolder,
    renamingValue,
    setRenamingValue,
    toggleFolder,
    collapseAllFolders,
    cancelRename,
    submitCreation,
    submitRename
  }
}
