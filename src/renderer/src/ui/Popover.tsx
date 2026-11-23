import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type PopoverPlacement =
  | 'bottom-start'
  | 'bottom-end'
  | 'top-start'
  | 'right-start'
  | 'right-end'

export interface PopoverProps {
  isOpen: boolean
  onClose: () => void
  anchorRef?: React.RefObject<HTMLElement | null>
  position?: { top?: number; bottom?: number; left?: number; right?: number }
  placement?: PopoverPlacement
  offset?: number
  className?: string
  style?: React.CSSProperties
  role?: string
  ariaLabel?: string
  children: React.ReactNode
}

export const Popover: React.FC<PopoverProps> = ({
  isOpen,
  onClose,
  anchorRef,
  position,
  placement = 'bottom-start',
  offset = 6,
  className = '',
  style,
  role = 'dialog',
  ariaLabel,
  children
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [coords, setCoords] = useState<{ top?: number; left?: number; bottom?: number; right?: number }>(
    () => position ?? {}
  )

  useEffect(() => {
    if (!isOpen) return

    const handleOutsideMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (popoverRef.current?.contains(target)) return
      if (anchorRef?.current?.contains(target)) return
      onClose()
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('mousedown', handleOutsideMouseDown)
    window.addEventListener('keydown', handleEscape, { capture: true })
    return () => {
      window.removeEventListener('mousedown', handleOutsideMouseDown)
      window.removeEventListener('keydown', handleEscape, { capture: true })
    }
  }, [isOpen, onClose, anchorRef])

  useLayoutEffect(() => {
    if (!isOpen) return
    if (position) {
      setCoords(position)
      return
    }
    const anchor = anchorRef?.current
    const el = popoverRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const elWidth = el?.offsetWidth || 185
    const elHeight = el?.offsetHeight || 160
    const margin = 8

    let top = rect.bottom + offset
    let left = rect.left

    if (placement === 'bottom-end') {
      top = rect.bottom + offset
      left = rect.right - elWidth
    } else if (placement === 'top-start') {
      top = rect.top - elHeight - offset
      left = rect.left
    } else if (placement === 'right-start') {
      top = rect.top
      left = rect.right + offset
    } else if (placement === 'right-end') {
      top = rect.bottom - elHeight
      left = rect.right + offset
    }

    left = Math.max(margin, Math.min(window.innerWidth - elWidth - margin, left))
    top = Math.max(margin, Math.min(window.innerHeight - elHeight - margin, top))

    setCoords({ top: Math.round(top), left: Math.round(left) })
  }, [isOpen, anchorRef, position, placement, offset])

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={popoverRef}
      role={role}
      aria-label={ariaLabel}
      className={`lumina-popover ${className}`.trim()}
      style={{
        ...coords,
        ...style
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  )
}

export interface MenuItemConfig {
  id?: string
  type?: 'item' | 'divider' | 'section'
  label?: string
  icon?: React.ReactNode
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  active?: boolean
  keepOpen?: boolean
  onClick?: () => void
}

export interface MenuProps {
  items: MenuItemConfig[]
  onClose?: () => void
  className?: string
  itemClassName?: string
}

export const Menu: React.FC<MenuProps> = ({
  items,
  onClose,
  className = '',
  itemClassName = ''
}) => {
  return (
    <div className={`lumina-menu ${className}`.trim()} role="menu">
      {items.map((item, idx) => {
        if (item.type === 'divider') {
          return <div key={item.id ?? `div-${idx}`} className="lumina-menu-divider" role="separator" />
        }
        if (item.type === 'section') {
          return (
            <div key={item.id ?? `sec-${idx}`} className="lumina-menu-section" role="presentation">
              {item.label}
            </div>
          )
        }
        return (
          <button
            key={item.id ?? `item-${idx}`}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`lumina-menu-item ${item.danger ? 'is-danger' : ''} ${item.active ? 'is-active' : ''} ${itemClassName}`.trim()}
            onClick={() => {
              if (item.disabled) return
              item.onClick?.()
              if (!item.keepOpen) onClose?.()
            }}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.shortcut && <span className="lumina-menu-shortcut">{item.shortcut}</span>}
          </button>
        )
      })}
    </div>
  )
}
