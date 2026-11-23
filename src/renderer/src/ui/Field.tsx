import React, { forwardRef } from 'react'
import { Search, X } from 'lucide-react'

export interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  leading?: React.ReactNode
  trailing?: React.ReactNode
  containerClassName?: string
  inputClassName?: string
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  (
    {
      label,
      hint,
      error,
      leading,
      trailing,
      containerClassName = '',
      inputClassName = '',
      id,
      ...rest
    },
    ref
  ) => {
    return (
      <div className={`lumina-field-wrap ${containerClassName}`.trim()}>
        {label && (
          <label className="lumina-field-label" htmlFor={id}>
            {label}
          </label>
        )}
        <div className={`lumina-field-box ${error ? 'has-error' : ''}`.trim()}>
          {leading}
          <input
            ref={ref}
            id={id}
            className={`lumina-field-input ${inputClassName}`.trim()}
            {...rest}
          />
          {trailing}
        </div>
        {error ? (
          <span className="lumina-field-error">{error}</span>
        ) : hint ? (
          <span className="lumina-field-hint">{hint}</span>
        ) : null}
      </div>
    )
  }
)

Field.displayName = 'Field'

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  containerClassName?: string
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      placeholder = 'Search...',
      containerClassName = 'lumina-drawer-search-wrap',
      className = '',
      spellCheck = false,
      ...rest
    },
    ref
  ) => {
    const handleClear = () => {
      if (onClear) {
        onClear()
      } else {
        onChange('')
      }
    }

    return (
      <div className={containerClassName}>
        <Search size={13} className="search-icon" aria-hidden="true" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={spellCheck}
          className={className}
          {...rest}
        />
        {value ? (
          <button
            type="button"
            className="clear-btn"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        ) : null}
      </div>
    )
  }
)

SearchInput.displayName = 'SearchInput'
