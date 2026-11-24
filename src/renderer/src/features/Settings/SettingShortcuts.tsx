import React, { useMemo, useState } from 'react'
import { Search, X, Pencil, Check, RotateCcw, Lock } from 'lucide-react'
import { useShortcutManager, formatDisplayCombo } from './hook/useShortcutManager'
import { useSettingsStore } from '../../core/store/SettingStore'

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent)

function formatKeycapLabel(rawKey: string): string {
  const trimmed = rawKey.trim()
  if (/^(ArrowUp|Up)$/i.test(trimmed)) return '↑'
  if (/^(ArrowDown|Down)$/i.test(trimmed)) return '↓'
  if (/^(ArrowLeft|Left)$/i.test(trimmed)) return '←'
  if (/^(ArrowRight|Right)$/i.test(trimmed)) return '→'
  if (!isMac) return trimmed
  return trimmed
    .replace(/^Ctrl$/i, '⌘')
    .replace(/^Shift$/i, '⇧')
    .replace(/^Alt$/i, '⌥')
    .replace(/^Win$/i, '⌘')
}

/**
 * SettingShortcuts Component
 * Clean, Linear/Raycast-inspired keybindings manager for Settings.
 * Uses unified grouped surfaces (no per-row pop-up cards), category filter pills,
 * crisp side-by-side keycaps, pixel-aligned action slots, and inline recording.
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

  const [activeCategory, setActiveCategory] = useState<string>('All')
  const customShortcuts = useSettingsStore((s) => s.settings.shortcuts) || {}
  const updateSetting = useSettingsStore((s) => s.updateSetting)
  const hasAnyCustom = Object.keys(customShortcuts).length > 0

  const categories = ['All', 'General', 'File', 'Navigation', 'Editor']

  const visibleGroups = useMemo(() => {
    if (activeCategory === 'All') return filteredGroups
    return filteredGroups.filter((g) => g.title === activeCategory)
  }, [filteredGroups, activeCategory])

  const renderKeycaps = (keyString: string) => {
    if (!keyString) return null
    const formattedKeys = keyString.split('+').map(formatKeycapLabel)

    return (
      <span className="shortcut-keycaps-group">
        {formattedKeys.map((k, index) => (
          <kbd key={index} className="shortcut-kbd">
            {k}
          </kbd>
        ))}
      </span>
    )
  }

  return (
    <div className="settings-pane shortcuts-pane">
      {/* Native Pane Header */}
      <div className="settings-pane-header">
        <div className="settings-pane-header-info">
          <h2 className="settings-pane-title">Keyboard Shortcuts</h2>
          <p className="settings-pane-subtitle">
            Click any binding to rebind it. Press Enter to save, Backspace to reset, or Esc to cancel.
          </p>
        </div>
        {hasAnyCustom && (
          <div className="settings-pane-actions">
            <button
              type="button"
              className="shortcuts-reset-all-btn"
              onClick={() => updateSetting('shortcuts', {})}
              title="Restore all shortcuts to their default bindings"
            >
              <RotateCcw size={12} />
              <span>Reset All</span>
            </button>
          </div>
        )}
      </div>

      {/* Search + Category Filter Bar */}
      <div className="shortcuts-toolbar">
        <div className="shortcuts-search-wrap">
          <Search size={13} className="shortcuts-search-icon" />
          <input
            type="text"
            className="shortcuts-search-input"
            placeholder="Find a shortcut by name or key combination..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          {filterQuery && (
            <button
              type="button"
              className="shortcuts-search-clear"
              aria-label="Clear search"
              onClick={() => setFilterQuery('')}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="shortcuts-category-pills" role="tablist" aria-label="Shortcut categories">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat}
              className={`shortcuts-category-pill${activeCategory === cat ? ' is-active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Shortcut Groups */}
      {visibleGroups.length === 0 ? (
        <div className="shortcuts-empty">
          No shortcuts found matching &quot;{filterQuery}&quot;
        </div>
      ) : (
        <div className="shortcuts-groups">
          {visibleGroups.map((group) => (
            <section key={group.title} className="shortcuts-group">
              <div className="shortcuts-group-header">
                <span>{group.title}</span>
                <span className="shortcuts-group-count">{group.items.length}</span>
              </div>

              <div className="shortcuts-group-surface">
                {group.items.map((item: any) => {
                  const isEditingThis = editingShortcutId === item.id

                  return (
                    <div
                      key={item.id}
                      className={`shortcut-list-row${isEditingThis ? ' is-editing' : ''}`}
                    >
                      <div className={`shortcut-row-label${item.isDanger ? ' is-danger' : ''}`}>
                        <span className="shortcut-row-title">{item.label}</span>
                        {item.isCustom && !isEditingThis && (
                          <span className="shortcut-custom-badge">Modified</span>
                        )}
                      </div>

                      {isEditingThis ? (
                        <div className="shortcut-inline-container shortcut-recording">
                          <div className="shortcut-inline-controls">
                            <input
                              ref={inlineInputRef}
                              className={`shortcut-inline-input${isTaken ? ' is-taken' : ''}`}
                              type="text"
                              readOnly
                              value={formatDisplayCombo(recordingDisplay)}
                              placeholder="Press keys..."
                            />
                            <button
                              type="button"
                              className="shortcut-action-btn is-save"
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
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              className="shortcut-action-btn is-cancel"
                              aria-label="Cancel editing"
                              title="Cancel (Esc)"
                              onClick={(e) => {
                                e.stopPropagation()
                                cancelEditing()
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                          {isTaken && (
                            <span className="shortcut-taken-hint">Already assigned</span>
                          )}
                        </div>
                      ) : (
                        <div className="shortcut-row-right">
                          {item.isCustom && !item.readonly && (
                            <button
                              type="button"
                              className="shortcut-action-btn"
                              aria-label={`Reset ${item.label} to default`}
                              title={`Reset to default (${item.defaultKey})`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSaveShortcut(item.id, item.defaultKey)
                              }}
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}

                          <button
                            type="button"
                            className="shortcut-keycaps-btn"
                            disabled={Boolean(item.readonly)}
                            title={item.readonly ? 'System shortcut (managed by OS)' : 'Click to customize'}
                            onClick={(e) => {
                              if (item.readonly) return
                              e.stopPropagation()
                              startEditing(item)
                            }}
                          >
                            {renderKeycaps(item.key)}
                          </button>

                          <span className="shortcut-action-slot">
                            {item.readonly ? (
                              <span
                                className="shortcut-lock-icon"
                                title="System shortcut (managed by OS)"
                                aria-label="System shortcut"
                              >
                                <Lock size={11} />
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="shortcut-action-btn"
                                aria-label={`Customize ${item.label}`}
                                title="Customize shortcut"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startEditing(item)
                                }}
                              >
                                <Pencil size={11} />
                              </button>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default React.memo(SettingShortcuts)
