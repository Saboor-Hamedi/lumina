/**
 * ============================================================================
 * NoteNumbers Component
 * ============================================================================
 * Clean, interactive counter badge for the File Explorer header.
 * Displays live note count or filtered search tally, and opens the
 * Vault Details inspector card on click.
 * ============================================================================
 */

import React, { useState, useRef } from 'react'
import ToolTip from '../../../components/atoms/ToolTip'
import VaultStats from './VaultStats'

export const NoteNumbers = ({ count = 0, total, isQueryActive }) => {
  const [isStatsOpen, setIsStatsOpen] = useState(false)
  const badgeRef = useRef(null)

  if (count === undefined && total === undefined) return null

  const label = count === 1 ? 'Note' : 'Notes'
  const text =
    isQueryActive && total !== undefined
      ? `${count} of ${total} ${label}`
      : `${count} ${label}`

  return (
    <div className="relative inline-block" style={{ position: 'relative' }}>
      <ToolTip text={isQueryActive ? text : 'View Workspace Details'} position="bottom">
        <button
          ref={badgeRef}
          type="button"
          className={`explorer-note-numbers ${isQueryActive ? 'is-searching' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            if (!isQueryActive) {
              setIsStatsOpen((prev) => !prev)
            }
          }}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '2px 6px',
            borderRadius: '4px',
            cursor: isQueryActive ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '11px',
            color: 'var(--text-muted, #94a3b8)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            if (!isQueryActive) {
              e.currentTarget.style.color = 'var(--text-main, #f8fafc)'
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isQueryActive) {
              e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'
              e.currentTarget.style.background = 'transparent'
            }
          }}
          aria-label={text}
        >
          {text}
        </button>
      </ToolTip>

      <VaultStats
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        anchorRef={badgeRef}
      />
    </div>
  )
}

export default React.memo(NoteNumbers)

