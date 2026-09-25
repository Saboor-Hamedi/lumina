/**
 * =========================================================================
 * EditorCreatedAt Component (`EditorCreatedAt.tsx`)
 * =========================================================================
 *
 * Displays a sleek, VS Code-style creation timestamp floating top-center
 * directly under the Breadcrumbs bar.
 *
 * Performance Architecture:
 * - Debounced / guard-checked visibility state: Only dispatches React state
 *   when visibility actually toggles, ensuring 0 redundant re-renders on scroll.
 * - Hardware-accelerated CSS transforms.
 * =========================================================================
 */

import React, { useState, useEffect, useRef, memo } from 'react'
import { useNoteCreatedAt } from '../../../core/utils/noteCreatedAt'
import type { Snippet } from '../../../core/editor/types'

export interface EditorCreatedAtProps {
  snippet: Snippet | any
  scrollerRef: React.RefObject<HTMLDivElement | null>
}

export const EditorCreatedAt: React.FC<EditorCreatedAtProps> = memo(({ snippet, scrollerRef }) => {
  const lockedCreatedMap = useRef(new Map<string, any>())
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
  const isVisibleRef = useRef(false)
  const lastScrollTopRef = useRef(0)

  useEffect(() => {
    setIsVisible(false)
    isVisibleRef.current = false
    lastScrollTopRef.current = 0
  }, [snippet?.id])

  useEffect(() => {
    const el = scrollerRef?.current
    if (!el) return

    let rafId: number | null = null

    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const st = el.scrollTop
        const prev = lastScrollTopRef.current

        if (st <= 12) {
          if (isVisibleRef.current) {
            isVisibleRef.current = false
            setIsVisible(false)
          }
        } else if (st > prev + 4) {
          if (!isVisibleRef.current) {
            isVisibleRef.current = true
            setIsVisible(true)
          }
        } else if (st < prev - 4) {
          if (isVisibleRef.current) {
            isVisibleRef.current = false
            setIsVisible(false)
          }
        }

        lastScrollTopRef.current = st
      })
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      el.removeEventListener('scroll', handleScroll)
    }
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
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '3px 9px',
        borderRadius: '2px',
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
