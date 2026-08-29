/**
 * ============================================================================
 * SettingShortcuts Component
 * ============================================================================
 * Dedicated Keyboard Shortcuts panel for Settings.
 * Displays all keybindings organized by category with live search/filtering.
 * ============================================================================
 */

import React, { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { SHORTCUT_DISPLAY_GROUPS } from '../../core/hooks/useKeyboardShortcuts'

const SettingShortcuts = () => {
  const [filterQuery, setFilterQuery] = useState('')
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac')

  // Render individual keycap badge (e.g. "Ctrl" + "Shift" + "F")
  const renderKeycaps = (keyString) => {
    const rawKeys = keyString.split('+').map((k) => k.trim())
    const formattedKeys = rawKeys.map((k) => {
      if (!isMac) return k
      return k.replace(/^Ctrl$/i, '⌘').replace(/^Shift$/i, '⇧').replace(/^Alt$/i, '⌥')
    })

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {formattedKeys.map((k, index) => (
          <React.Fragment key={index}>
            <kbd
              style={{
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'inherit',
                color: 'var(--text-main, #f1f5f9)',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px',
                lineHeight: 1.2,
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                userSelect: 'none'
              }}
            >
              {k}
            </kbd>
            {index < formattedKeys.length - 1 && (
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--text-faint, #64748b)',
                  fontWeight: 500
                }}
              >
                +
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }

  // Filter shortcuts based on user search query
  const filteredGroups = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    if (!q) return SHORTCUT_DISPLAY_GROUPS

    return SHORTCUT_DISPLAY_GROUPS.map((group) => {
      const matchingItems = group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.key.toLowerCase().includes(q)
      )
      return {
        ...group,
        items: matchingItems
      }
    }).filter((group) => group.items.length > 0)
  }, [filterQuery])

  return (
    <div className="settings-pane">
      {/* Search Header */}
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%'
          }}
        >
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: '11px',
              color: 'var(--text-faint, #64748b)',
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            placeholder="Find a shortcut by name or key combination..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              width: '100%',
              height: '34px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '7px',
              padding: filterQuery ? '0 32px 0 32px' : '0 12px 0 32px',
              color: 'var(--text-main, #f8fafc)',
              fontSize: '12px',
              outline: 'none',
              transition: 'all 0.15s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(var(--text-accent-rgb, 139, 92, 246), 0.5)'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(var(--text-accent-rgb, 139, 92, 246), 0.12)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '4px'
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div
          style={{
            padding: '36px 16px',
            textAlign: 'center',
            color: 'var(--text-faint, #64748b)',
            fontSize: '12px'
          }}
        >
          No shortcuts found matching "{filterQuery}"
        </div>
      ) : (
        <div className="settings-block" style={{ padding: '0', background: 'transparent' }}>
          {filteredGroups.map((group, i) => (
            <div
              key={i}
              style={{ marginBottom: i < filteredGroups.length - 1 ? '28px' : '0' }}
            >
              <h4
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted, #94a3b8)',
                  marginBottom: '10px',
                  paddingBottom: '6px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  position: 'sticky',
                  top: '-40px',
                  background: 'var(--bg-app, #14141e)',
                  zIndex: 2
                }}
              >
                {group.title}
              </h4>
              {group.items.map((item, j) => (
                <div
                  className="settings-row shortcut-list-row"
                  key={j}
                  style={{
                    padding: '8px 8px',
                    margin: '2px 0',
                    borderBottom: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: '6px',
                    transition: 'all 0.12s ease',
                    cursor: 'default'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <div
                    className="row-info"
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 450,
                      color: item.isDanger ? '#ef4444' : 'var(--text-main, #f1f5f9)'
                    }}
                  >
                    {item.label}
                  </div>
                  {renderKeycaps(item.key)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default React.memo(SettingShortcuts)
