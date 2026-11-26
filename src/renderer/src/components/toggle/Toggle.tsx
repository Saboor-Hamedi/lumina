import React from 'react'
import './toggle.css'

export interface ToggleProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Whether the switch is currently on. */
  checked?: boolean
  /** Standard change handler receiving `(e)` where `e.target.checked` is boolean. */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Optional convenience handler receiving directly `(checked: boolean)`. */
  onCheckedChange?: (checked: boolean) => void
  /** Whether interaction is disabled. */
  disabled?: boolean
  /** Optional additional class names. */
  className?: string
  /** Optional HTML id for input. */
  id?: string
  /** Optional HTML name for input. */
  name?: string
  /** Accessibility label. */
  ariaLabel?: string
  /** Tooltip / title text. */
  title?: string
  /** Optional inline styles applied to the wrapper label. */
  style?: React.CSSProperties
}

/**
 * Toggle Component
 *
 * Tactile, iOS/macOS-style unified toggle switch with smooth spring physics,
 * ambient glow, and high-contrast tactile knob.
 */
export const Toggle = React.memo<ToggleProps>(
  ({
    checked = false,
    onChange,
    onCheckedChange,
    disabled = false,
    className = '',
    id,
    name,
    ariaLabel,
    title,
    style,
    ...rest
  }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return
      onCheckedChange?.(e.target.checked)
      onChange?.(e)
    }

    return (
      <label
        className={`lumina-switch ${className} ${disabled ? 'disabled' : ''}`.trim()}
        onClick={(e) => e.stopPropagation()}
        style={style}
        title={title}
      >
        <input
          type="checkbox"
          checked={!!checked}
          onChange={handleChange}
          disabled={disabled}
          id={id}
          name={name}
          aria-label={ariaLabel || title}
          {...rest}
        />
        <span className="lumina-slider" />
      </label>
    )
  }
)

Toggle.displayName = 'Toggle'
export default Toggle
