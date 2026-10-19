/**
 * useExplorerPaste.ts
 * 
 * Part 1 of the 4-Part Partitioned FileExplorer Architecture.
 * 
 * Handles:
 * 1. Global / Explorer Clipboard Paste of Image Files into Vault Folders.
 *    - Validates active element focus to prevent intercepting inputs, textareas, CodeMirror, or AI chat.
 *    - Encodes clipboard images into Uint8Array buffers.
 *    - Dispatches to `window.api.saveVaultImage` targeting the active or last-clicked folder.
 *    - Triggers auto-selection of the newly pasted image note in the workspace.
 * 2. Multi-Item Bulk Deletion Modal & Confirmation Handler.
 *    - Coordinates recursive deletion of selected folders and notes.
 *    - Updates pinned folder preferences in SettingStore.
 *    - Refreshes workspace and clears active selections.
 */

import { useEffect, useState, useCallback } from 'react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { useSettingsStore } from '../../core/store/SettingStore'

export interface UseExplorerPasteProps {
  lastClickedFolder?: string | null
  loadWorkspace: () => Promise<void>
  handleSelect: (snippet: any) => void
  selectedNoteIds: Set<string>
  selectedFolderIds: Set<string>
  clearSelection: () => void
}

export function useExplorerPaste({
  lastClickedFolder,
  loadWorkspace,
  handleSelect,
  selectedNoteIds,
  selectedFolderIds,
  clearSelection
}: UseExplorerPasteProps) {
  const deleteSnippet = useWorkspaceStore((state: any) => state.deleteNote)
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)

  // Listen for clipboard image paste events directly into vault folder
  useEffect(() => {
    const handleExplorerPaste = async (e: ClipboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null
      const targetEl = (e.target as HTMLElement | null) || activeEl

      // Guard: Do not intercept pastes intended for text editors, canvas inputs, or AI chat
      if (
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'INPUT' ||
        Boolean(activeEl?.isContentEditable) ||
        Boolean(
          activeEl?.closest(
            '.cm-editor, .ProseMirror, .ai-chat-input, .lumina-canvas-container, .lumina-canvas-toolbar'
          )
        )
      ) {
        return
      }

      // Verify paste is taking place inside navigation, explorer, sidebar, or start menu
      const explorerSelector =
        '.shell-sidebar-left, .explorer-embedded-container, .start-menu-container, .start-menu-body, .start-section, .explorer-modal, .file-explorer, .navigation-tree, .explorer-tree, .explorer-header, .unified-sidebar, .sidebar-scrollable-content, .tree-item, .lumina-sidebar, .lumina-explorer-container'

      const isInsideExplorer = Boolean(
        targetEl?.closest?.(explorerSelector) ||
        activeEl?.closest?.(explorerSelector)
      )

      if (!isInsideExplorer) {
        return
      }

      const items = Array.from(e.clipboardData?.items || [])
      const fileFromItems = items
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter(Boolean) as File[]

      const directFiles = Array.from(e.clipboardData?.files || []).filter((f) =>
        f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(f.name)
      )

      const imageFiles = fileFromItems.length > 0 ? fileFromItems : directFiles

      const imagePayloads: { buffer: Uint8Array; filename: string }[] = []

      if (imageFiles.length > 0) {
        for (const file of imageFiles) {
          try {
            const arrayBuffer = await file.arrayBuffer()
            const ext = file.type ? file.type.split('/')[1] || 'png' : 'png'
            const filename =
              file.name && file.name !== 'image.png' && file.name !== 'image.jpeg'
                ? file.name
                : `Pasted image ${Date.now()}.${ext}`
            imagePayloads.push({ buffer: new Uint8Array(arrayBuffer), filename })
          } catch (err) {
            console.error('[useExplorerPaste] Failed reading file buffer:', err)
          }
        }
      } else if ((window as any).api?.readClipboardImageBuffer) {
        try {
          const rawBuffer = await (window as any).api.readClipboardImageBuffer()
          if (rawBuffer && rawBuffer.length > 0) {
            const uint8 = rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer)
            imagePayloads.push({
              buffer: uint8,
              filename: `Pasted image ${Date.now()}.png`
            })
          }
        } catch (err) {
          console.warn('[useExplorerPaste] Failed reading clipboard image buffer:', err)
        }
      }

      if (imagePayloads.length === 0) return

      e.preventDefault()
      e.stopPropagation()

      const targetFolder = lastClickedFolder || ''
      const api = (window as any).api
      let savedCount = 0

      for (const payload of imagePayloads) {
        try {
          const result = await api?.saveVaultImage?.(
            payload.buffer,
            targetFolder,
            payload.filename
          )

          await loadWorkspace()
          savedCount++

          if (result?.relativePath) {
            const freshSnippets = (useWorkspaceStore.getState() as any).notes || []
            const targetSnippet = freshSnippets.find(
              (s: any) =>
                s.relativePath === result.relativePath ||
                (s.fileName === result.fileName && (s.folderId || '') === (result.folderId || ''))
            )
            if (targetSnippet) {
              handleSelect(targetSnippet)
            }
          }
        } catch (err) {
          console.error('[useExplorerPaste] Failed to paste image to vault:', err)
        }
      }

      if (savedCount > 0) {
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: {
              message: targetFolder
                ? `Pasted image into "${targetFolder}"`
                : 'Pasted image into vault',
              type: 'success'
            }
          })
        )
      }
    }

    window.addEventListener('paste', handleExplorerPaste)
    return () => window.removeEventListener('paste', handleExplorerPaste)
  }, [lastClickedFolder, loadWorkspace, handleSelect])

  const [pendingDeleteSnapshot, setPendingDeleteSnapshot] = useState<{
    noteIds: string[]
    folderIds: string[]
  } | null>(null)

  const handleSetBulkDeleteModalOpen = useCallback(
    (open: boolean) => {
      if (open) {
        setPendingDeleteSnapshot({
          noteIds: Array.from(selectedNoteIds),
          folderIds: Array.from(selectedFolderIds)
        })
      } else {
        setPendingDeleteSnapshot(null)
      }
      setBulkDeleteModalOpen(open)
    },
    [selectedNoteIds, selectedFolderIds]
  )

  const effectiveNoteIds = pendingDeleteSnapshot
    ? pendingDeleteSnapshot.noteIds
    : Array.from(selectedNoteIds)
  const effectiveFolderIds = pendingDeleteSnapshot
    ? pendingDeleteSnapshot.folderIds
    : Array.from(selectedFolderIds)
  const totalSelectedCount = effectiveNoteIds.length + effectiveFolderIds.length

  // Confirms and executes bulk deletion across multiple folders and notes
  const handleConfirmBulkDelete = useCallback(async () => {
    const deletedFolderIds = pendingDeleteSnapshot
      ? pendingDeleteSnapshot.folderIds
      : Array.from(selectedFolderIds)
    const deletedSnippetIds = pendingDeleteSnapshot
      ? pendingDeleteSnapshot.noteIds
      : Array.from(selectedNoteIds)

    if (deletedFolderIds.length === 0 && deletedSnippetIds.length === 0) {
      setBulkDeleteModalOpen(false)
      setPendingDeleteSnapshot(null)
      return
    }

    try {
      const api = (window as any).api

      if (api?.bulkDelete) {
        await api.bulkDelete({
          folderIds: deletedFolderIds,
          snippetIds: deletedSnippetIds
        })
      } else {
        // Fallback sequential deletion
        for (const folderId of deletedFolderIds) {
          await api?.deleteFolder?.(folderId).catch(() => {})
        }
        for (const noteId of deletedSnippetIds) {
          await deleteSnippet(noteId, true).catch(() => {})
        }
      }

      // Cleanup pinned folders in settings if deleted
      if (deletedFolderIds.length > 0) {
        const currentPinnedFolders = useSettingsStore.getState().settings.pinnedFolders || []
        const newPinnedFolders = currentPinnedFolders.filter(
          (fId: string) => !deletedFolderIds.some((df) => fId === df || fId.startsWith(`${df}/`))
        )
        if (newPinnedFolders.length !== currentPinnedFolders.length) {
          useSettingsStore.getState().updateSettings({ pinnedFolders: newPinnedFolders })
        }
      }

      clearSelection()
      await loadWorkspace()

      const totalDeleted = deletedFolderIds.length + deletedSnippetIds.length
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: {
            message: `Deleted ${totalDeleted} ${totalDeleted === 1 ? 'item' : 'items'}`,
            type: 'success'
          }
        })
      )
    } catch (err) {
      console.error('[useExplorerPaste] Failed to execute bulk deletion:', err)
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: {
            message: 'Failed to delete selected items',
            type: 'error'
          }
        })
      )
    } finally {
      setBulkDeleteModalOpen(false)
      setPendingDeleteSnapshot(null)
    }
  }, [
    pendingDeleteSnapshot,
    selectedFolderIds,
    selectedNoteIds,
    deleteSnippet,
    clearSelection,
    loadWorkspace
  ])

  return {
    bulkDeleteModalOpen,
    setBulkDeleteModalOpen: handleSetBulkDeleteModalOpen,
    totalSelectedCount,
    handleConfirmBulkDelete
  }
}
