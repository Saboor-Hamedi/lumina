import { useState, useRef, useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { useSettingsStore } from '../../../core/store/SettingStore'
import { revealSnippetFolders } from '../utils/explorerSelectionHelper'

interface Snippet {
  id: string
  folderId?: string
  title?: string
  fileName?: string
  code?: string
  language?: string
  type?: string
  tags?: string
  timestamp?: number
  isPinned?: boolean
  isLearned?: boolean
  [key: string]: unknown
}

interface FlatTreeItem {
  type: 'file' | 'folder' | 'input' | 'root-drop'
  snippet?: Snippet
  depth?: number
  [key: string]: unknown
}

interface CreatingState {
  type: string
  parentId: string | null
}

interface UseExplorerOperationsParams {
  snippets: Snippet[]
  visibleFolders: string[]
  selectedSnippetId: string | null
  query: string
  flatTree: FlatTreeItem[] | null
  virtuosoRef: React.RefObject<any>
  setSidebarFocus: (focus: string | null) => void
  handleSelect: (snippet: Snippet) => void
  lastClickedFolder: string | null
}

interface ExplorerOperationsResult {
  expandedFolders: Set<string>
  setExpandedFolders: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  collapsedDuringSearch: Set<string>
  setCollapsedDuringSearch: React.Dispatch<React.SetStateAction<Set<string>>>
  creating: CreatingState | null
  setCreating: React.Dispatch<React.SetStateAction<CreatingState | null>>
  creatingValue: string
  setCreatingValue: React.Dispatch<React.SetStateAction<string>>
  renamingFolder: string | null
  setRenamingFolder: React.Dispatch<React.SetStateAction<string | null>>
  renamingValue: string
  setRenamingValue: React.Dispatch<React.SetStateAction<string>>
  toggleFolder: (folderId: string, e?: React.MouseEvent | null) => void
  collapseAllFolders: (e?: React.MouseEvent | null) => void
  cancelRename: () => void
  submitCreation: (value?: string) => Promise<void>
  submitRename: (value?: string) => Promise<void>
}

export function useExplorerOperations({
  snippets,
  visibleFolders,
  selectedSnippetId,
  query,
  flatTree,
  virtuosoRef,
  setSidebarFocus,
  handleSelect,
  lastClickedFolder
}: UseExplorerOperationsParams): ExplorerOperationsResult {
  const expandedFoldersSetting = useSettingsStore((state) => (state.settings as any)?.expandedFolders)
  const folderOrder = useSettingsStore((state) => (state.settings as any)?.folderOrder)
  const updateSetting = useSettingsStore((state) => state.updateSetting)
  const saveNote = useWorkspaceStore((state) => state.saveNote)
  const loadWorkspace = useWorkspaceStore((state) => state.loadWorkspace)

  const [expandedFolders, setExpandedFoldersRaw] = useState<Set<string>>(() => {
    try {
      const cached = localStorage.getItem('lumina-expanded-folders')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed)) return new Set(parsed)
      }
    } catch (_) {}
    return new Set(Array.isArray(expandedFoldersSetting) ? expandedFoldersSetting : [])
  })
  const [collapsedDuringSearch, setCollapsedDuringSearch] = useState<Set<string>>(() => new Set())
  const expandedFoldersRef = useRef<Set<string>>(expandedFolders)

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setExpandedFolders = useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    let nextArr: string[] | null = null
    setExpandedFoldersRaw((prev: Set<string>): Set<string> => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      const nextSet: Set<string> = next instanceof Set ? (next as Set<string>) : new Set<string>(next || [])
      expandedFoldersRef.current = nextSet
      nextArr = Array.from(nextSet)
      return nextSet
    })
    if (nextArr) {
      try {
        localStorage.setItem('lumina-expanded-folders', JSON.stringify(nextArr))
      } catch (_) {}

      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null
        useSettingsStore.getState().updateSetting('expandedFolders', nextArr)
      }, 350)
    }
  }, [])

  useEffect(() => {
    const handleFlush = () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
      const current = Array.from(expandedFoldersRef.current || [])
      try {
        localStorage.setItem('lumina-expanded-folders', JSON.stringify(current))
      } catch (_) {}
      useSettingsStore.getState().updateSetting('expandedFolders', current)
    }

    window.addEventListener('beforeunload', handleFlush)
    return () => {
      window.removeEventListener('beforeunload', handleFlush)
      handleFlush()
    }
  }, [])

  const isInitialSettingsSyncRef = useRef(true)

  useEffect(() => {
    if (!Array.isArray(expandedFoldersSetting)) return

    if (isInitialSettingsSyncRef.current) {
      isInitialSettingsSyncRef.current = false
      if (expandedFoldersSetting.length === 0 && expandedFoldersRef.current.size > 0) {
        return
      }
    }

    const incomingSet = new Set<string>(expandedFoldersSetting)
    setExpandedFoldersRaw((prev) => {
      if (prev.size === incomingSet.size) {
        let same = true
        for (const x of prev) {
          if (!incomingSet.has(x)) {
            same = false
            break
          }
        }
        if (same) return prev
      }
      expandedFoldersRef.current = incomingSet
      try {
        localStorage.setItem('lumina-expanded-folders', JSON.stringify(expandedFoldersSetting))
      } catch (_) {}
      return incomingSet
    })
  }, [expandedFoldersSetting])

  const isInitialMountRef = useRef(true)
  const lastRevealedSnippetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedSnippetId) {
      return
    }

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      lastRevealedSnippetIdRef.current = selectedSnippetId
      return
    }

    if (lastRevealedSnippetIdRef.current === selectedSnippetId) return
    lastRevealedSnippetIdRef.current = selectedSnippetId

    const activeSnippet = snippets.find((s) => s.id === selectedSnippetId)
    if (!activeSnippet || !activeSnippet.folderId) return

    revealSnippetFolders(activeSnippet, setExpandedFolders)
  }, [selectedSnippetId, snippets, setExpandedFolders])

  const [creating, setCreating] = useState<CreatingState | null>(null)
  const [creatingValue, setCreatingValue] = useState('')

  const [renamingFolder, setRenamingFolder] = useState<string | null>(null)
  const [renamingValue, setRenamingValue] = useState('')

  useEffect(() => {
    if (creating && flatTree && flatTree.length > 0) {
      const idx = flatTree.findIndex((item) => item.type === 'input')
      if (idx !== -1 && virtuosoRef.current) {
        virtuosoRef.current?.scrollToIndex({ index: idx, align: 'nearest' })
      }
    }
  }, [creating, flatTree, virtuosoRef])

  useEffect(() => {
    const handleTriggerNewNote = () => {
      let targetFolderId = lastClickedFolder
      if (targetFolderId === null) {
        const activeSnippet = snippets.find((s) => s.id === selectedSnippetId)
        targetFolderId = activeSnippet?.folderId || ''
      }

      if (targetFolderId) {
        setExpandedFolders((prev) => new Set(prev).add(targetFolderId!))
      }
      setCreating({ type: 'file', parentId: targetFolderId || null })
      setCreatingValue('')
    }

    const handleTriggerNewCanvas = () => {
      let targetFolderId = lastClickedFolder
      if (targetFolderId === null) {
        const activeSnippet = snippets.find((s) => s.id === selectedSnippetId)
        targetFolderId = activeSnippet?.folderId || ''
      }

      if (targetFolderId) {
        setExpandedFolders((prev) => new Set(prev).add(targetFolderId!))
      }
      setCreating({ type: 'canvas', parentId: targetFolderId || null })
      setCreatingValue('')
    }

    const handleRevealFolder = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const raw = detail?.folderId || detail
      if (!raw) return
      const folderId = String(raw).replace(/^[/\\]+|[/\\]+$/g, '')
      if (!folderId) return

      const foldersToExpand: string[] = []
      const parts = folderId.split('/').filter(Boolean)
      let acc = ''
      for (const p of parts) {
        acc = acc ? `${acc}/${p}` : p
        foldersToExpand.push(acc)
      }

      const currentSet = expandedFoldersRef.current
      const next = new Set(currentSet)
      let changed = false
      for (const id of foldersToExpand) {
        if (!next.has(id)) {
          next.add(id)
          changed = true
        }
      }

      if (changed) {
        setExpandedFolders(next)
      }

      useWorkspaceStore.getState().setSelectedFolder(folderId)
    }

    const handleFocusRoot = () => {
      useWorkspaceStore.getState().setSelectedFolder(null)
      if (virtuosoRef?.current) {
        virtuosoRef.current.scrollToIndex({ index: 0, align: 'start' })
      }
    }

    window.addEventListener('trigger-new-note', handleTriggerNewNote)
    window.addEventListener('reveal-folder-in-explorer', handleRevealFolder)
    window.addEventListener('focus-explorer-root', handleFocusRoot)

    return () => {
      window.removeEventListener('trigger-new-note', handleTriggerNewNote)
      window.removeEventListener('reveal-folder-in-explorer', handleRevealFolder)
      window.removeEventListener('focus-explorer-root', handleFocusRoot)
    }
  }, [lastClickedFolder, selectedSnippetId, snippets, visibleFolders, virtuosoRef, setExpandedFolders])

  const toggleFolder = useCallback(
    (folderId: string, e?: React.MouseEvent | null) => {
      if (e) e.stopPropagation()
      useWorkspaceStore.getState().setSelectedFolder(folderId)
      if (query.trim()) {
        setCollapsedDuringSearch((prev) => {
          const next = new Set(prev)
          if (next.has(folderId)) next.delete(folderId)
          else next.add(folderId)
          return next
        })
      } else {
        setExpandedFolders((prev) => {
          const next = new Set(prev)
          if (next.has(folderId)) next.delete(folderId)
          else next.add(folderId)
          return next
        })
      }
    },
    [setExpandedFolders, query]
  )

  const collapseAllFolders = useCallback(
    (e?: React.MouseEvent | null) => {
      if (e) e.stopPropagation()
      setExpandedFolders(new Set())
    },
    [setExpandedFolders]
  )

  const cancelRename = useCallback(() => setRenamingFolder(null), [])

  const submitCreation = useCallback(
    async (value?: string) => {
      const valToUse = typeof value === 'string' ? value : creatingValue
      if (!creating || !valToUse.trim()) {
        setCreating(null)
        return
      }

      const sanitizedName = valToUse.trim().replace(/[<>:"/\\|?*]/g, '')
      if (!sanitizedName) {
        setCreating(null)
        return
      }

      try {
        if (creating.type === 'folder') {
          const folderPath = creating.parentId
            ? `${creating.parentId}/${sanitizedName}`
            : sanitizedName
          await (window as any).api.createFolder(folderPath)
          setExpandedFolders((prev) => new Set(prev).add(folderPath))
          await loadWorkspace()
        } else if (creating.type === 'canvas') {
          const newId = crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 15)
          const folderId = creating.parentId || ''
          const defaultCanvasData = {
            nodes: [
              {
                id: `node-${Date.now()}`,
                type: 'text',
                title: 'Idea Board',
                text: 'Welcome to Lumina Canvas! Double-click to add ideas or connect cards.',
                x: 120,
                y: 120,
                width: 260,
                height: 160,
                color: 'default'
              }
            ],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 }
          }
          const newSnippet: Snippet = {
            id: newId,
            title: sanitizedName,
            fileName: `${sanitizedName}.canvas`,
            code: JSON.stringify(defaultCanvasData, null, 2),
            language: 'canvas',
            type: 'canvas',
            tags: '',
            folderId: folderId,
            timestamp: Date.now(),
            isPinned: false,
            isLearned: false
          }
          if (saveNote) await saveNote(newSnippet)
          if (folderId) setExpandedFolders((prev) => new Set(prev).add(folderId))
          handleSelect(newSnippet)
        } else {
          const newId = crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 15)
          const folderId = creating.parentId || ''
          const newSnippet: Snippet = {
            id: newId,
            title: sanitizedName,
            code: '',
            language: 'markdown',
            tags: '',
            folderId: folderId,
            timestamp: Date.now(),
            isPinned: false,
            isLearned: false
          }
          if (saveNote) await saveNote(newSnippet)
          if (folderId) setExpandedFolders((prev) => new Set(prev).add(folderId))
          handleSelect(newSnippet)
        }
      } catch (err) {
        console.error('Failed to create item:', err)
      }
      setCreating(null)
      setCreatingValue('')
      setSidebarFocus(null)
    },
    [creating, creatingValue, folderOrder, updateSetting, loadWorkspace, saveNote, handleSelect, setSidebarFocus, setExpandedFolders]
  )

  const submitRename = useCallback(
    async (value?: string) => {
      const valToUse = typeof value === 'string' ? value : renamingValue
      if (!renamingFolder || !valToUse.trim()) {
        setRenamingFolder(null)
        return
      }

      const sanitizedName = valToUse.trim().replace(/[<>:"/\\|?*]/g, '')
      if (!sanitizedName) {
        setRenamingFolder(null)
        return
      }

      try {
        const parts = renamingFolder.split('/')
        parts[parts.length - 1] = sanitizedName
        const newPath = parts.join('/')

        if (newPath !== renamingFolder) {
          await (window as any).api.renameFolder(renamingFolder, newPath)
          await loadWorkspace()
        }
      } catch (err) {
        console.error('Rename failed:', err)
      }
      setRenamingFolder(null)
    },
    [renamingFolder, renamingValue, loadWorkspace]
  )

  return {
    expandedFolders,
    setExpandedFolders,
    collapsedDuringSearch,
    setCollapsedDuringSearch,
    creating,
    setCreating,
    creatingValue,
    setCreatingValue,
    renamingFolder,
    setRenamingFolder,
    renamingValue,
    setRenamingValue,
    toggleFolder,
    collapseAllFolders,
    cancelRename,
    submitCreation,
    submitRename
  }
}
