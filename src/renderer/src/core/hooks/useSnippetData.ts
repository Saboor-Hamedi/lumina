import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react'
import { useToast } from '../notification'
import type { WorkspaceNote } from '../store/workspaceStore'

export interface SaveSnippetOptions {
  skipSelectedUpdate?: boolean
}

export interface UseSnippetDataReturn {
  snippets: WorkspaceNote[]
  setSnippets: Dispatch<SetStateAction<WorkspaceNote[]>>
  selectedSnippet: WorkspaceNote | null
  setSelectedSnippet: Dispatch<SetStateAction<WorkspaceNote | null>>
  saveSnippet: (snippet: WorkspaceNote, options?: SaveSnippetOptions) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  refreshWorkspace: () => Promise<void>
  refreshVault: () => Promise<void>
}

export const useSnippetData = (): UseSnippetDataReturn => {
  const [snippets, setSnippets] = useState<WorkspaceNote[]>([])
  const [selectedSnippet, setSelectedSnippet] = useState<WorkspaceNote | null>(null)
  const { showToast } = useToast()

  const loadData = useCallback(async (): Promise<void> => {
    try {
      if (window.api?.getSnippets) {
        const loadNotes: WorkspaceNote[] | null | undefined = await window.api.getSnippets()
        setSnippets(loadNotes || [])
      }
    } catch (error: unknown) {
      console.error('Failed to load data:', error)
      showToast('❌ Failed to load workspace')
    }
  }, [showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveSnippet = async (
    snippet: WorkspaceNote,
    options: SaveSnippetOptions = {}
  ): Promise<void> => {
    try {
      if (window.api?.saveSnippet) {
        await window.api.saveSnippet(snippet)

        // Refresh local state to ensure consistency with FS
        await loadData()

        if (!options.skipSelectedUpdate) {
          if (selectedSnippet && selectedSnippet.id === snippet.id) {
            setSelectedSnippet(snippet)
          }
        }
        showToast('✓ Saved to Workspace')
      }
    } catch (error: unknown) {
      console.error('Failed to save snippet:', error)
      showToast('❌ Failed to save')
    }
  }

  const deleteItem = async (id: string): Promise<void> => {
    try {
      if (window.api?.deleteSnippet) {
        const confirmed: boolean = await window.api.confirmDelete(
          'Are you sure you want to delete this note from the workspace?'
        )
        if (!confirmed) return

        await window.api.deleteSnippet(id)
        const next = snippets.filter((s) => s.id !== id)
        setSnippets(next)

        if (selectedSnippet?.id === id) {
          setSelectedSnippet(next.length ? next[0] : null)
        }
        showToast('✓ Removed from Workspace')
      }
    } catch (error: unknown) {
      console.error('Failed to delete item:', error)
      showToast('❌ Error deleting file')
    }
  }

  return {
    snippets,
    setSnippets,
    selectedSnippet,
    setSelectedSnippet,
    saveSnippet,
    deleteItem,
    refreshWorkspace: loadData,
    refreshVault: loadData
  }
}
