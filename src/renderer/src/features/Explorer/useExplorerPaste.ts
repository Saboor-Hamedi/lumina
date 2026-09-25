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
      const activeEl = document.activeElement

      // Guard: Do not intercept pastes intended for text editors, canvas inputs, or AI chat
      if (
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'INPUT' ||
        activeEl?.closest('.cm-editor') ||
        activeEl?.closest('.ai-chat-input') ||
        activeEl?.closest('.lumina-canvas-container') ||
        activeEl?.closest('.lumina-canvas-toolbar')
      ) {
        return
      }

      // Verify paste is taking place inside navigation, explorer, or start menu
      const isInsideExplorer = Boolean(
        activeEl?.closest('.lumina-sidebar') ||
        activeEl?.closest('.lumina-explorer-container') ||
        activeEl?.closest('.explorer-modal')
      )
      const isCanvasPresent = Boolean(document.querySelector('.lumina-canvas-container'))
      if (isCanvasPresent && !isInsideExplorer) {
        return
      }

      const items = Array.from(e.clipboardData?.items || [])
      const fileFromItems = items
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter(Boolean) as File[]

      const directFiles = Array.from(e.clipboardData?.files || []).filter((f) =>
        f.type.startsWith('image/')
      )

      const imageFiles = fileFromItems.length > 0 ? fileFromItems : directFiles

      if (imageFiles.length > 0) {
        e.preventDefault()
        e.stopPropagation()

        const targetFolder = lastClickedFolder || ''

        for (const file of imageFiles) {
          try {
            const arrayBuffer = await file.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)
            const ext = file.type.split('/')[1] || 'png'
            const filename =
              file.name && file.name !== 'image.png' && file.name !== 'image.jpeg'
                ? file.name
                : `Pasted image ${Date.now()}.${ext}`

            const api = (window as any).api
            const result = await api?.saveVaultImage?.(
              uint8Array,
              targetFolder,
              filename
            )

            await loadWorkspace()

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
            console.error('Failed to paste image to vault:', err)
          }
        }
      }
    }

    window.addEventListener('paste', handleExplorerPaste)
    return () => window.removeEventListener('paste', handleExplorerPaste)
  }, [lastClickedFolder, loadWorkspace, handleSelect])

  const totalSelectedCount = selectedNoteIds.size + selectedFolderIds.size

  // Confirms and executes bulk deletion across multiple folders and notes
  const handleConfirmBulkDelete = useCallback(async () => {
    try {
      const deletedFolderIds = Array.from(selectedFolderIds)
      const deletedSnippetIds = Array.from(selectedNoteIds)
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
    } catch (err) {
      console.error('Failed to execute bulk deletion:', err)
    } finally {
      setBulkDeleteModalOpen(false)
    }
  }, [selectedFolderIds, selectedNoteIds, deleteSnippet, clearSelection, loadWorkspace])

  return {
    bulkDeleteModalOpen,
    setBulkDeleteModalOpen,
    totalSelectedCount,
    handleConfirmBulkDelete
  }
}
