import React from 'react'
import './toggle.css'

/**
 * Toggle Component
 *
 * Tactile, iOS/macOS-style unified toggle switch with smooth spring physics,
 * ambient glow, and high-contrast tactile knob.
 *
 * @param {boolean} checked - Whether the switch is currently on.
 * @param {function} onChange - Standard change handler receiving `(e)` where `e.target.checked` is boolean.
 * @param {function} [onCheckedChange] - Optional convenience handler receiving directly `(checked: boolean)`.
 * @param {boolean} [disabled=false] - Whether interaction is disabled.
 * @param {string} [className=''] - Optional additional class names.
 * @param {string} [id] - Optional HTML id for input.
 * @param {string} [name] - Optional HTML name for input.
 * @param {string} [ariaLabel] - Accessibility label.
 */
export const Toggle = React.memo(
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
    const handleChange = (e) => {
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
