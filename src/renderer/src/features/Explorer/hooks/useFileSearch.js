import { useMemo } from 'react'
import Fuse from 'fuse.js'
import { rankSnippets } from '../../../core/utils/searchRanker'

export function useFileSearch(snippets, query, settings) {
  const sortBy = settings.sortBy || 'name'
  const sortDirection = settings.sortDirection || 'asc'
  const noteOrder = settings.noteOrder || null

  // 0. Fuse Index (title + folderId, with score info)
  const fuseIndex = useMemo(() => {
    return new Fuse(snippets, {
      keys: [{ name: 'title', weight: 3 }, { name: 'folderId', weight: 1 }],
      threshold: 0.4,
      ignoreLocation: true,
      includeScore: true
    })
  }, [snippets])

  // 1. Filtered + ranked snippets — uses shared searchRanker utility
  const { filteredSnippets, isQueryActive, matchMetaMap } = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return { filteredSnippets: snippets, isQueryActive: false, matchMetaMap: new Map() }
    const { results, matchMetaMap } = rankSnippets(snippets, q, fuseIndex)
    return { filteredSnippets: results, isQueryActive: true, matchMetaMap }
  }, [query, fuseIndex, snippets])

  // 2. Pinned items (snippets + folders)
  const pinnedItems = useMemo(() => {
    const dbPinned = snippets.filter((s) => s.isPinned).map((s) => ({ ...s, itemType: 'snippet' }))
    const folderPinned = (settings.pinnedFolders || []).map((folderId) => {
      return {
        id: folderId,
        title: folderId.split('/').pop(),
        itemType: 'folder',
        isPinned: true
      }
    })

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
  }, [snippets, settings.startMenuPinnedOrder, settings.pinnedFolders])

  // 3. All snippets sorted
  const allSnippets = useMemo(() => {
    if (isQueryActive) return [...filteredSnippets]

    let all = [...filteredSnippets]

    if (sortBy === 'custom' && noteOrder && noteOrder.length > 0) {
      const orderMap = new Map(noteOrder.map((id, i) => [id, i]))
      all.sort((a, b) => {
        const ai = orderMap.get(a.id)
        const bi = orderMap.get(b.id)
        if (ai !== undefined && bi !== undefined) return ai - bi
        if (ai !== undefined) return -1
        if (bi !== undefined) return 1
        return (a.title || '').localeCompare(b.title || '')
      })
    } else {
      all.sort((a, b) => {
        let cmp = 0
        if (sortBy === 'name') {
          cmp = (a.title || '').localeCompare(b.title || '')
        } else if (sortBy === 'modified') {
          cmp = (a.timestamp || 0) - (b.timestamp || 0)
        }
        return sortDirection === 'asc' ? cmp : -cmp
      })
    }
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
