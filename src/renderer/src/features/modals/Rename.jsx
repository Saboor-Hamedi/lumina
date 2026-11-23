import React, { useEffect, useRef, memo } from 'react'
import { Dialog } from '../../ui'
import './css/renameModal.css'

/**
 * Rename Modal Component
 *
 * Renders an inline modal dialog for quickly renaming notes or folders.
 * Features auto-focus, text selection upon opening, Esc to dismiss,
 * and Enter to submit the renamed title.
 *
 * Wrapped in React.memo to prevent unnecessary re-renders when parent state updates.
 */
const Rename = ({ isOpen, onClose, onRename, initialName = '', itemType = 'note' }) => {
  const inputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.value = initialName
        inputRef.current.focus()
        inputRef.current.select()
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [isOpen, initialName])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!inputRef.current) return
    const newName = inputRef.current.value
    if (newName.trim() && newName.trim() !== initialName) {
      onRename(newName.trim())
    }
    onClose()
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={itemType === 'folder' ? 'Rename folder' : 'Rename note'}
      overlayClassName="rename-overlay"
      className="rename-modal"
    >
      <form onSubmit={handleSubmit} className="rename-form">
        <input
          ref={inputRef}
          className="rename-input"
          type="text"
          defaultValue={initialName}
          placeholder={itemType === 'folder' ? 'Rename folder...' : 'Rename note...'}
        />
      </form>
    </Dialog>
  )
}

export default React.memo(Rename)
