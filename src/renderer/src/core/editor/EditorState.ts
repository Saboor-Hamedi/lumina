import { useState, useEffect, useRef, useCallback } from 'react'
import { useSettingsStore } from '../store/SettingStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import type { UseEditorStateProps, UseEditorStateReturn, Snippet } from './types'

export interface ConflictPrompt {
  snippetCode?: string
  snippetTitle?: string
}

/**
 * Hardened Editor State Hook (`EditorState.ts`)
 *
 * Responsibilities:
 * - Manages active snippet synchronization and tab switching
 * - Manages dirty state, save state, and local code refs
 * - Handles debounced auto-saving (1500ms) and unmount auto-saving
 * - Detects external file conflicts (suppresses chokidar watcher echoes)
 * - Manages conflict overwrite modal state
 */
export function useEditorState({
  snippet,
  onSave,
  showToast,
  realViewRef,
  editorHandleRef
}: UseEditorStateProps): UseEditorStateReturn {
  const [title, setTitle] = useState<string>(snippet?.title || '')
  const titleStateRef = useRef<string>(title)
  useEffect(() => {
    titleStateRef.current = title
  }, [title])

  const [isDirty, setIsDirty] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [editorKey, setEditorKey] = useState<number>(Date.now())
  const [conflictPrompt, setConflictPrompt] = useState<ConflictPrompt | null>(null)

  const isMountedRef = useRef<boolean>(true)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const handleSaveRef = useRef<(() => Promise<void>) | null>(null)
  const snippetRef = useRef<Snippet | null>(snippet)
  const latestCodeRef = useRef<string>(snippet?.code || '')
  const lastSavedCodeRef = useRef<string>(snippet?.code || '')
  const lastSaveTimeRef = useRef<number>(0)

  const setDirty = useWorkspaceStore((state: any) => state.setDirty)

  // --- Save Logic ---
  const handleSave = useCallback(async () => {
    if (
      !isMountedRef.current ||
      !snippetRef.current ||
      snippetRef.current.isOversized ||
      !snippet?.id ||
      !editorHandleRef.current
    ) {
      return
    }

    if (isSaving) return

    try {
      setIsSaving(true)
      const code = editorHandleRef.current.getMarkdown()

      const snippetToSave: Snippet = {
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
        if (updatedSnippet && typeof updatedSnippet === 'object' && 'title' in updatedSnippet && updatedSnippet.title && updatedSnippet.title !== title) {
          setTitle(updatedSnippet.title)
        }
        setIsDirty(false)
        setDirty(snippet.id, false)
      }
    } catch (error) {
      console.error('[EditorState] Save failed:', error)
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false)
      }
    }
  }, [snippet?.id, isSaving, title, onSave, setDirty, editorHandleRef])

  handleSaveRef.current = handleSave

  // --- Change Handler ---
  const handleMarkdownChange = useCallback(
    (newContent: string) => {
      if (snippet?.isOversized) return

      latestCodeRef.current = newContent
      setIsDirty(true)
      if (snippet?.id) {
        setDirty(snippet.id, true)
      }

      const settings = (useSettingsStore.getState() as any).settings
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
    [snippet?.id, snippet?.isOversized, setDirty]
  )

  // --- Snippet Sync & External Conflict Detection ---
  useEffect(() => {
    const previousSnippet = snippetRef.current
    snippetRef.current = snippet
    setTitle(snippet?.title || '')

    const isSameFile = previousSnippet?.id === snippet?.id

    if (!isSameFile) {
      // Tab switched: React key on AtomicCodeMirrorEditor handles remount
      lastSavedCodeRef.current = snippet?.code || ''
      latestCodeRef.current = snippet?.code || ''
      setIsDirty(false)
      return
    }

    if (editorHandleRef.current) {
      const currentCode = editorHandleRef.current.getMarkdown()
      const incomingCode = snippet?.code ?? ''

      // If store snippet content matches current editor text or latest edits, sync and do nothing
      if (incomingCode === currentCode || incomingCode === latestCodeRef.current) {
        lastSavedCodeRef.current = incomingCode
        return
      }

      const codeChangedFromOutside = incomingCode !== lastSavedCodeRef.current

      if (codeChangedFromOutside) {
        const timeSinceLastSave = Date.now() - lastSaveTimeRef.current
        // Suppress chokidar echo if saved within last 3s and not dirty
        if (timeSinceLastSave < 3000 && !isDirty) {
          lastSavedCodeRef.current = incomingCode
          return
        }

        // A true conflict ONLY exists if user has active unsaved local edits
        // that differ non-trivially from both incomingCode and currentCode
        const hasUnsavedEdits = isDirty && currentCode !== lastSavedCodeRef.current
        const isTrivialDifference = incomingCode.trim() === currentCode.trim()

        if (hasUnsavedEdits && !isTrivialDifference) {
          // Real conflict: user is actively typing and external changes arrived
          setConflictPrompt({
            snippetCode: incomingCode,
            snippetTitle: snippet?.title || 'Untitled'
          })
        } else {
          // Safe to sync external changes (e.g. reload, disk sync, or AI tool updates)
          setIsDirty(false)
          lastSavedCodeRef.current = incomingCode
          latestCodeRef.current = incomingCode

          if (realViewRef.current) {
            const view = realViewRef.current
            const currentDoc = view.state.doc.toString()
            if (currentDoc !== incomingCode) {
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: incomingCode }
              })
            }
          } else {
            if (currentCode !== incomingCode) {
              setEditorKey((k) => k + 1)
            }
          }
        }
      }
    }
  }, [snippet, isDirty, editorHandleRef, realViewRef])

  // --- Auto-Save on State Change ---
  useEffect(() => {
    if (!snippet?.id || !isDirty) return
    const settings = (useSettingsStore.getState() as any).settings
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

      const currentSettings = (useSettingsStore.getState() as any).settings
      const dirtyIds = (useWorkspaceStore.getState() as any).dirtyNoteIds || []

      if (
        currentSettings?.autoSave &&
        snippetRef.current &&
        dirtyIds.includes(snippetRef.current.id)
      ) {
        const codeToSave = latestCodeRef.current
        const snippetToSave: Snippet = {
          ...snippetRef.current,
          code: codeToSave || '',
          timestamp: Date.now()
        }
        const saveAction = (useWorkspaceStore.getState() as any).saveNote || (useWorkspaceStore.getState() as any).saveSnippet
        if (saveAction) {
          saveAction(snippetToSave).catch((err: any) => console.error('[Unmount AutoSave] Failed:', err))
        }
      }
    }
  }, [])

  // --- Conflict Modal Handlers ---
  const handleOverwriteClose = useCallback(() => {
    // User chose "Keep My Edits": preserve user's local edits and save them
    if (conflictPrompt) {
      lastSavedCodeRef.current = latestCodeRef.current
      if (handleSaveRef.current) {
        handleSaveRef.current()
      }
    }
    setConflictPrompt(null)
  }, [conflictPrompt])

  const handleOverwriteConfirm = useCallback(async () => {
    if (!conflictPrompt) return
    const code = conflictPrompt.snippetCode || ''
    setIsDirty(false)
    if (snippet?.id) {
      setDirty(snippet.id, false)
    }
    lastSavedCodeRef.current = code
    latestCodeRef.current = code
    if (realViewRef.current) {
      const view = realViewRef.current
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code }
      })
    } else {
      setEditorKey((k) => k + 1)
    }
    setConflictPrompt(null)
  }, [conflictPrompt, realViewRef, snippet?.id, setDirty])

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

// Named alias and default export
export const EditorState = useEditorState
export default useEditorState
