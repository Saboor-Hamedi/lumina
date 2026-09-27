import { useState, useEffect, useRef, useCallback, FormEvent } from 'react'
import { luminaMemory } from '../../../core/ai/memory'
import { useToast } from '../../../core/notification'
import type { MemoryData, UserProfile, FactItem } from '../types'

/**
 * Custom hook to encapsulate all AI Memory state management, asynchronous loading,
 * debounced auto-saving of user identity profiles, editing, and CRUD operations on
 * memory facts and preferences.
 */
export function useMemorySettings() {
  const [memory, setMemory] = useState<MemoryData>({
    user: { name: '', role: '', bio: '' },
    preferences: [],
    facts: []
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [newPref, setNewPref] = useState<string>('')
  const [newFact, setNewFact] = useState<string>('')
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null)

  const [editingPrefIndex, setEditingPrefIndex] = useState<number | null>(null)
  const [editingPrefValue, setEditingPrefValue] = useState<string>('')

  const [editingFactIndex, setEditingFactIndex] = useState<number | null>(null)
  const [editingFactValue, setEditingFactValue] = useState<string>('')

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialLoad = useRef<boolean>(true)
  const { showToast } = useToast()

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await luminaMemory.loadMemory()
      setMemory({
        user: {
          name: data?.user?.name || '',
          role: data?.user?.role || '',
          bio: data?.user?.bio || ''
        },
        preferences: Array.isArray(data?.preferences) ? data.preferences : [],
        facts: Array.isArray(data?.facts) ? data.facts : []
      })
    } catch (err) {
      console.error('[useMemorySettings] Load failed:', err)
    } finally {
      setIsLoading(false)
      setTimeout(() => {
        isInitialLoad.current = false
      }, 100)
    }
  }, [])

  useEffect(() => {
    loadData()
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [loadData])

  const persistUserProfile = useCallback(async (userObj: UserProfile) => {
    try {
      setSaveStatus('saving')
      const cleanName = (userObj.name || '').trim()
      const cleanRole = (userObj.role || '').trim()
      const cleanBio = (userObj.bio || '').trim()

      const mem = await luminaMemory.getMemory()
      mem.user = {
        name: cleanName || null,
        role: cleanRole || null,
        bio: cleanBio || null
      }
      await luminaMemory.persist()
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 1800)
    } catch (err) {
      console.error('[useMemorySettings] Failed to save profile:', err)
      setSaveStatus('error')
      showToast('Failed to auto-save profile')
    }
  }, [showToast])

  const handleUserChange = useCallback((field: keyof UserProfile, value: string) => {
    setMemory((prev) => {
      const updatedUser = { ...prev.user, [field]: value }
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        persistUserProfile(updatedUser)
      }, 400)
      return {
        ...prev,
        user: updatedUser
      }
    })
  }, [persistUserProfile])

  const handleAddPreference = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const clean = (newPref || '').trim()
    if (!clean) {
      showToast('Preference cannot be empty')
      return
    }

    if (memory.preferences.some((p) => p.toLowerCase() === clean.toLowerCase())) {
      showToast('Preference already exists')
      return
    }

    await luminaMemory.saveFact({ fact: clean, category: 'preferences' })
    setNewPref('')
    await loadData()
    showToast('Preference saved')
  }, [newPref, memory.preferences, loadData, showToast])

  const handleRemovePreference = useCallback(async (prefText: string) => {
    if (!prefText) return
    await luminaMemory.forgetFact({ target: prefText, category: 'preferences' })
    await loadData()
    showToast('Preference removed')
  }, [loadData, showToast])

  const handleAddFact = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const clean = (newFact || '').trim()
    if (!clean) {
      showToast('Fact cannot be empty')
      return
    }

    const exists = memory.facts.some((f) => {
      const t = typeof f === 'string' ? f : (f as FactItem)?.text || ''
      return t.toLowerCase() === clean.toLowerCase()
    })
    if (exists) {
      showToast('Fact already exists')
      return
    }

    await luminaMemory.saveFact({ fact: clean, category: 'facts' })
    setNewFact('')
    await loadData()
    showToast('Learned fact saved')
  }, [newFact, memory.facts, loadData, showToast])

  const handleRemoveFact = useCallback(async (factItem: string | FactItem) => {
    const text = typeof factItem === 'string' ? factItem : factItem?.text
    if (!text) return
    await luminaMemory.forgetFact({ target: text, category: 'facts' })
    await loadData()
    showToast('Memory item removed')
  }, [loadData, showToast])

  const handleStartEditPref = useCallback((idx: number, currentVal: string) => {
    setEditingPrefIndex(idx)
    setEditingPrefValue(currentVal)
  }, [])

  const handleCancelEditPref = useCallback(() => {
    setEditingPrefIndex(null)
    setEditingPrefValue('')
  }, [])

  const handleSaveEditPref = useCallback(async (idx: number, oldVal: string) => {
    const clean = (editingPrefValue || '').trim()
    if (!clean) {
      showToast('Preference cannot be empty')
      return
    }
    if (
      clean.toLowerCase() !== oldVal.toLowerCase() &&
      memory.preferences.some((p) => p.toLowerCase() === clean.toLowerCase())
    ) {
      showToast('Preference already exists')
      return
    }

    await luminaMemory.updateFact({ oldFact: oldVal, newFact: clean, category: 'preferences' })
    setEditingPrefIndex(null)
    setEditingPrefValue('')
    await loadData()
    showToast('Preference updated')
  }, [editingPrefValue, memory.preferences, loadData, showToast])

  const handleStartEditFact = useCallback((idx: number, currentVal: string) => {
    setEditingFactIndex(idx)
    setEditingFactValue(currentVal)
  }, [])

  const handleCancelEditFact = useCallback(() => {
    setEditingFactIndex(null)
    setEditingFactValue('')
  }, [])

  const handleSaveEditFact = useCallback(async (idx: number, oldVal: string) => {
    const clean = (editingFactValue || '').trim()
    if (!clean) {
      showToast('Fact cannot be empty')
      return
    }
    const exists = memory.facts.some((f, fIdx) => {
      if (fIdx === idx) return false
      const t = typeof f === 'string' ? f : (f as FactItem)?.text || ''
      return t.toLowerCase() === clean.toLowerCase()
    })
    if (exists) {
      showToast('Fact already exists')
      return
    }

    await luminaMemory.updateFact({ oldFact: oldVal, newFact: clean, category: 'facts' })
    setEditingFactIndex(null)
    setEditingFactValue('')
    await loadData()
    showToast('Fact updated')
  }, [editingFactValue, memory.facts, loadData, showToast])

  const handleClearAll = useCallback(async () => {
    if (window.confirm('Are you sure you want to clear all learned memory? This will reset memory.json.')) {
      await luminaMemory.clearAllMemory()
      await loadData()
      showToast('Memory reset')
    }
  }, [loadData, showToast])

  return {
    memory,
    isLoading,
    newPref,
    setNewPref,
    newFact,
    setNewFact,
    saveStatus,
    editingPrefIndex,
    editingPrefValue,
    setEditingPrefValue,
    editingFactIndex,
    editingFactValue,
    setEditingFactValue,
    loadData,
    handleUserChange,
    handleAddPreference,
    handleRemovePreference,
    handleStartEditPref,
    handleCancelEditPref,
    handleSaveEditPref,
    handleAddFact,
    handleRemoveFact,
    handleStartEditFact,
    handleCancelEditFact,
    handleSaveEditFact,
    handleClearAll
  }
}
