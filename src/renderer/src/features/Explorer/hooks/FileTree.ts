import { useMemo } from 'react'

interface Snippet {
  id: string
  title?: string
  folderId?: string
  [key: string]: unknown
}

interface CreatingState {
  type?: string
  kind?: string
  parentId?: string | null
}

interface TreeNode {
  id: string
  name: string
  children: Record<string, TreeNode>
  files: Snippet[]
  count?: number
}

interface RootNode {
  children: Record<string, TreeNode>
  files: Snippet[]
  count?: number
}

interface FlatTreeFolder {
  type: 'folder'
  id: string
  name: string
  depth: number
  count: number
}

interface FlatTreeFile {
  type: 'file'
  snippet: Snippet
  depth: number
}

interface FlatTreeInput {
  type: 'input'
  kind: string
  parentId: string
  depth: number
}

interface FlatTreeRootDrop {
  type: 'root-drop'
}

export type FlatTreeItem = FlatTreeFolder | FlatTreeFile | FlatTreeInput | FlatTreeRootDrop

interface UseFileTreeParams {
  allSnippets: Snippet[]
  folders: string[]
  activeTab: string
  query: string
  expandedFolders: Set<string>
  creating: CreatingState | null
  activeListDragItem?: unknown
  collapsedDuringSearch: Set<string>
  folderOrder?: string[] | null
}

const FOLDER_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

const calculateCounts = (node: RootNode | TreeNode): number => {
  let count = node.files.length
  for (const child of Object.values(node.children)) {
    count += calculateCounts(child)
  }
  node.count = count
  return count
}

export function useFileTree({
  allSnippets,
  folders,
  activeTab,
  query,
  expandedFolders,
  creating,
  collapsedDuringSearch,
  folderOrder
}: UseFileTreeParams): FlatTreeItem[] {
  const flatTree = useMemo((): FlatTreeItem[] => {
    if (activeTab !== 'all') return []

    const q = query.trim().toLowerCase()

    const root: RootNode = { children: {}, files: [] }

    folders.forEach((folderPath) => {
      const cleanPath = (folderPath || '').replace(/\\/g, '/')
      if (cleanPath.startsWith('.lumina') || cleanPath.startsWith('.')) return
      if (!q || cleanPath.toLowerCase().includes(q)) {
        const parts = cleanPath.split('/').filter(Boolean)
        let current: RootNode | TreeNode = root
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
        let current: RootNode | TreeNode = root
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

    const flat: FlatTreeItem[] = []

    calculateCounts(root)

    const traverse = (node: RootNode | TreeNode, depth: number, parentId = '') => {
      if (
        creating &&
        (creating.parentId || '') === parentId &&
        (creating.type === 'folder' || creating.kind === 'folder')
      ) {
        flat.push({ type: 'input', kind: 'folder', parentId, depth })
      }

      const folderNames = Object.keys(node.children).sort((a, b) => {
        return FOLDER_COLLATOR.compare(a, b)
      })

      folderNames.forEach((name) => {
        const folder = node.children[name]
        const count = folder.count || 0
        flat.push({ type: 'folder', id: folder.id, name: folder.name, depth, count })

        const isExpanded = q
          ? !collapsedDuringSearch.has(folder.id)
          : expandedFolders.has(folder.id)

        if (isExpanded) {
          traverse(folder, depth + 1, folder.id)
        }
      })

      if (
        creating &&
        (creating.parentId || '') === parentId &&
        (creating.type === 'note' ||
          creating.type === 'file' ||
          creating.type === 'canvas' ||
          creating.kind === 'note' ||
          creating.kind === 'file' ||
          creating.kind === 'canvas')
      ) {
        flat.push({
          type: 'input',
          kind: creating.type === 'canvas' || creating.kind === 'canvas' ? 'canvas' : 'note',
          parentId,
          depth
        })
      }

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
