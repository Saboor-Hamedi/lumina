import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../notification'

export const useSnippetData = () => {
  const [snippets, setSnippets] = useState([])
  const [selectedSnippet, setSelectedSnippet] = useState(null)
  const { showToast } = useToast()

  const loadData = useCallback(async () => {
    try {
      if (window.api?.getSnippets) {
        const loadNotes = await window.api.getSnippets()
        setSnippets(loadNotes || [])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      showToast('❌ Failed to load workspace')
    }
  }, [showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const saveSnippet = async (snippet, options = {}) => {
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
    } catch (error) {
      console.error('Failed to save snippet:', error)
      showToast('❌ Failed to save')
    }
  }

  const deleteItem = async (id) => {
    try {
      if (window.api?.deleteSnippet) {
        const confirmed = await window.api.confirmDelete(
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
    } catch (error) {
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
