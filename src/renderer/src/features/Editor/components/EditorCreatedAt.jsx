import React, { useState, useEffect, useRef } from 'react'
import { useNoteCreatedAt } from '../../../core/utils/noteCreatedAt'

/**
 * EditorCreatedAt
 *
 * Displays a sleek, VS Code-style creation timestamp floating top-center
 * directly under the Breadcrumbs bar.
 *
 * Interaction:
 * - Slides down and appears the moment the user scrolls down into the document.
 * - Smoothly slides up out of view when scrolling up or returning to top.
 * - Locks the initial timestamp per snippet ID so saving a note doesn't reset it.
 */
export const EditorCreatedAt = React.memo(({ snippet, scrollerRef }) => {
  const lockedCreatedMap = useRef(new Map())
  if (snippet?.id && !lockedCreatedMap.current.has(snippet.id)) {
    lockedCreatedMap.current.set(
      snippet.id,
      snippet.createdAt || snippet.timestamp || null
    )
  }

  const effectiveCreatedAt =
    snippet?.createdAt || (snippet?.id ? lockedCreatedMap.current.get(snippet.id) : null)
  const createdAtLabel = useNoteCreatedAt(effectiveCreatedAt)

  const [isVisible, setIsVisible] = useState(false)
  const lastScrollTopRef = useRef(0)

  useEffect(() => {
    setIsVisible(false)
    lastScrollTopRef.current = 0
  }, [snippet?.id])

  useEffect(() => {
    const el = scrollerRef?.current
    if (!el) return

    const handleScroll = () => {
      const st = el.scrollTop
      const prev = lastScrollTopRef.current

      if (st <= 12) {
        // Near top of document: smoothly tuck away under Breadcrumbs
        setIsVisible(false)
      } else if (st > prev + 2) {
        // Scrolling down: the moment we scroll down it appears
        setIsVisible(true)
      } else if (st < prev - 2) {
        // Scrolling up: when we scroll up, it goes up smooth
        setIsVisible(false)
      }

      lastScrollTopRef.current = st
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [scrollerRef, snippet?.id])

  if (!createdAtLabel) return null

  return (
    <div
      className="editor-created-at-banner"
      style={{
        position: 'absolute',
        top: '6px',
        left: '50%',
        transform: isVisible ? 'translate(-50%, 0)' : 'translate(-50%, -150%)',
        opacity: isVisible ? 1 : 0,
        transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease',
        zIndex: 35,
        pointerEvents: 'none',
        userSelect: 'none',
        fontSize: '8.5px',
        letterSpacing: '0.04em',
        lineHeight: 1,
        fontWeight: 500,
        color: 'var(--text-faint, rgba(255, 255, 255, 0.45))',
        // background: 'var(--bg-panel, rgba(24, 24, 31, 0.85))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '3px 9px',
        borderRadius: '2px',
        // border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}
    >
      <span>{createdAtLabel}</span>
    </div>
  )
})

EditorCreatedAt.displayName = 'EditorCreatedAt'
export default EditorCreatedAt
