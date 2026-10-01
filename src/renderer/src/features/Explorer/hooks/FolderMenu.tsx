import React, { useState, useCallback, useMemo } from 'react'
import { useContextMenu } from '../../Navigation/hooks/useContextMenu'
import type { ExportTargetNote } from '../utils/exportSelection'

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
  shortcut?: string
  disabled?: boolean
  children?: ContextMenuOption[]
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
  selectedFolderIds?: Set<string>
  selectedNoteIds?: Set<string>
  selectedNotes?: Snippet[]
  exportNotes?: ExportTargetNote[]
  resolveFolderNotes?: (folderId: string) => ExportTargetNote[]
  onSummarizeSelected?: (notes: Snippet[]) => void
  onExportSelected?: (notes: ExportTargetNote[]) => void
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
  exportNotes = [],
  resolveFolderNotes,
  onSummarizeSelected,
  onExportSelected
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
      onSummary: () => {
        if (folderContext?.folderId && resolveFolderNotes) {
          const targets = resolveFolderNotes(folderContext.folderId)
          if (targets.length > 0) {
            onSummarizeSelected?.(targets as any)
          }
        }
      },
      onExport: () => {
        if (folderContext?.folderId && resolveFolderNotes) {
          const targets = resolveFolderNotes(folderContext.folderId)
          if (targets.length > 0) {
            onExportSelected?.(targets)
          }
        } else if (exportNotes.length > 0) {
          onExportSelected?.(exportNotes)
        }
      },
      onClose: () => setFolderContext(null),
      isFolderPinned: folderContext?.folderId
        ? pinnedFolders.includes(folderContext.folderId)
        : false
    }
  })

  // Single unified menu that matches the user's specification exactly
  const contextMenuOptions = useMemo((): ContextMenuOption[] => {
    return defaultMenuOptions as ContextMenuOption[]
  }, [defaultMenuOptions])

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
