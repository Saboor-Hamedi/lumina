import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Hash, Search, X } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import './BreadcrumbOutlineDropdown.css'

const BreadcrumbOutlineDropdown = ({ headings = [], activeHeading, anchorRect, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(() => {
    if (!activeHeading || !Array.isArray(headings) || headings.length === 0) return 0
    const idx = headings.findIndex((h) => h.line === activeHeading.line)
    return idx >= 0 ? idx : 0
  })

  const listRef = useRef(null)
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  const filteredHeadings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return headings
    return headings.filter((h) => (h.text || '').toLowerCase().includes(q))
  }, [headings, searchQuery])

  useEffect(() => {
    if (!searchQuery && activeHeading) {
      const idx = filteredHeadings.findIndex((h) => h.line === activeHeading.line)
      setActiveIndex(idx >= 0 ? idx : 0)
    } else if (searchQuery) {
      setActiveIndex(0)
    }
  }, [activeHeading, searchQuery, filteredHeadings])

  useLayoutEffect(() => {
    const el = listRef.current?.children[activeIndex]
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const handleSelectHeading = useCallback(
    (heading) => {
      if (heading?.line) {
        window.dispatchEvent(
          new CustomEvent('editor-scroll-to-line', { detail: { line: heading.line } })
        )
      }
      onClose()
    },
    [onClose]
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, filteredHeadings.length - 1)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredHeadings[activeIndex]) {
          handleSelectHeading(filteredHeadings[activeIndex])
        }
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [filteredHeadings, activeIndex, handleSelectHeading, onClose])

  useEffect(() => {
    const onPointerDown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => document.removeEventListener('pointerdown', onPointerDown, { capture: true })
  }, [onClose])

  const style = useMemo(() => {
    if (!anchorRect) return {}
    const width = 320
    const maxH = 340
    const gap = 5

    let top = anchorRect.bottom + gap
    let left = anchorRect.left

    const spaceBelow = window.innerHeight - anchorRect.bottom - gap
    const spaceAbove = anchorRect.top - gap

    if (spaceBelow < 220 && spaceAbove > spaceBelow) {
      top = Math.max(10, anchorRect.top - maxH - gap)
    }

    if (left + width > window.innerWidth - 12) {
      left = window.innerWidth - width - 12
    }
    if (left < 12) left = 12

    return {
      top: Math.round(top),
      left: Math.round(left),
      width,
      minWidth: width,
      maxWidth: width,
      maxHeight: maxH
    }
  }, [anchorRect])

  return createPortal(
    <div
      className="bc-outline-dropdown-card"
      ref={dropdownRef}
      style={style}
      role="dialog"
      aria-label="Table of contents"
    >
      <div className="bc-outline-header-bar">
        <div className="bc-outline-title-wrap">
          <Hash size={12} className="bc-outline-hash-icon" />
          <span className="bc-outline-title">Outline</span>
        </div>
        <ToolTip text={`${headings.length} headings`} position="bottom">
          <span className="bc-outline-count-pill">
            {headings.length}
          </span>
        </ToolTip>
      </div>

      {headings.length > 5 && (
        <div className="bc-outline-search-box">
          <Search size={12} className="bc-outline-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="bc-outline-search-input"
            placeholder="Filter headings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          {searchQuery && (
            <ToolTip text="Clear filter" position="bottom">
              <button
                type="button"
                className="bc-outline-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear filter"
              >
                <X size={11} />
              </button>
            </ToolTip>
          )}
        </div>
      )}

      {filteredHeadings.length === 0 ? (
        <div className="bc-outline-empty-notice">
          {searchQuery ? 'No matching headings' : 'No headings in note'}
        </div>
      ) : (
        <ul className="bc-outline-items-list" ref={listRef} role="listbox">
          {filteredHeadings.map((h, idx) => {
            const isActive = idx === activeIndex
            const isCurrent = activeHeading && h.line === activeHeading.line

            return (
              <li
                key={`${h.line}-${idx}`}
                className={[
                  'bc-outline-item',
                  isActive ? 'is-active' : '',
                  isCurrent ? 'is-current' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ paddingLeft: `${8 + Math.max(0, h.level - 1) * 12}px` }}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => handleSelectHeading(h)}
              >
                <span className={`bc-outline-badge level-${h.level}`}>
                  H{h.level}
                </span>

                <span className="bc-outline-label" title={h.text}>
                  {h.text}
                </span>

                <span className="bc-outline-line" title={`Line ${h.line}`}>
                  L{h.line}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>,
    document.body
  )
}

export default React.memo(BreadcrumbOutlineDropdown)
