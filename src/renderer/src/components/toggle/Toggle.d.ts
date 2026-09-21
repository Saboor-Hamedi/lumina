import React from 'react'

export interface ToggleProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked?: boolean
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  id?: string
  name?: string
  ariaLabel?: string
  title?: string
  style?: React.CSSProperties
}

export declare const Toggle: React.NamedExoticComponent<ToggleProps>
export default Toggle
