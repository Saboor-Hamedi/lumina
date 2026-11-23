import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useDraggableSurface } from './useDraggableSurface'

export interface DialogProps {
  isOpen: boolean
  onClose: () => void
  role?: 'dialog' | 'alertdialog'
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  overlayClassName?: string
  className?: string
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  onEnter?: () => void
  draggable?: boolean
  children: React.ReactNode
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  role = 'dialog',
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  overlayClassName = '',
  className = '',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  onEnter,
  draggable = false,
  children
}) => {
  const { surfaceRef, handleDragStart, resetPosition } = useDraggableSurface<HTMLDivElement>()

  useEffect(() => {
    if (isOpen && draggable) {
      resetPosition()
    }
  }, [isOpen, draggable, resetPosition])

  useEffect(() => {
    if (!isOpen || (!closeOnEscape && !onEnter)) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      } else if (onEnter && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onEnter()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isOpen, closeOnEscape, onClose, onEnter])

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div
      role={role}
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      className={`modal-overlay lumina-dialog-overlay ${overlayClassName}`.trim()}
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        ref={draggable ? surfaceRef : undefined}
        className={`modal-container lumina-dialog ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={draggable ? (e) => {
          if ((e.target as HTMLElement)?.closest('[data-dialog-drag-handle]')) {
            handleDragStart(e)
          }
        } : undefined}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

export default Dialog
