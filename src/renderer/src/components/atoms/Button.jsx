import React from 'react'
import './Button.css'

/**
 * Atomic Button Component (Std #9)
 * Standardizes primary and ghost button behaviors.
 */
export const Button = ({ children, variant = 'base', className = '', ...props }) => {
  const baseClass = variant === 'primary' ? 'btn btn-primary' : 'btn'
  return (
    <button className={`${baseClass} ${className}`} {...props}>
      {children}
    </button>
  )
}
