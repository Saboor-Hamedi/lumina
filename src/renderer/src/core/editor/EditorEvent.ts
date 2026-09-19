import React, { useEffect, useRef } from 'react'
import { Decoration, type EditorView } from '@codemirror/view'
import { computeMinimalChange } from './editorDiff'
import { updateSearchHighlights } from './EditorExtensions'
import { applyTableSearchHighlight, clearTableSearchHighlight } from '../../features/table/tableCell'
import type { Snippet } from './types'
import type { ToastType } from '../notification'

export interface UseEditorEventsProps {
  isActive?: boolean
  realViewRef: React.MutableRefObject<EditorView | null>
  titleRef: React.RefObject<HTMLInputElement | null>
  snippet: Snippet | null
  showToast: (message: string, type?: ToastType) => void
  setShowFindWidget: React.Dispatch<React.SetStateAction<boolean>>
  setReplaceModeActive: React.Dispatch<React.SetStateAction<boolean>>
  setIsPreviewOpen?: React.Dispatch<React.SetStateAction<boolean>>
  lastSaveTimeRef: React.MutableRefObject<number>
  lastSavedCodeRef: React.MutableRefObject<string | undefined>
  latestCodeRef: React.MutableRefObject<string>
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>
  isDirty?: boolean
  isDirtyRef?: React.MutableRefObject<boolean>
  setDirty: (id: string, isDirty: boolean) => void
  setConflictPrompt?: React.Dispatch<React.SetStateAction<any>>
}

export interface UseEditorEventsReturn {
  isActiveRef: React.MutableRefObject<boolean>
}

/**
 * Hardened Editor Window Events Hook (`EditorEvent.ts`)
 *
 * Responsibilities:
 * - Subscribes to global window events when the editor tab is active:
 *   - Search update & search clear
 *   - Focus editor start & title input
 *   - Scroll to line
 *   - Global toast dispatching
 *   - AI save synchronization & overwrite conflict detection
 *   - Global search/preview shortcuts (Ctrl+F, Ctrl+H)
 */
