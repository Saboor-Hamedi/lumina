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

  // 1. Explicit multi-selection or single-selection in explorer
  if (selectedNoteIds && selectedNoteIds.has(snippetId)) {
    return true
  }

  // 2. Active search or keyboard index match
  if (
    typeof itemIndex === 'number' &&
    typeof selectedIndex === 'number' &&
    itemIndex === selectedIndex &&
    (isQueryActive || sidebarFocus === 'note' || sidebarFocus === 'multi')
  ) {
    return true
  }

  // 3. Workspace active tab / note fallback
  const hasMultiNotes = selectedNoteIds && selectedNoteIds.size > 1
  const hasFolders = selectedFolderIds && selectedFolderIds.size > 0

  if (!hasMultiNotes && !hasFolders && activeSnippetId && snippetId === activeSnippetId) {
    return true
  }

  return false
}
