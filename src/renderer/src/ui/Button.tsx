import React, { forwardRef } from 'react'
import ToolTip, { type ToolTipPosition } from '../components/atoms/ToolTip'

export type ButtonVariant = 'default' | 'base' | 'primary' | 'ghost' | 'danger'
export type ButtonSize = 'xs' | 'sm' | 'md'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'default',
      size = 'sm',
      loading = false,
      icon,
      children,
      className = '',
      type = 'button',
      disabled,
      ...rest
    },
    ref
  ) => {
    const variantClass =
      variant === 'primary'
        ? 'btn-primary variant-primary'
        : variant === 'danger'
          ? 'btn-danger variant-danger'
          : variant === 'ghost'
            ? 'variant-ghost'
            : ''
    const sizeClass = size === 'xs' ? 'size-xs' : size === 'sm' ? 'size-sm' : ''

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`btn lumina-btn ${variantClass} ${sizeClass} ${className}`.trim()}
        {...rest}
      >
        {loading ? (
          <span
            aria-hidden="true"
            style={{
              width: 11,
              height: 11,
              borderRadius: '50%',
              border: '1.5px solid currentColor',
              borderTopColor: 'transparent',
              display: 'inline-block',
              animation: 'lumina-fade-in 0.2s linear infinite'
            }}
          />
        ) : (
          icon
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize
  active?: boolean
  danger?: boolean
  tooltip?: string
  tooltipPosition?: ToolTipPosition
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      size = 'sm',
      active = false,
      danger = false,
      tooltip,
      tooltipPosition = 'top',
      children,
      className = '',
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const sizeClass = size === 'xs' ? 'size-xs' : size === 'md' ? 'size-md' : 'size-sm'
    const btn = (
      <button
        ref={ref}
        type={type}
        className={`lumina-icon-btn ${sizeClass} ${active ? 'is-active' : ''} ${danger ? 'is-danger' : ''} ${className}`.trim()}
        {...rest}
      >
        {children}
      </button>
    )

    if (tooltip) {
      return (
        <ToolTip text={tooltip} position={tooltipPosition}>
          {btn}
        </ToolTip>
      )
    }

    return btn
  }
)

IconButton.displayName = 'IconButton'