export function useEditorEvents({
  isActive = true,
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
  isDirty = false,
  isDirtyRef,
  setDirty,
  setConflictPrompt
}: UseEditorEventsProps): UseEditorEventsReturn {
  const isActiveRef = useRef<boolean>(isActive)
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  // --- Keyboard Shortcuts (Ctrl+F, Ctrl+H) & Measure ---
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

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setReplaceModeActive(false)
        setShowFindWidget(true)
      } else if (e.key === 'h' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setReplaceModeActive(true)
        setShowFindWidget(true)
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isActive, setShowFindWidget, setReplaceModeActive, setIsPreviewOpen, realViewRef])

  // --- Global Window Events ---
  useEffect(() => {
    const handleSearchUpdate = (e: Event) => {
      if (!isActiveRef.current || !realViewRef.current) return
      const view = realViewRef.current
      const customEvent = e as CustomEvent
      const { pattern, searchQuery } = customEvent.detail || {}

      if (!pattern || !searchQuery) {
        view.dispatch({ effects: updateSearchHighlights.of(Decoration.none) })
        clearTableSearchHighlight(view.dom)
        return
      }

      const text = view.state.doc.toString()
      const decorations: any[] = []
      const mark = Decoration.mark({ class: 'cm-searchMatch' })

      try {
        const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'g')
        for (const match of text.matchAll(regex)) {
          if (typeof match.index === 'number') {
            decorations.push(mark.range(match.index, match.index + match[0].length))
          }
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

    const handleScrollToLine = (e: Event) => {
      if (!isActiveRef.current || !realViewRef.current) return
      const view = realViewRef.current
      const customEvent = e as CustomEvent
      const lineNum = customEvent.detail?.line
      if (typeof lineNum !== 'number') return
      try {
        const doc = view.state.doc
        const targetLineNum = Math.max(1, Math.min(lineNum, doc.lines))
        const targetLine = doc.line(targetLineNum)

        view.dispatch({
          selection: { anchor: targetLine.from }
        })

        const lineBlock = view.lineBlockAt(targetLine.from)
        const scroller = view.dom.closest('.editor-scroller') as HTMLElement | null

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

    const handleScrollToCursor = () => {
      if (!isActiveRef.current || !realViewRef.current) return
      const view = realViewRef.current
      try {
        const head = view.state.selection.main.head
        const line = view.state.doc.lineAt(head)
        const lineBlock = view.lineBlockAt(line.from)
        const scroller = view.dom.closest('.editor-scroller') as HTMLElement | null

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
        console.error('[Editor] Scroll to cursor error:', err)
      }
    }

    const handleGlobalToast = (e: Event) => {
      if (!isActiveRef.current) return
      const customEvent = e as CustomEvent
      const { message, type } = customEvent.detail || {}
      if (message) {
        showToast(message, type || 'info')
      }
    }

    window.addEventListener('search-update', handleSearchUpdate)
    window.addEventListener('search-clear', handleSearchClear)
    window.addEventListener('focus-editor-start', handleFocusEditorStart)
    window.addEventListener('focus-title-input', handleFocusTitleInput)
    window.addEventListener('editor-scroll-to-line', handleScrollToLine)
    window.addEventListener('editor-scroll-to-cursor', handleScrollToCursor)
    window.addEventListener('show-toast', handleGlobalToast)
    return () => {
      window.removeEventListener('search-update', handleSearchUpdate)
      window.removeEventListener('search-clear', handleSearchClear)
      window.removeEventListener('focus-editor-start', handleFocusEditorStart)
      window.removeEventListener('focus-title-input', handleFocusTitleInput)
      window.removeEventListener('editor-scroll-to-line', handleScrollToLine)
      window.removeEventListener('editor-scroll-to-cursor', handleScrollToCursor)
      window.removeEventListener('show-toast', handleGlobalToast)
    }
  }, [showToast, realViewRef, titleRef])

  // --- AI Save Synchronization ---
  useEffect(() => {
    const handleAISave = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.id !== snippet?.id) return
      const newCode = customEvent.detail?.code ?? ''
      const explicitPos = customEvent.detail?.changePos
      const explicitLine = customEvent.detail?.changeLine
      const scrollToBottom = customEvent.detail?.scrollToBottom === true

      if (!realViewRef.current) {
        latestCodeRef.current = newCode
        setIsDirty(false)
        if (snippet?.id) setDirty(snippet.id, false)
        return
      }

      const view = realViewRef.current
      const current = view.state.doc.toString()
      if (current === newCode) {
        latestCodeRef.current = newCode
        setIsDirty(false)
        if (snippet?.id) setDirty(snippet.id, false)
        return
      }

      lastSaveTimeRef.current = Date.now()
      lastSavedCodeRef.current = newCode

      const minimalChange = computeMinimalChange(current, newCode)
      if (minimalChange.from === minimalChange.to && minimalChange.insert.length === 0) {
        return
      }

      // Check if user has active focus in the editor
      const isEditorFocused = view.hasFocus || Boolean(document.activeElement?.closest?.('.cm-editor'))
      const activeEl = document.activeElement
      // Check if user is typing in composer or another input
      const isUserTypingElsewhere = Boolean(
        activeEl &&
        activeEl !== document.body &&
        !activeEl.closest?.('.cm-editor') &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable ||
          activeEl.closest?.('.composer-container') ||
          activeEl.closest?.('.composer-card'))
      )

      // Concurrent user activity protection:
      // If the user is actively working in the editor or another input (like the AI composer),
      // apply the minimal change while pinning the user's cursor position and preventing viewport hijacking!
      if (isEditorFocused || isUserTypingElsewhere) {
        const delta = minimalChange.insert.length - (minimalChange.to - minimalChange.from)
        const dispatchOptions: any = {
          changes: minimalChange,
          scrollIntoView: false
        }

        if (isEditorFocused) {
          const currentSel = view.state.selection.main
          const userAnchor = currentSel.anchor
          const userHead = currentSel.head

          let newAnchor = userAnchor
          let newHead = userHead

          // Anchor tracking
          if (minimalChange.to < userAnchor) {
            newAnchor = userAnchor + delta
          } else if (minimalChange.from <= userAnchor) {
            newAnchor = Math.min(userAnchor, minimalChange.from)
          }

          // Head (cursor) tracking:
          // If the AI edit is strictly before user cursor, offset it by delta.
          // If the AI edit is at or overlaps the user cursor, pin cursor at the boundary
          // so it NEVER gets pushed forward after Lumina's incoming text stream!
          // If the AI edit is after user cursor, keep current position unchanged.
          if (minimalChange.to < userHead) {
            newHead = userHead + delta
          } else if (minimalChange.from <= userHead) {
            newHead = Math.min(userHead, minimalChange.from)
          }

          const maxDocLen = current.length + delta
          newAnchor = Math.max(0, Math.min(newAnchor, maxDocLen))
          newHead = Math.max(0, Math.min(newHead, maxDocLen))

          dispatchOptions.selection = { anchor: newAnchor, head: newHead }
        }

        view.dispatch(dispatchOptions)

        const updatedDoc = view.state.doc.toString()
        latestCodeRef.current = updatedDoc

        // If the user made concurrent edits, preserve dirty flag so edits auto-save
        if (updatedDoc !== newCode) {
          setIsDirty(true)
          if (snippet?.id) setDirty(snippet.id, true)
        } else {
          setIsDirty(false)
          if (snippet?.id) setDirty(snippet.id, false)
        }
        return
      }

      // User is idle / observing AI response:
      let targetPos: number | null = null
      if (typeof explicitPos === 'number') {
        targetPos = Math.max(0, Math.min(explicitPos, newCode.length))
      } else if (typeof explicitLine === 'number') {
        // will resolve after dispatch
      } else if (!scrollToBottom) {
        targetPos = minimalChange.from
      }

      const selectionPos = scrollToBottom
        ? newCode.length
        : (targetPos ?? Math.min(view.state.selection.main.head, newCode.length))

      view.dispatch({
        changes: minimalChange,
        selection: { anchor: selectionPos, head: selectionPos }
      })

      latestCodeRef.current = view.state.doc.toString()
      setIsDirty(false)
      if (snippet?.id) setDirty(snippet.id, false)

      const performScroll = () => {
        if (!realViewRef.current) return
        const activeView = realViewRef.current
        const scroller =
          (activeView.dom?.closest('.editor-scroller') as HTMLElement | null) ||
          (document.querySelector('.editor-scroller') as HTMLElement | null)

        if (scrollToBottom) {
          if (scroller) scroller.scrollTop = scroller.scrollHeight
          if (activeView.scrollDOM) activeView.scrollDOM.scrollTop = activeView.scrollDOM.scrollHeight
          return
        }

        try {
          let scrollLine = null
          if (typeof explicitLine === 'number') {
            const targetLineNum = Math.max(1, Math.min(explicitLine, activeView.state.doc.lines))
            scrollLine = activeView.state.doc.line(targetLineNum)
          } else if (typeof selectionPos === 'number') {
            scrollLine = activeView.state.doc.lineAt(selectionPos)
          }

          if (scrollLine && scroller) {
            const lineBlock = activeView.lineBlockAt(scrollLine.from)
            // Center the modified section vertically in the viewport so the user clearly sees the update
            const scrollY = lineBlock.top - scroller.clientHeight / 2 + lineBlock.height / 2
            scroller.scrollTo({ top: Math.max(0, scrollY), behavior: 'smooth' })
          }
        } catch (err) {
          console.warn('[Editor] Scroll to change position error:', err)
        }
      }

      requestAnimationFrame(performScroll)
      setTimeout(performScroll, 50)
    }
    window.addEventListener('ai-saved-snippet', handleAISave)
    return () => window.removeEventListener('ai-saved-snippet', handleAISave)
  }, [
    snippet?.id,
    snippet?.title,
    setDirty,
    realViewRef,
    lastSaveTimeRef,
    lastSavedCodeRef,
    latestCodeRef,
    setIsDirty,
    isDirty,
    isDirtyRef,
    setConflictPrompt
  ])

  return {
    isActiveRef
  }
}

// Named alias and default export
export const EditorEvent = useEditorEvents
export default useEditorEvents
