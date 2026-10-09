/**
 * explorerSelectionHelper.ts
 * Centralized, reusable utilities for File Explorer item selection,
 * active note state resolution, and folder hierarchy expansion.
 */

/**
 * Computes all ancestor folder paths for a given folder path.
 * E.g., 'Work/Projects/Lumina' -> ['Work', 'Work/Projects', 'Work/Projects/Lumina']
 * Handles Windows backslashes and cleans trailing/leading slashes.
 */
export function getAncestorFolderPaths(folderPath: string | null | undefined): string[] {
  if (!folderPath || typeof folderPath !== 'string') return []
  const clean = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim()
  if (!clean) return []

  const parts = clean.split('/').filter(Boolean)
  const paths: string[] = []
  let current = ''

  for (const part of parts) {
    current = current ? `${current}/${part}` : part
    paths.push(current)
  }

  return paths
}

/**
 * Ensures all ancestor folders for a given snippet are expanded in the folder tree.
 * Avoids unnecessary state updates if all ancestors are already expanded.
 */
export function revealSnippetFolders(
  snippet: { folderId?: string } | null | undefined,
  setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>> | ((fn: (prev: Set<string>) => Set<string>) => void)
): string[] {
  if (!snippet || !snippet.folderId || !setExpandedFolders) return []
  const ancestors = getAncestorFolderPaths(snippet.folderId)
  if (ancestors.length === 0) return []

  setExpandedFolders((prev: Set<string> | any) => {
    const prevSet = prev instanceof Set ? prev : new Set(prev || [])
    let changed = false
    ancestors.forEach((path) => {
      if (!prevSet.has(path)) {
        changed = true
      }
    })

    if (!changed) return prev

    const nextSet = new Set(prevSet)
    ancestors.forEach((path) => nextSet.add(path))
    return nextSet
  })

  return ancestors
}

export interface IsSnippetActiveParams {
  snippetId: string
  activeSnippetId?: string | null
  selectedNoteIds?: Set<string>
  selectedFolderIds?: Set<string>
  itemIndex?: number
  selectedIndex?: number
  sidebarFocus?: string | null
  isQueryActive?: boolean
}

/**
 * Reusable function to check if a note snippet is currently active/selected in the file explorer.
 */
export function isSnippetActive({
  snippetId,
  activeSnippetId,
  selectedNoteIds,
  selectedFolderIds,
  itemIndex,
  selectedIndex,
  sidebarFocus,
  isQueryActive = false
}: IsSnippetActiveParams): boolean {
  if (!snippetId) return false

  // 1. Authoritative selection set: if explicit note selection exists, only selected notes are active
  if (selectedNoteIds !== undefined || selectedFolderIds !== undefined) {
    const hasNoteSelection = Boolean(selectedNoteIds && selectedNoteIds.size > 0)
    const hasFolderSelection = Boolean(selectedFolderIds && selectedFolderIds.size > 0)

    if (hasNoteSelection) {
      return Boolean(selectedNoteIds?.has(snippetId))
    }
    if (hasFolderSelection) {
      return false
    }
    if (sidebarFocus === 'root') {
      return false
    }
  }

  // 2. Active search or keyboard index match when actively querying
  if (
    isQueryActive &&
    typeof itemIndex === 'number' &&
    typeof selectedIndex === 'number' &&
    itemIndex === selectedIndex
  ) {
    return true
  }

  // 3. Workspace active tab / note fallback when no explicit selection in explorer
  if (activeSnippetId && snippetId === activeSnippetId && sidebarFocus !== 'root') {
    return true
  }

  return false
}
