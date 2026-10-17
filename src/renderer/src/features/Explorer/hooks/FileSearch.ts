import { useMemo } from 'react'
import Fuse from 'fuse.js'
import { rankSnippets } from '../../../core/utils/searchRanker'

const NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function toTime(value?: string | number): number {
  if (value === undefined || value === null) return 0
  if (typeof value === 'number') return value
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

interface Snippet {
  id: string
  title?: string
  folderId?: string
  isPinned?: boolean
  timestamp?: number
  createdAt?: string | number
  [key: string]: unknown
}

interface Settings {
  sortBy?: string
  sortDirection?: string
  noteOrder?: string[] | null
  pinnedFolders?: string[]
  startMenuPinnedOrder?: string[]
  [key: string]: unknown
}

interface MatchMeta {
  matchSnippet?: string
  [key: string]: unknown
}

interface PinnedItem extends Snippet {
  itemType: 'snippet' | 'folder'
}

interface FileSearchResult {
  filteredSnippets: Snippet[]
  isQueryActive: boolean
  matchMetaMap: Map<string, MatchMeta>
  pinnedItems: PinnedItem[]
  allSnippets: Snippet[]
}

export function useFileSearch(
  snippets: Snippet[],
  query: string,
  settings: Settings,
  folders: string[] = []
): FileSearchResult {
  const sortBy = settings.sortBy || 'name'
  const sortDirection = settings.sortDirection || 'asc'
  const noteOrder = settings.noteOrder || null

  const fuseIndex = useMemo(() => {
    return new Fuse(snippets, {
      keys: [
        { name: 'title', weight: 3 },
        { name: 'folderId', weight: 1 }
      ],
      threshold: 0.4,
      ignoreLocation: true,
      includeScore: true
    })
  }, [snippets])

  const { filteredSnippets, isQueryActive, matchMetaMap } = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q)
      return {
        filteredSnippets: snippets,
        isQueryActive: false,
        matchMetaMap: new Map<string, MatchMeta>()
      }
    const { results, matchMetaMap } = rankSnippets(snippets, q, fuseIndex)
    return {
      filteredSnippets: results as Snippet[],
      isQueryActive: true,
      matchMetaMap: matchMetaMap as unknown as Map<string, MatchMeta>
    }
  }, [query, fuseIndex, snippets])

  const existingFolderIds = useMemo(() => {
    return new Set(
      (folders || [])
        .map((f) => (typeof f === 'string' ? f : (f as any)?.id || (f as any)?.name || ''))
        .filter(Boolean)
    )
  }, [folders])

  const pinnedItems = useMemo((): PinnedItem[] => {
    const dbPinned: PinnedItem[] = snippets
      .filter((s) => s.isPinned)
      .map((s) => ({ ...s, itemType: 'snippet' as const }))
    const folderPinned: PinnedItem[] = (settings.pinnedFolders || [])
      .filter((folderId) => existingFolderIds.has(folderId))
      .map((folderId) => ({
        id: folderId,
        title: folderId.split('/').pop(),
        itemType: 'folder' as const,
        isPinned: true
      }))

    const combined = [...dbPinned, ...folderPinned]
    const pinnedOrderMap = new Map((settings.startMenuPinnedOrder || []).map((id, i) => [id, i]))
    combined.sort((a, b) => {
      const ai = pinnedOrderMap.get(a.id)
      const bi = pinnedOrderMap.get(b.id)
      if (ai !== undefined && bi !== undefined) return ai - bi
      if (ai !== undefined) return -1
      if (bi !== undefined) return 1
      return 0
    })
    return combined
  }, [snippets, settings.startMenuPinnedOrder, settings.pinnedFolders, existingFolderIds])

  const allSnippets = useMemo((): Snippet[] => {
    if (isQueryActive) return filteredSnippets

    const all = [...filteredSnippets]
    const byName = (a: Snippet, b: Snippet) =>
      NAME_COLLATOR.compare(String(a.title ?? ''), String(b.title ?? ''))

    const validNoteOrder = Array.isArray(noteOrder) ? noteOrder : null
    if (sortBy === 'custom' && validNoteOrder && validNoteOrder.length > 0) {
      const orderMap = new Map(validNoteOrder.map((id, i) => [id, i]))
      all.sort((a, b) => {
        const ai = orderMap.get(a.id)
        const bi = orderMap.get(b.id)
        if (ai !== undefined && bi !== undefined) return ai - bi
        if (ai !== undefined) return -1
        if (bi !== undefined) return 1
        return byName(a, b)
      })
      return all
    }

    // Any missing/unknown mode (including 'custom' without a usable order)
    // falls back to a deterministic name sort so the list never ends up in
    // arbitrary timestamp order.
    const mode = sortBy === 'modified' || sortBy === 'created' ? sortBy : 'name'
    const dir = sortDirection === 'desc' ? -1 : 1
    all.sort((a, b) => {
      let cmp = 0
      if (mode === 'name') {
        cmp = byName(a, b)
      } else if (mode === 'modified') {
        cmp = (a.timestamp || 0) - (b.timestamp || 0)
      } else {
        cmp = toTime(a.createdAt) - toTime(b.createdAt)
      }
      return dir * cmp
    })
    return all
  }, [filteredSnippets, isQueryActive, sortBy, sortDirection, noteOrder])

  return {
    filteredSnippets,
    isQueryActive,
    matchMetaMap,
    pinnedItems,
    allSnippets
  }
}
