/**
 * =========================================================================
 * Unsaved / Dirty State Manager (unsave.js)
 * =========================================================================
 *
 * Provides hooks and components to track and display unsaved document state.
 *
 * Usage:
 *   import { useUnsaved, UnsavedIndicator } from '../../core/hooks/unsave'
 *   
 *   const { isUnsaved, markUnsaved, clearUnsaved } = useUnsaved(snippet?.id)
 *   
 *   // In JSX:
 *   {isUnsaved && <UnsavedIndicator />}
 *
 * Applied in:
 * - SidebarItem.jsx (FileExplorer note items)
 * - TabBar.jsx (Editor tab chips)
 * - DrivePushButton.jsx (Drive push button)
 * =========================================================================
 */

import React, { useCallback } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'
import '../../assets/unsave.css'

/**
 * Custom React hook to check and modify the unsaved (dirty) status of a snippet.
 *
 * @param {string} snippetId - The ID of the note/snippet to observe.
 * @returns {{
 *   isUnsaved: boolean,
 *   dirtySnippetIds: string[],
 *   markUnsaved: (dirty?: boolean) => void,
 *   clearUnsaved: () => void
 * }}
 */
export const useUnsaved = (snippetId) => {
  const dirtySnippetIds = useWorkspaceStore((s) => s.dirtySnippetIds)
  const setDirty = useWorkspaceStore((s) => s.setDirty)

  const isUnsaved = Boolean(snippetId && dirtySnippetIds.includes(snippetId))

  const markUnsaved = useCallback(
    (dirty = true) => {
      if (snippetId) {
        setDirty(snippetId, dirty)
      }
    },
    [snippetId, setDirty]
  )

  const clearUnsaved = useCallback(() => {
    if (snippetId) {
      setDirty(snippetId, false)
    }
  }, [snippetId, setDirty])

  return {
    isUnsaved,
    dirtySnippetIds,
    markUnsaved,
    clearUnsaved
  }
}

/**
 * Reusable visual indicator dot (blob) representing unsaved changes.
 * Styled via unsave.css (.dirty-indicator).
 */
export const UnsavedIndicator = React.memo(({ style, className = '', title = 'Unsaved changes' }) => {
  return React.createElement('div', {
    className: `dirty-indicator ${className}`.trim(),
    style,
    title
  })
})

UnsavedIndicator.displayName = 'UnsavedIndicator'

// Backward-compatible alias for useDirty
export const useDirty = useUnsaved
export const DirtyIndicator = UnsavedIndicator

export default useUnsaved
