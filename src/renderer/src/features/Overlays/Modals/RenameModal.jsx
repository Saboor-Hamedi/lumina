import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './RenameModal.css'

const RenameModal = ({
  isOpen,
  onClose,
  onRename,
  initialName = ''
}) => {
  const [newName, setNewName] = useState(initialName)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setNewName(initialName)
      setTimeout(() => {
        if (inputRef.current) {
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
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter new name..."
          />
        </form>
      </div>
    </div>,
    document.body
  )
}

export default RenameModal
