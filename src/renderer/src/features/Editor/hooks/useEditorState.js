/**
 * =========================================================================================
 * Editor State Hook (`useEditorState.js`)
 * =========================================================================================
 *
 * Responsibilities:
 * - Manages active snippet synchronization and tab switching
 * - Manages dirty state, save state, and local code refs
 * - Handles debounced auto-saving (1500ms) and unmount auto-saving
 * - Detects external file conflicts (suppresses chokidar watcher echoes)
 * - Manages conflict overwrite modal state
 * =========================================================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import { useVaultStore } from '../../../core/store/workspaceStore'

export function useEditorState({ snippet, onSave, showToast, realViewRef, editorHandleRef }) {
  const [title, setTitle] = useState(snippet?.title || '')
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editorKey, setEditorKey] = useState(Date.now())
  const [conflictPrompt, setConflictPrompt] = useState(null)

  const isMountedRef = useRef(true)
  const autoSaveTimerRef = useRef(null)
  const handleSaveRef = useRef(null)
  const snippetRef = useRef(snippet)
  const latestCodeRef = useRef(snippet?.code || '')
  const lastSavedCodeRef = useRef(snippet?.code)
  const lastSaveTimeRef = useRef(0)

  const setDirty = useVaultStore((state) => state.setDirty)

  // --- Save Logic ---
  const handleSave = useCallback(async () => {
    if (
      !isMountedRef.current ||
      !snippetRef.current ||
      !snippet?.id ||
      !editorHandleRef.current
    ) {
      return
    }

    if (isSaving) return

    try {
      setIsSaving(true)
      const code = editorHandleRef.current.getMarkdown()

      const snippetToSave = {
        ...snippetRef.current,
        code: code || '',
        title: title || 'Untitled',
        timestamp: Date.now()
      }

      // Track save time and saved code before await to suppress chokidar echoes
      lastSavedCodeRef.current = code || ''
      lastSaveTimeRef.current = Date.now()

      const updatedSnippet = await onSave(snippetToSave)

      if (isMountedRef.current) {
        if (updatedSnippet?.title && updatedSnippet.title !== title) {
          setTitle(updatedSnippet.title)
        }
        setIsDirty(false)
        setDirty(snippet.id, false)
      }
    } catch (error) {
      console.error('Failed to save note:', error)
      if (isMountedRef.current) {
        showToast(`Failed to save note: ${error?.message || 'Unknown error'}`, 'error')
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false)
      }
    }
  }, [title, snippet?.id, onSave, setDirty, showToast, isSaving, editorHandleRef])

  useEffect(() => {
    handleSaveRef.current = handleSave
  }, [handleSave])

  // --- Markdown Change Handler ---
  const handleMarkdownChange = useCallback(
    (md) => {
      latestCodeRef.current = md
      setIsDirty(true)
      setDirty(snippet?.id, true)
      useVaultStore.getState().setDraft(snippet?.id, md)

      const settings = useSettingsStore.getState().settings
      if (settings?.autoSave) {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = setTimeout(() => {
          if (
            isMountedRef.current &&
            snippetRef.current?.id === snippet?.id &&
            handleSaveRef.current
          ) {
            handleSaveRef.current()
          }
        }, 1500)
      }
    },
    [snippet?.id, setDirty]
  )

  // --- Snippet Sync & External Conflict Detection ---
  useEffect(() => {
    const previousSnippet = snippetRef.current
    snippetRef.current = snippet
    setTitle(snippet?.title || '')

    const isSameFile = previousSnippet?.id === snippet?.id

    if (!isSameFile) {
      // Tab switched: React key on AtomicCodeMirrorEditor handles remount
      lastSavedCodeRef.current = snippet?.code
      latestCodeRef.current = snippet?.code || ''
      setIsDirty(false)
      return
    }

    if (editorHandleRef.current) {
      const currentCode = editorHandleRef.current.getMarkdown()

      // If store snippet content matches current editor text or latest edits, sync lastSavedCodeRef and do nothing
      if (snippet?.code === currentCode || snippet?.code === latestCodeRef.current) {
        lastSavedCodeRef.current = snippet?.code
        return
      }

      const codeChangedFromOutside = snippet?.code !== lastSavedCodeRef.current

      if (codeChangedFromOutside) {
        const timeSinceLastSave = Date.now() - lastSaveTimeRef.current
        // Suppress chokidar echo if saved within last 3s
        if (timeSinceLastSave < 3000) {
          return
        }

        const hasLocalEdits = currentCode !== lastSavedCodeRef.current
        const isTrivialExternalChange =
          (snippet?.code || '').trim() === (lastSavedCodeRef.current || '').trim()

        if (hasLocalEdits && !isTrivialExternalChange) {
          // Real conflict: prompt user
          setConflictPrompt({
            snippetCode: snippet?.code,
            snippetTitle: snippet?.title
          })
        } else if (hasLocalEdits && isTrivialExternalChange) {
          // Trivial external change (e.g. trailing newline): preserve local edits
          lastSavedCodeRef.current = snippet?.code
        } else {
          // Safe to overwrite
          setIsDirty(false)
          lastSavedCodeRef.current = snippet?.code

          if (realViewRef.current) {
            const view = realViewRef.current
            const needsClear = snippet?.code === '' && view.state.doc.length > 0
            if (
              (typeof snippet?.code === 'string' && currentCode !== snippet.code) ||
              needsClear
            ) {
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: snippet.code || '' }
              })
            }
          } else {
            if (typeof snippet?.code === 'string' && currentCode !== snippet.code) {
              setEditorKey((k) => k + 1)
            }
          }
        }
      }
    }
  }, [snippet, editorHandleRef, realViewRef])

  // --- Auto-Save on State Change ---
  useEffect(() => {
    if (!snippet?.id || !isDirty) return
    const settings = useSettingsStore.getState().settings
    if (!settings?.autoSave) return

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    const timer = setTimeout(() => {
      if (
        isMountedRef.current &&
        snippetRef.current?.id === snippet.id &&
        handleSaveRef.current
      ) {
        handleSaveRef.current()
      }
    }, 1500)
    autoSaveTimerRef.current = timer
    return () => clearTimeout(timer)
  }, [isDirty, title, snippet?.id])

  // --- Cleanup & Unmount Auto-Save ---
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)

      const currentSettings = useSettingsStore.getState().settings
      const dirtyIds = useVaultStore.getState().dirtySnippetIds || []

      if (
        currentSettings.autoSave &&
        snippetRef.current &&
        dirtyIds.includes(snippetRef.current.id)
      ) {
        const codeToSave = latestCodeRef.current
        const snippetToSave = {
          ...snippetRef.current,
          code: codeToSave || '',
          timestamp: Date.now()
        }
        useVaultStore
          .getState()
          .saveSnippet(snippetToSave)
          .catch((err) => console.error('[Unmount AutoSave] Failed:', err))
      }
    }
  }, [])

  // --- Conflict Modal Handlers ---
  const handleOverwriteClose = useCallback(() => {
    if (conflictPrompt) lastSavedCodeRef.current = conflictPrompt.snippetCode
    setConflictPrompt(null)
  }, [conflictPrompt])

  const handleOverwriteConfirm = useCallback(() => {
    if (!conflictPrompt) return
    const code = conflictPrompt.snippetCode
    setIsDirty(false)
    lastSavedCodeRef.current = code
    if (realViewRef.current) {
      const view = realViewRef.current
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code || '' }
      })
    } else {
      setEditorKey((k) => k + 1)
    }
    setConflictPrompt(null)
  }, [conflictPrompt, realViewRef])

  return {
    title,
    setTitle,
    isDirty,
    setIsDirty,
    isSaving,
    editorKey,
    conflictPrompt,
    snippetRef,
    latestCodeRef,
    lastSavedCodeRef,
    lastSaveTimeRef,
    handleSave,
    handleMarkdownChange,
    handleOverwriteClose,
    handleOverwriteConfirm
  }
}
