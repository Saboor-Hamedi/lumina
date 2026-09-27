import React from 'react'
import { Search, X, Plus, Check } from 'lucide-react'
import { useShortcutManager, formatDisplayCombo } from './hook/useShortcutManager'

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent)

/**
 * SettingShortcuts Component
 * Dedicated Keyboard Shortcuts panel for Settings.
 * Displays all keybindings organized by category with live search/filtering.
 * Allows customizing shortcuts dynamically via inline recording with zero-blur.
 */
export const SettingShortcuts: React.FC = () => {
  const {
    filterQuery,
    setFilterQuery,
    editingShortcutId,
    recordingDisplay,
    committedKey,
    isTaken,
    inlineInputRef,
    filteredGroups,
    startEditing,
    cancelEditing,
    handleSaveShortcut
  } = useShortcutManager()

  // Render individual keycap badge (e.g. "Ctrl" + "Shift" + "F")
  const renderKeycaps = (keyString: string) => {
    if (!keyString) return null
    const rawKeys = keyString.split('+').map((k) => k.trim())
    const formattedKeys = rawKeys.map((k) => {
      if (!isMac) return k
      return k
        .replace(/^Ctrl$/i, '⌘')
        .replace(/^Shift$/i, '⇧')
        .replace(/^Alt$/i, '⌥')
        .replace(/^Win$/i, '⌘')
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
              e.currentTarget.style.boxShadow =
                '0 0 0 2px rgba(var(--text-accent-rgb, 139, 92, 246), 0.12)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
          {filterQuery && (
            <button
              type="button"
              aria-label="Clear search"
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
          No shortcuts found matching &quot;{filterQuery}&quot;
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
              {group.items.map((item, j) => {
                const isEditingThis = editingShortcutId === item.id

                return (
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
                        color: item.isDanger ? '#ef4444' : 'var(--text-main, #f1f5f9)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span>{item.label}</span>
                      {item.isCustom && !isEditingThis && (
                        <span
                          style={{
                            fontSize: '9px',
                            color: 'var(--text-accent)',
                            background: 'rgba(var(--text-accent-rgb, 139, 92, 246), 0.1)',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            fontWeight: 500
                          }}
                        >
                          custom
                        </span>
                      )}
                    </div>

                    {isEditingThis ? (
                      /* Inline recording box with zero-blur and side-by-side cancel button */
                      <div
                        className="shortcut-inline-container shortcut-recording"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: '2px'
                        }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            ref={inlineInputRef}
                            className="shortcut-inline-input"
                            type="text"
                            readOnly
                            value={formatDisplayCombo(recordingDisplay)}
                            placeholder=""
                            style={{
                              height: '24px',
                              width: '120px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              border: isTaken
                                ? '1px solid var(--text-accent, #40bafa)'
                                : '1px solid rgba(var(--text-accent-rgb, 139, 92, 246), 0.6)',
                              borderRadius: '4px',
                              color: 'var(--text-main, #f1f5f9)',
                              fontSize: '11px',
                              fontWeight: 600,
                              textAlign: 'center',
                              outline: 'none',
                              fontFamily: 'inherit',
                              letterSpacing: '0.02em',
                              boxShadow: isTaken
                                ? '0 0 0 2px rgba(var(--text-accent-rgb, 139, 92, 246), 0.25)'
                                : '0 0 0 2px rgba(var(--text-accent-rgb, 139, 92, 246), 0.12)',
                              userSelect: 'none',
                              cursor: 'pointer'
                            }}
                          />
                          {/* Save checkmark button */}
                          <button
                            type="button"
                            aria-label="Save shortcut"
                            title="Save shortcut (Enter)"
                            disabled={isTaken || !committedKey}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!isTaken && committedKey) {
                                handleSaveShortcut(item.id, committedKey)
                                cancelEditing()
                              }
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '22px',
                              height: '22px',
                              borderRadius: '4px',
                              background:
                                isTaken || !committedKey
                                  ? 'rgba(255, 255, 255, 0.03)'
                                  : 'rgba(var(--text-accent-rgb, 139, 92, 246), 0.18)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color:
                                isTaken || !committedKey
                                  ? 'var(--text-faint, #64748b)'
                                  : 'var(--text-accent, #40bafa)',
                              cursor: isTaken || !committedKey ? 'default' : 'pointer',
                              padding: 0,
                              transition: 'all 0.12s ease'
                            }}
                          >
                            <Check size={11} />
                          </button>
                          {/* Cancel button */}
                          <button
                            type="button"
                            aria-label="Cancel editing"
                            title="Cancel (Esc)"
                            onClick={(e) => {
                              e.stopPropagation()
                              cancelEditing()
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '22px',
                              height: '22px',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: 'var(--text-muted, #94a3b8)',
                              cursor: 'pointer',
                              padding: 0,
                              transition: 'all 0.12s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#ef4444'
                              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                            }}
                          >
                            <X size={11} />
                          </button>
                        </div>
                        {isTaken && (
                          <span
                            style={{
                              fontSize: '10px',
                              color: 'var(--text-accent, #40bafa)',
                              fontWeight: 600,
                              letterSpacing: '0.02em',
                              textTransform: 'lowercase',
                              alignSelf: 'center',
                              marginTop: '2px',
                              animation: 'modal-fade-in 0.12s ease-out'
                            }}
                          >
                            shortcut is already taken
                          </span>
                        )}
                      </div>
                    ) : (
                      /* Normal Keycap View with Plus Button */
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        {renderKeycaps(item.key)}
                        {!item.readonly && (
                          <button
                            type="button"
                            aria-label={`Customize ${item.label}`}
                            title="Customize shortcut"
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditing(item)
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: 'var(--text-muted, #94a3b8)',
                              cursor: 'pointer',
                              padding: 0,
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background =
                                'rgba(var(--text-accent-rgb, 139, 92, 246), 0.15)'
                              e.currentTarget.style.borderColor = 'var(--text-accent)'
                              e.currentTarget.style.color = 'var(--text-main, #fff)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                              e.currentTarget.style.color = 'var(--text-muted, #94a3b8)'
                            }}
                          >
                            <Plus size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default React.memo(SettingShortcuts)
