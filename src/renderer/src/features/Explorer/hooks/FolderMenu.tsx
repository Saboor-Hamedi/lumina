import React, { useState, useCallback, useMemo } from 'react'
import { Trash2, X, Sparkles } from 'lucide-react'
import { useContextMenu } from '../../Navigation/hooks/useContextMenu'

interface Snippet {
  id: string
  title?: string
  [key: string]: unknown
}

interface FolderContext {
  x: number
  y: number
  folderId: string
}

interface ContextMenuOption {
  label?: string
  icon?: React.ReactNode
  danger?: boolean
  onClick?: () => void
  type?: 'divider'
}

interface UseFolderContextMenuParams {
  pinnedFolders?: string[]
  setExpandedFolders: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  setCreating: (val: { type: string; parentId: string | null } | null) => void
  setCreatingValue: (val: string) => void
  setRenamingFolder: (val: string | null) => void
  setRenamingValue: (val: string) => void
  loadWorkspace: () => Promise<void>
  selectedCount?: number
  selectedNotes?: Snippet[]
  onSummarizeSelected?: (notes: Snippet[]) => void
  onRequestBulkDelete?: () => void
  clearSelection?: () => void
}

interface FolderContextMenuResult {
  folderContext: FolderContext | null
  setFolderContext: React.Dispatch<React.SetStateAction<FolderContext | null>>
  deleteConfirmFolder: string | null
  setDeleteConfirmFolder: React.Dispatch<React.SetStateAction<string | null>>
  handleFolderContextMenu: (id: string, e: React.MouseEvent | null) => void
  contextMenuOptions: ContextMenuOption[]
  handleConfirmDeleteFolder: () => Promise<void>
}

export function useFolderContextMenu({
  pinnedFolders = [],
  setExpandedFolders,
  setCreating,
  setCreatingValue,
  setRenamingFolder,
  setRenamingValue,
  loadWorkspace,
  selectedCount = 0,
  selectedNotes = [],
  onSummarizeSelected,
  onRequestBulkDelete,
  clearSelection
}: UseFolderContextMenuParams): FolderContextMenuResult {
  const [folderContext, setFolderContext] = useState<FolderContext | null>(null)
  const [deleteConfirmFolder, setDeleteConfirmFolder] = useState<string | null>(null)

  const handleFolderContextMenu = useCallback((id: string, e: React.MouseEvent | null) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    setFolderContext({
      x: e?.clientX ?? 0,
      y: e?.clientY ?? 0,
      folderId: id
    })
  }, [])

  const defaultMenuOptions = useContextMenu({
    item: folderContext?.folderId || null,
    type: folderContext?.folderId ? 'folder' : 'body',
    callbacks: {
      onCreateNote: () => {
        if (folderContext?.folderId) {
          setExpandedFolders((prev) => new Set(prev).add(folderContext.folderId))
        }
        setCreating({ type: 'file', parentId: folderContext?.folderId || null })
        setCreatingValue('')
      },
      onCreateFolder: () => {
        if (folderContext?.folderId) {
          setExpandedFolders((prev) => new Set(prev).add(folderContext.folderId))
        }
        setCreating({ type: 'folder', parentId: folderContext?.folderId || null })
        setCreatingValue('')
      },
      onCreateCanvas: () => {
        if (folderContext?.folderId) {
          setExpandedFolders((prev) => new Set(prev).add(folderContext.folderId))
        }
        setCreating({ type: 'canvas', parentId: folderContext?.folderId || null })
        setCreatingValue('')
      },
      onRename: () => {
        if (folderContext?.folderId) {
          const parts = folderContext.folderId.split('/')
          setRenamingValue(parts[parts.length - 1])
          setRenamingFolder(folderContext.folderId)
        }
      },
      onDelete: () => {
        if (folderContext?.folderId) {
          setDeleteConfirmFolder(folderContext.folderId)
        }
      },
      onClose: () => setFolderContext(null),
      isFolderPinned: folderContext?.folderId
        ? pinnedFolders.includes(folderContext.folderId)
        : false
    }
  })

  const contextMenuOptions = useMemo((): ContextMenuOption[] => {
    if (selectedCount > 1) {
      const options: ContextMenuOption[] = []
      if (selectedNotes && selectedNotes.length > 0) {
        options.push({
          label: selectedNotes.length > 1 ? `Summarize ${selectedNotes.length} Notes` : 'Summarize Note',
          icon: React.createElement(Sparkles, { size: 14, className: 'text-primary' }),
          onClick: () => {
            setFolderContext(null)
            clearSelection?.()
            onSummarizeSelected?.(selectedNotes)
          }
        })
        options.push({ type: 'divider' })
      }
      options.push(
        {
          label: `Delete ${selectedCount} Items`,
          icon: React.createElement(Trash2, { size: 14, className: 'text-danger' }),
          danger: true,
          onClick: () => {
            setFolderContext(null)
            onRequestBulkDelete?.()
          }
        },
        {
          label: 'Deselect All',
          icon: React.createElement(X, { size: 14 }),
          onClick: () => {
            setFolderContext(null)
            clearSelection?.()
          }
        }
      )
      return options
    }
    return defaultMenuOptions as ContextMenuOption[]
  }, [selectedCount, selectedNotes, onSummarizeSelected, defaultMenuOptions, onRequestBulkDelete, clearSelection])

  const handleConfirmDeleteFolder = useCallback(async () => {
    if (!deleteConfirmFolder) return
    try {
      await (window as any).api?.deleteFolder?.(deleteConfirmFolder)
      await loadWorkspace()
    } catch (e) {
      console.error('Failed to delete folder:', e)
    } finally {
      setDeleteConfirmFolder(null)
    }
  }, [deleteConfirmFolder, loadWorkspace])

  return {
    folderContext,
    setFolderContext,
    deleteConfirmFolder,
    setDeleteConfirmFolder,
    handleFolderContextMenu,
    contextMenuOptions,
    handleConfirmDeleteFolder
  }
}
