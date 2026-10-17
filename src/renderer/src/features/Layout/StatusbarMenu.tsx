/**
 * =========================================================================
 * StatusbarMenu Component (`StatusbarMenu.tsx`)
 * =========================================================================
 *
 * The right-click toggle menu for the bottom `StatusBar`.
 *
 * Kept colocated with `StatusBar` (its only consumer) so the menu logic lives
 * next to the bar it controls instead of being tangled into the component.
 *
 * Behaves like the VS Code status bar menu:
 * - Groups items into labelled sections (Editor / Settings / Document).
 * - Renders a checkmark for visible items and stays open while toggling so the
 *   user can flip several items in one go (`keepOpen`).
 * - Delegates rendering to the shared `ContextMenu` (which owns positioning,
 *   edge-flipping and scroll containment).
 * =========================================================================
 */

import React, { useMemo } from 'react'
import ContextMenu from '../modals/ContextMenu'
import type { StatusBarItemMeta } from './StatusBar'

export interface StatusbarMenuProps {
  /** Viewport X coordinate where the menu should open. */
  x: number
  /** Viewport Y coordinate where the menu should open. */
  y: number
  /** Registry of every toggleable status-bar item (source of labels/icons/order). */
  items: StatusBarItemMeta[]
  /** Resolves whether an item is currently visible. */
  isVisible: (id: string) => boolean
  /** Optional keyboard shortcut hint for an item. */
  shortcutFor: (id: string) => string | undefined
  /** Toggles an item's visibility (menu stays open). */
  onToggle: (id: string) => void
  /** Closes the menu. */
  onClose: () => void
}

export const StatusbarMenu: React.FC<StatusbarMenuProps> = ({
  x,
  y,
  items,
  isVisible,
  shortcutFor,
  onToggle,
  onClose
}) => {
  const options = useMemo(() => {
    const opts: any[] = [
      {
        id: '__statusbar-header',
        type: 'custom',
        render: () => (
          <div className="status-bar-menu-header">
            <span className="status-bar-menu-title">Status Bar</span>
            <span className="status-bar-menu-hint">Toggle items</span>
          </div>
        )
      }
    ]

    // Preserve registry order while grouping items by their menu section.
    const groups: { name: string; items: StatusBarItemMeta[] }[] = []
    for (const item of items) {
      let group = groups.find((g) => g.name === item.menuGroup)
      if (!group) {
        group = { name: item.menuGroup, items: [] }
        groups.push(group)
      }
      group.items.push(item)
    }

    groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        opts.push({ id: `__div-${group.name}`, type: 'divider' })
      }
      opts.push({ id: `__sec-${group.name}`, type: 'section', label: group.name })
      for (const item of group.items) {
        opts.push({
          id: item.id,
          label: item.label,
          icon: item.icon,
          shortcut: shortcutFor(item.id),
          isActive: () => isVisible(item.id),
          keepOpen: true,
          onClick: () => onToggle(item.id)
        })
      }
    })

    return opts
  }, [items, isVisible, shortcutFor, onToggle])

  return <ContextMenu x={x} y={y} options={options} onClose={onClose} />
}

export default React.memo(StatusbarMenu)
