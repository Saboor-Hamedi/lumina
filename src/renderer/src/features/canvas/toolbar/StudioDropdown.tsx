/**
 * ============================================================================
 * Lumina Canvas Studio Dropdown (StudioDropdown.tsx)
 * ============================================================================
 * Premium bespoke dropdown component for Studio controls:
 * - High-aesthetic glassmorphic design matching Lumina design system
 * - Custom icons, color dots, descriptions, and badges
 * - Click-outside dismissal and Escape key support
 * - Accessible keyboard navigation
 * - Does NOT use native HTML <select><option>
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface StudioDropdownOption<T extends string = string> {
  id: T
  label: string
  icon?: React.ReactNode
  description?: string
  badge?: string
  colorHex?: string
  disabled?: boolean
}

export interface StudioDropdownProps<T extends string = string> {
  label?: string
  description?: string
  value?: T | ''
  options: StudioDropdownOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function StudioDropdown<T extends string = string>({
  label,
  description,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Select option...',
  className = ''
}: StudioDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Find currently selected option
  const selectedOption = options.find((opt) => opt.id === value)

  // Dismiss dropdown on outside pointer click
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div
      ref={containerRef}
      className={`studio-dropdown-container ${className} ${disabled ? 'disabled' : ''}`}
    >
      {label && (
        <div className="studio-dropdown-header">
          <span className="studio-dropdown-label">{label}</span>
          {description && <span className="studio-dropdown-desc">{description}</span>}
        </div>
      )}

      <button
        type="button"
        className={`studio-dropdown-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="studio-dropdown-trigger-left">
          {selectedOption?.icon && (
            <span className="studio-dropdown-trigger-icon">{selectedOption.icon}</span>
          )}
          {selectedOption?.colorHex && (
            <span
              className="studio-dropdown-trigger-dot"
              style={{ backgroundColor: selectedOption.colorHex }}
            />
          )}
          <span className="studio-dropdown-trigger-text">
            {selectedOption?.label || placeholder}
          </span>
        </div>

        <ChevronDown
          size={13}
          className={`studio-dropdown-caret ${isOpen ? 'rotate' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="studio-dropdown-menu" role="listbox">
          {options.map((opt) => {
            const isSelected = opt.id === value

            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                className={`studio-dropdown-item ${isSelected ? 'active' : ''} ${
                  opt.disabled ? 'disabled' : ''
                }`}
                onClick={() => {
                  if (opt.disabled) return
                  onChange(opt.id)
                  setIsOpen(false)
                }}
              >
                <div className="studio-dropdown-item-left">
                  {opt.icon && (
                    <span className="studio-dropdown-item-icon">{opt.icon}</span>
                  )}
                  {opt.colorHex && (
                    <span
                      className="studio-dropdown-item-dot"
                      style={{ backgroundColor: opt.colorHex }}
                    />
                  )}
                  <div className="studio-dropdown-item-text-group">
                    <span className="studio-dropdown-item-title">{opt.label}</span>
                    {opt.description && (
                      <span className="studio-dropdown-item-sub">
                        {opt.description}
                      </span>
                    )}
                  </div>
                </div>

                <div className="studio-dropdown-item-right">
                  {opt.badge && (
                    <span className="studio-dropdown-item-badge">{opt.badge}</span>
                  )}
                  {isSelected && (
                    <Check size={13} className="studio-dropdown-item-check" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default StudioDropdown
