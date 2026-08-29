/**
 * ============================================================================
 * IconPicker Component
 * ============================================================================
 * Ultra-lightweight, compact, and responsive icon picker.
 * Direct GPU-accelerated dragging with 0ms latency and 0 React re-renders.
 * Full arrow key grid navigation (Up, Down, Left, Right, Enter).
 * Instant search, real-time live preview (does not close on click), and escape dismiss.
 * ============================================================================
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Sparkles } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import ModalHeader from '../Overlays/ModalHeader'
import { EMOJI_INDEX } from './icons'
import './IconPicker.css'

const IconItem = React.memo(({ item, index, isActive, isFocused, onSelect }) => {
  const IconComponent = item.isLucide ? LucideIcons[item.char] : null

  const handleClick = useCallback((e) => {
    e.stopPropagation()
    onSelect(item.char, index)
  }, [item.char, index, onSelect])

  return (
    <button
      id={`icon-swatch-${index}`}
      type="button"
      className={`icon-swatch-wrap ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}`}
      onClick={handleClick}
      title={item.name}
    >
      <div className="icon-swatch">
        {IconComponent ? (
          <IconComponent size={18} />
        ) : (
          <Sparkles size={18} />
        )}
      </div>
    </button>
  )
})

const IconPicker = ({ isOpen, onClose, currentIcon, onSelect }) => {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const modalContainerRef = useRef(null)
  const posRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const initialPosRef = useRef({ x: 0, y: 0 })

  // Direct GPU-accelerated 0-latency drag handler
  const handleDragStart = useCallback((e) => {
    if (e.button !== 0) return
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    e.preventDefault()
    e.stopPropagation()

    isDraggingRef.current = true
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    initialPosRef.current = { x: posRef.current.x, y: posRef.current.y }
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current || !modalContainerRef.current) return
      const deltaX = moveEvent.clientX - dragStartRef.current.x
      const deltaY = moveEvent.clientY - dragStartRef.current.y
      const nextX = initialPosRef.current.x + deltaX
      const nextY = initialPosRef.current.y + deltaY
      posRef.current = { x: nextX, y: nextY }
      modalContainerRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove, { capture: true })
      window.removeEventListener('mouseup', handleMouseUp, { capture: true })
    }

    window.addEventListener('mousemove', handleMouseMove, { capture: true, passive: true })
    window.addEventListener('mouseup', handleMouseUp, { capture: true })
  }, [])

  const filteredIcons = useMemo(() => {
    const term = search.toLowerCase().trim()
    if (!term) return EMOJI_INDEX

    const terms = term.split(' ').filter(Boolean)
    return EMOJI_INDEX.filter((item) => {
      return terms.every((t) => item.searchString.includes(t))
    })
  }, [search])

  // Reset search, position, autofocus and selected index on open
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      posRef.current = { x: 0, y: 0 }
      if (modalContainerRef.current) {
        modalContainerRef.current.style.transform = 'translate3d(0px, 0px, 0)'
      }

      // Initialize selected index to current icon if present
      const initialIdx = currentIcon ? EMOJI_INDEX.findIndex((item) => item.char === currentIcon) : 0
      setSelectedIndex(initialIdx >= 0 ? initialIdx : 0)

      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true })
      }, 20)
      return () => clearTimeout(timer)
    }
  }, [isOpen, currentIcon])

  // Reset selected index on search change
  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  // Scroll active swatch into view when selectedIndex changes via keyboard
  useEffect(() => {
    if (isOpen) {
      const el = document.getElementById(`icon-swatch-${selectedIndex}`)
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex, isOpen])

  // Keyboard navigation (Arrow keys, Enter, Escape)
  useEffect(() => {
    if (!isOpen) return

    const COLUMNS = 7

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }

      if (filteredIcons.length === 0) return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(filteredIcons.length - 1, prev + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(0, prev - 1))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(filteredIcons.length - 1, prev + COLUMNS))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(0, prev - COLUMNS))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredIcons[selectedIndex]) {
          onSelect(filteredIcons[selectedIndex].char)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isOpen, filteredIcons, selectedIndex, onSelect, onClose])

  const handleSelectIcon = useCallback((iconChar, idx) => {
    if (idx !== undefined) setSelectedIndex(idx)
    onSelect(iconChar)
    // Kept open for real-time live selection!
  }, [onSelect])

  if (!isOpen) return null

  return createPortal(
    <div className="modal-overlay icon-modal-overlay">
      <div
        ref={modalContainerRef}
        className="icon-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: 'translate3d(0px, 0px, 0)',
          position: 'relative',
          willChange: 'transform'
        }}
      >
        <ModalHeader
          title="Choose Icon"
          icon={<Sparkles size={14} />}
          onClose={onClose}
          onMouseDown={handleDragStart}
          style={{ cursor: 'grab' }}
        />

        {/* Compact Search Bar */}
        <div className="icon-modal-search">
          <Search size={13} className="icon-modal-search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search icons (e.g., folder, star, tech)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="icon-search-clear-btn"
              onClick={() => setSearch('')}
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Grid Container */}
        <div className="icon-modal-grid">
          {/* Default / Reset Pill */}
          <button
            type="button"
            className={`icon-swatch-wrap ${!currentIcon ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(null)
            }}
            title="Auto / Default"
          >
            <div className="icon-swatch icon-swatch-auto">
              <span className="icon-auto-text">Auto</span>
            </div>
          </button>

          {filteredIcons.map((item, index) => (
            <IconItem
              key={item.char + item.name}
              item={item}
              index={index}
              isActive={currentIcon === item.char}
              isFocused={selectedIndex === index}
              onSelect={handleSelectIcon}
            />
          ))}
        </div>

        {/* Empty State */}
        {filteredIcons.length === 0 && (
          <div className="icon-modal-empty">
            <span>No icons found. Try <em>"file"</em>, <em>"star"</em>, or <em>"code"</em>.</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export default React.memo(IconPicker)
