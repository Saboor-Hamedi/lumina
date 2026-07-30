import { useMemo } from 'react'

export function useFileTree({
  allSnippets,
  folders,
  activeTab,
  query,
  expandedFolders,
  creating,
  activeListDragItem,
  collapsedDuringSearch
}) {
  const flatTree = useMemo(() => {
    if (activeTab !== 'all') return []

    const q = query.trim().toLowerCase()

    // Build hierarchical tree
    const root = { children: {}, files: [] }

    // 1. Build Folders
    folders.forEach((folderPath) => {
      if (!q || folderPath.toLowerCase().includes(q)) {
        const parts = folderPath.split('/')
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

    // 2. Build Snippets
    allSnippets.forEach((snippet) => {
      const folderId = snippet.folderId || ''
      if (!folderId) {
        root.files.push(snippet)
      } else {
        const parts = folderId.split('/')
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

    // Inject drop to root zone if dragging
    if (activeListDragItem) {
      flat.push({ type: 'root-drop', id: 'root-drop-zone', depth: 0 })
    }

    // Helper: recursively calculate total notes inside a folder hierarchy for collapsed item badges
    const getNoteCount = (node) => {
      return node.files.length + Object.values(node.children).reduce((acc, child) => acc + getNoteCount(child), 0)
    }

    const traverse = (node, depth, parentId = '') => {
      // Sort folders alphabetically
      const folderNames = Object.keys(node.children).sort((a, b) => a.localeCompare(b))

      folderNames.forEach((name) => {
        const folder = node.children[name]
        const count = getNoteCount(folder)
        flat.push({ type: 'folder', id: folder.id, name: folder.name, depth, count })

        const isExpanded = q
          ? !collapsedDuringSearch.has(folder.id)
          : expandedFolders.has(folder.id)

        if (isExpanded) {
          // Inject nested creation input
          if (creating && creating.parentId === folder.id) {
            flat.push({ type: 'input', kind: creating.type, parentId: folder.id, depth: depth + 1 })
          }
          traverse(folder, depth + 1, folder.id)
        }
      })

      // Files in this level
      node.files.forEach((file) => {
        flat.push({ type: 'file', snippet: file, depth })
      })
    }

    traverse(root, 0)

    // Inject root level creation input at the bottom
    if (creating && !creating.parentId) {
      flat.push({ type: 'input', kind: creating.type, parentId: '', depth: 0 })
    }

    return flat
  }, [
    allSnippets,
    folders,
    activeTab,
    query,
    expandedFolders,
    creating,
    activeListDragItem,
    collapsedDuringSearch
  ])

  return flatTree
}
