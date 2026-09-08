/**
 * explorerSelectionHelper.js
 * Centralized, reusable utilities for File Explorer item selection,
 * active note state resolution, and folder hierarchy expansion.
 */

/**
 * Computes all ancestor folder paths for a given folder path.
 * E.g., 'Work/Projects/Lumina' -> ['Work', 'Work/Projects', 'Work/Projects/Lumina']
 * Handles Windows backslashes and cleans trailing/leading slashes.
 *
 * @param {string|null|undefined} folderPath
 * @returns {string[]} Ordered list of ancestor folder paths from root to deepest
 */
export function getAncestorFolderPaths(folderPath) {
  if (!folderPath || typeof folderPath !== 'string') return []
  const clean = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim()
  if (!clean) return []

  const parts = clean.split('/').filter(Boolean)
  const paths = []
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
 *
 * @param {Object} snippet - The note snippet
 * @param {Function} setExpandedFolders - State setter for expandedFolders
 * @returns {string[]} The ancestor folder paths
 */
export function revealSnippetFolders(snippet, setExpandedFolders) {
  if (!snippet || !snippet.folderId || !setExpandedFolders) return []
  const ancestors = getAncestorFolderPaths(snippet.folderId)
  if (ancestors.length === 0) return []

  setExpandedFolders((prev) => {
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

/**
 * Reusable function to check if a note snippet is currently active/selected in the file explorer.
 * Handles:
 * - Active tab in workspace
 * - Search result matching and selection
 * - Single/multi-selection in the explorer tree
 * - Keyboard navigation highlight
 *
 * @param {Object} params
 * @param {string} params.snippetId - ID of the snippet to check
 * @param {string|null} [params.activeSnippetId] - ID of the currently open note tab in the workspace
 * @param {Set<string>} [params.selectedNoteIds] - Set of currently selected note IDs in explorer
 * @param {Set<string>} [params.selectedFolderIds] - Set of currently selected folder IDs in explorer
 * @param {number} [params.itemIndex] - Index of this item in the flattened tree
 * @param {number} [params.selectedIndex] - Currently highlighted index in the flattened tree
 * @param {string|null} [params.sidebarFocus] - Focus state: 'note' | 'folder' | 'multi' | 'root' | null
 * @param {boolean} [params.isQueryActive] - Whether a search query is actively filtering
 * @returns {boolean} True if the snippet should be styled as active
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
}) {
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
  // When no multi-note selection is ongoing and no folder is selected
  const hasMultiNotes = selectedNoteIds && selectedNoteIds.size > 1
  const hasFolders = selectedFolderIds && selectedFolderIds.size > 0

  if (!hasMultiNotes && !hasFolders && activeSnippetId && snippetId === activeSnippetId) {
    return true
  }

  return false
}
