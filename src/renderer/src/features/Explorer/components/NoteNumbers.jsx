/**
 * ============================================================================
 * NoteNumbers Component
 * ============================================================================
 * Clean, dedicated counter badge for the File Explorer header.
 * Displays live note count or filtered search tally with theme-aware styling.
 * ============================================================================
 */

import React from 'react'

export const NoteNumbers = ({ count = 0, total, isQueryActive }) => {
  if (count === undefined && total === undefined) return null

  const label = count === 1 ? 'Note' : 'Notes'
  const text =
    isQueryActive && total !== undefined
      ? `${count} of ${total} ${label}`
      : `${count} ${label}`

  return (
    <span
      className={`explorer-note-numbers ${isQueryActive ? 'is-searching' : ''}`}
      role="status"
      aria-label={text}
    >
      {text}
    </span>
  )
}

export default React.memo(NoteNumbers)

