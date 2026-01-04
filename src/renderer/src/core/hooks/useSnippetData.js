import { useState, useEffect, useCallback } from 'react'
import { useToast } from './useToast'

export const useSnippetData = () => {
  const [snippets, setSnippets] = useState([])
  const [selectedSnippet, setSelectedSnippet] = useState(null)
  const { showToast } = useToast()

  const loadData = useCallback(async () => {
    try {
      if (window.api?.getSnippets) {
        const loadedSnippets = await window.api.getSnippets()
        setSnippets(loadedSnippets || [])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      showToast('❌ Failed to load vault')
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
        showToast('✓ Saved to Vault')
      }
    } catch (error) {
      console.error('Failed to save snippet:', error)
      showToast('❌ Failed to save')
    }
  }

  const deleteItem = async (id) => {
    try {
      if (window.api?.deleteSnippet) {
        const confirmed = await window.api.confirmDelete('Are you sure you want to delete this snippet from the vault?')
        if (!confirmed) return

        await window.api.deleteSnippet(id)
        const next = snippets.filter((s) => s.id !== id)
        setSnippets(next)
        
        if (selectedSnippet?.id === id) {
          setSelectedSnippet(next.length ? next[0] : null)
        }
        showToast('✓ Removed from Vault')
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
    refreshVault: loadData
  }
}
