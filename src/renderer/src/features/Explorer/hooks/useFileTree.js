import { useMemo } from 'react'

export function useFileTree({
  allSnippets,
  folders,
  activeTab,
  query,
  expandedFolders,
  creating,
  activeListDragItem,
  collapsedDuringSearch,
  folderOrder
}) {
  const flatTree = useMemo(() => {
    if (activeTab !== 'all') return []

    const q = query.trim().toLowerCase()

    // Build hierarchical tree
    const root = { children: {}, files: [] }

    folders.forEach((folderPath) => {
      const cleanPath = (folderPath || '').replace(/\\/g, '/')
      if (cleanPath.startsWith('.lumina') || cleanPath.startsWith('.')) return
      if (!q || cleanPath.toLowerCase().includes(q)) {
        const parts = cleanPath.split('/').filter(Boolean)
        let current = root
        let currentPath = ''
        parts.forEach((part) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part
          if (!current.children[part]) {
            current.children[part] = { id: currentPath, name: part, children: {}, files: [] }
          }
          current = current.children[part]
        })
      }
    })

    allSnippets.forEach((snippet) => {
      const folderId = (snippet.folderId || '').replace(/\\/g, '/')
      if (folderId.startsWith('.lumina') || folderId.startsWith('.')) return
      if (!folderId) {
        root.files.push(snippet)
      } else {
        const parts = folderId.split('/').filter(Boolean)
        let current = root
        let currentPath = ''
        parts.forEach((part) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part
          if (!current.children[part]) {
            current.children[part] = { id: currentPath, name: part, children: {}, files: [] }
          }
          current = current.children[part]
        })
        current.files.push(snippet)
      }
    })

    const flat = []

    // Helper: recursively calculate total notes inside a folder hierarchy for collapsed item badges
    const getNoteCount = (node) => {
      return (
        node.files.length +
        Object.values(node.children).reduce((acc, child) => acc + getNoteCount(child), 0)
      )
    }

    const traverse = (node, depth, parentId = '') => {
      // 1. Inject folder creation input at top of folder list
      if (
        creating &&
        (creating.parentId || '') === parentId &&
        (creating.type === 'folder' || creating.kind === 'folder')
      ) {
        flat.push({ type: 'input', kind: 'folder', parentId, depth })
      }

      const order = Array.isArray(folderOrder) ? folderOrder : []
      const folderNames = Object.keys(node.children).sort((a, b) => {
        const fullPathA = parentId ? `${parentId}/${a}` : a
        const fullPathB = parentId ? `${parentId}/${b}` : b
        const idxA = order.indexOf(fullPathA)
        const idxB = order.indexOf(fullPathB)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        if (idxA !== -1) return -1
        if (idxB !== -1) return 1
        return a.localeCompare(b)
      })

      folderNames.forEach((name) => {
        const folder = node.children[name]
        const count = getNoteCount(folder)
        flat.push({ type: 'folder', id: folder.id, name: folder.name, depth, count })

        const isExpanded = q
          ? !collapsedDuringSearch.has(folder.id)
          : expandedFolders.has(folder.id)

        if (isExpanded) {
          traverse(folder, depth + 1, folder.id)
        }
      })

      // 2. Inject note/file creation input at top of file list
      if (
        creating &&
        (creating.parentId || '') === parentId &&
        (creating.type === 'note' || creating.type === 'file' || creating.kind === 'note' || creating.kind === 'file')
      ) {
        flat.push({ type: 'input', kind: 'note', parentId, depth })
      }

      // Files in this level
      node.files.forEach((file) => {
        flat.push({ type: 'file', snippet: file, depth })
      })
    }

    traverse(root, 0)

    return flat
  }, [
    allSnippets,
    folders,
    activeTab,
    query,
    expandedFolders,
    creating,
    collapsedDuringSearch,
    folderOrder
  ])

  return flatTree
}
