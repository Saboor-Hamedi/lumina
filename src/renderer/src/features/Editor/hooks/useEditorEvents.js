/**
 * =========================================================================================
 * Editor Window Events Hook (`useEditorEvents.js`)
 * =========================================================================================
 *
 * Responsibilities:
 * - Subscribes to global window events when the editor tab is active:
 *   - Search update & search clear
 *   - Focus editor start & title input
 *   - Scroll to line
 *   - Global toast dispatching
 *   - AI save synchronization
 *   - Global search/preview shortcuts (Ctrl+F, Ctrl+H, Ctrl+\)
 * =========================================================================================
 */

import { useEffect, useRef } from 'react'
import { Decoration } from '@codemirror/view'
import { updateSearchHighlights } from './useEditorExtensions'
import { applyTableSearchHighlight, clearTableSearchHighlight } from '../../table/tableCell'

export function useEditorEvents({
  isActive,
  realViewRef,
  titleRef,
  snippet,
  showToast,
  setShowFindWidget,
  setReplaceModeActive,
  setIsPreviewOpen,
  lastSaveTimeRef,
  lastSavedCodeRef,
  latestCodeRef,
  setIsDirty,
  setDirty
}) {
  const isActiveRef = useRef(isActive)
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  // --- Keyboard Shortcuts (Ctrl+F, Ctrl+H, Ctrl+\) & Measure ---
  useEffect(() => {
    if (!isActive) return

    if (realViewRef.current) {
      requestAnimationFrame(() => {
        if (realViewRef.current) {
          realViewRef.current.requestMeasure()
          setTimeout(() => {
            if (realViewRef.current) realViewRef.current.requestMeasure()
          }, 50)
        }
      })
    }

    const handleGlobalKeyDown = (e) => {
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setReplaceModeActive(false)
        setShowFindWidget(true)
      } else if (e.key === 'h' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setReplaceModeActive(true)
        setShowFindWidget(true)
      } else if (e.key === '\\' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setIsPreviewOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isActive, setShowFindWidget, setReplaceModeActive, setIsPreviewOpen, realViewRef])

  // --- Global Window Events ---
  useEffect(() => {
    const handleSearchUpdate = (e) => {
      if (!isActiveRef.current || !realViewRef.current) return
      const view = realViewRef.current
      const { pattern } = e.detail || {}

      if (!pattern || !e.detail.searchQuery) {
        view.dispatch({ effects: updateSearchHighlights.of(Decoration.none) })
        clearTableSearchHighlight(view.dom)
        return
      }

      const text = view.state.doc.toString()
      const decorations = []
      const mark = Decoration.mark({ class: 'cm-searchMatch' })

      try {
        const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'g')
        for (const match of text.matchAll(regex)) {
          decorations.push(mark.range(match.index, match.index + match[0].length))
        }
        view.dispatch({ effects: updateSearchHighlights.of(Decoration.set(decorations, true)) })
        applyTableSearchHighlight(view.dom, regex)
      } catch (err) {
        view.dispatch({ effects: updateSearchHighlights.of(Decoration.none) })
        clearTableSearchHighlight(view.dom)
      }
    }

    const handleSearchClear = () => {
      if (!isActiveRef.current || !realViewRef.current) return
      realViewRef.current.dispatch({ effects: updateSearchHighlights.of(Decoration.none) })
      clearTableSearchHighlight(realViewRef.current.dom)
    }

    const handleFocusEditorStart = () => {
      if (!isActiveRef.current || !realViewRef.current) return
      const view = realViewRef.current
      view.focus()
      view.dispatch({ selection: { anchor: 0, head: 0 } })
    }

    const handleFocusTitleInput = () => {
      if (!isActiveRef.current || !titleRef.current) return
      titleRef.current.focus()
      titleRef.current.select()
    }

    const handleScrollToLine = (e) => {
      if (!isActiveRef.current || !realViewRef.current) return
      const view = realViewRef.current
      const lineNum = e.detail?.line
      if (typeof lineNum !== 'number') return
      try {
        const doc = view.state.doc
        const targetLineNum = Math.max(1, Math.min(lineNum, doc.lines))
        const targetLine = doc.line(targetLineNum)

        view.dispatch({
          selection: { anchor: targetLine.from }
        })

        const lineBlock = view.lineBlockAt(targetLine.from)
        const scroller = view.dom.closest('.editor-scroller')

        if (scroller) {
          const scrollY = lineBlock.top - scroller.clientHeight / 2 + lineBlock.height / 2
          scroller.scrollTo({ top: Math.max(0, scrollY), behavior: 'smooth' })
        }

        setTimeout(() => {
          if (realViewRef.current && realViewRef.current.contentDOM) {
            realViewRef.current.contentDOM.focus({ preventScroll: true })
          }
        }, 50)
      } catch (err) {
        console.error('[Editor] Scroll error:', err)
      }
    }

    const handleGlobalToast = (e) => {
      if (!isActiveRef.current) return
      const { message, type } = e.detail || {}
      if (message) {
        showToast(message, type || 'info')
      }
    }

    window.addEventListener('search-update', handleSearchUpdate)
    window.addEventListener('search-clear', handleSearchClear)
    window.addEventListener('focus-editor-start', handleFocusEditorStart)
    window.addEventListener('focus-title-input', handleFocusTitleInput)
    window.addEventListener('editor-scroll-to-line', handleScrollToLine)
    window.addEventListener('show-toast', handleGlobalToast)
    return () => {
      window.removeEventListener('search-update', handleSearchUpdate)
      window.removeEventListener('search-clear', handleSearchClear)
      window.removeEventListener('focus-editor-start', handleFocusEditorStart)
      window.removeEventListener('focus-title-input', handleFocusTitleInput)
      window.removeEventListener('editor-scroll-to-line', handleScrollToLine)
      window.removeEventListener('show-toast', handleGlobalToast)
    }
  }, [showToast, realViewRef, titleRef])

  // --- AI Save Synchronization ---
  useEffect(() => {
    const handleAISave = (e) => {
      if (e.detail?.id !== snippet?.id) return
      const newCode = e.detail?.code ?? ''

      lastSaveTimeRef.current = Date.now()
      lastSavedCodeRef.current = newCode
      latestCodeRef.current = newCode

      setIsDirty(false)
      setDirty(snippet?.id, false)

      if (realViewRef.current) {
        const view = realViewRef.current
        const current = view.state.doc.toString()
        if (current !== newCode) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: newCode }
          })
        }
      }
    }
    window.addEventListener('ai-saved-snippet', handleAISave)
    return () => window.removeEventListener('ai-saved-snippet', handleAISave)
  }, [snippet?.id, setDirty, realViewRef, lastSaveTimeRef, lastSavedCodeRef, latestCodeRef, setIsDirty])

  return {
    isActiveRef
  }
}
