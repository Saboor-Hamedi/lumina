import React from 'react'
import { Button as UiButton } from '../../ui/Button'
import './Button.css'

/**
 * Atomic Button Component (delegates to shared `src/renderer/src/ui/Button` primitive)
 */
export const Button = ({ children, variant = 'base', className = '', ...props }) => {
  return (
    <UiButton variant={variant} size="md" className={className} {...props}>
      {children}
    </UiButton>
  )
}
