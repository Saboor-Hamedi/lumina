import React, { useState, useCallback, useMemo } from 'react'
import { Trash2, X, Sparkles, Download } from 'lucide-react'
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
  /** Fully resolved export targets for the current multi-selection. */
  exportNotes?: ExportTargetNote[]
  /** Resolves a single folder (and its subtree) to export targets. */
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
  selectedCount = 0,
  selectedNotes = [],
  exportNotes = [],
  resolveFolderNotes,
  onSummarizeSelected,
  onExportSelected,
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

  /** Builds the "Export as PDF…" menu entry for a resolved set of notes. */
  const buildExportOption = useCallback(
    (targets: ExportTargetNote[], label: string): ContextMenuOption => ({
      label,
      icon: React.createElement(Download, { size: 14 }),
      onClick: () => {
        setFolderContext(null)
        onExportSelected?.(targets)
      }
    }),
    [onExportSelected]
  )

  const contextMenuOptions = useMemo((): ContextMenuOption[] => {
    // ── Multi-selection (files and/or folders) ──────────────────────────────
    if (selectedCount > 1) {
      const options: ContextMenuOption[] = []

      if (exportNotes.length > 0) {
        options.push(
          buildExportOption(
            exportNotes,
            `Export ${exportNotes.length} ${exportNotes.length === 1 ? 'Note' : 'Notes'} as PDF…`
          )
        )
      }

      if (selectedNotes && selectedNotes.length > 0) {
        options.push({
          label:
            selectedNotes.length > 1 ? `Summarize ${selectedNotes.length} Notes` : 'Summarize Note',
          icon: React.createElement(Sparkles, { size: 14, className: 'text-primary' }),
          onClick: () => {
            setFolderContext(null)
            clearSelection?.()
            onSummarizeSelected?.(selectedNotes)
          }
        })
      }

      if (options.length > 0) options.push({ type: 'divider' })

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

    // ── Single folder right-click: offer to export the folder subtree ───────
    if (folderContext?.folderId && resolveFolderNotes) {
      const folderTargets = resolveFolderNotes(folderContext.folderId)
      if (folderTargets.length > 0) {
        return [
          buildExportOption(
            folderTargets,
            `Export Folder as PDF (${folderTargets.length} ${
              folderTargets.length === 1 ? 'Note' : 'Notes'
            })…`
          ),
          { type: 'divider' },
          ...(defaultMenuOptions as ContextMenuOption[])
        ]
      }
    }

    return defaultMenuOptions as ContextMenuOption[]
  }, [
    selectedCount,
    selectedNotes,
    exportNotes,
    folderContext,
    resolveFolderNotes,
    buildExportOption,
    onSummarizeSelected,
    defaultMenuOptions,
    onRequestBulkDelete,
    clearSelection
  ])

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
