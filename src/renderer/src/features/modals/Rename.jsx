import React, { useEffect, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import './css/renameModal.css'

/**
 * Rename Modal Component
 *
 * Renders an inline modal dialog for quickly renaming notes or folders.
 * Features auto-focus, text selection upon opening, Esc to dismiss,
 * and Enter to submit the renamed title.
 *
 * Wrapped in React.memo to prevent unnecessary re-renders when parent state updates.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the rename modal is currently visible.
 * @param {() => void} props.onClose - Callback triggered when modal is closed/dismissed.
 * @param {(newName: string) => void} props.onRename - Callback triggered with the validated new name.
 * @param {string} [props.initialName=''] - Initial name of the item being renamed.
 * @param {'note' | 'folder'} [props.itemType='note'] - Type of item being renamed ('note' or 'folder').
 * @returns {React.ReactPortal | null}
 */
const Rename = ({ isOpen, onClose, onRename, initialName = '', itemType = 'note' }) => {
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.value = initialName
          inputRef.current.focus()
          inputRef.current.select()
        }
      }, 50)
    }
  }, [isOpen, initialName])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!inputRef.current) return
    const newName = inputRef.current.value
    if (newName.trim() && newName.trim() !== initialName) {
      onRename(newName.trim())
    }
    onClose()
  }

  return createPortal(
    <div className="modal-overlay rename-overlay" onClick={onClose}>
      <div className="modal-container rename-modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="rename-form">
          <input
            ref={inputRef}
            className="rename-input"
            type="text"
            defaultValue={initialName}
            placeholder={itemType === 'folder' ? 'Rename folder...' : 'Rename note...'}
          />
        </form>
      </div>
    </div>,
    document.body
  )
}

export default React.memo(Rename)
