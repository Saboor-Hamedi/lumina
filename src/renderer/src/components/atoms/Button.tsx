import React from 'react'
import { Button as UiButton, type ButtonProps } from '../../ui/Button'
import './Button.css'

export type { ButtonProps }

/**
 * Atomic Button Component (delegates to shared `src/renderer/src/ui/Button` primitive)
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'base',
  className = '',
  ...props
}) => {
  return (
    <UiButton variant={variant} size="md" className={className} {...props}>
      {children}
    </UiButton>
  )
}
