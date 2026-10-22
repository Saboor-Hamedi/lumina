import React, { useEffect, useRef, type MutableRefObject } from 'react'
import {
  Decoration,
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  rectangularSelection,
  type Panel
} from '@codemirror/view'
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state'
import { indentOnInput, type LanguageDescription } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from '@codemirror/commands'
import { markdown, markdownKeymap, markdownLanguage } from '@codemirror/lang-markdown'
import {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  search,
  searchKeymap,
  searchPanelOpen,
  setSearchQuery
} from '@codemirror/search'
import {
  atomicEditorTheme,
  atomicMarkdownSyntax,
  autoCloseCodeFence,
  extendEmphasisPair,
  imageBlocks,
  tables
} from '@atomic-editor/editor'
import { inlinePreview } from './inlinePreview'

export interface AtomicCodeMirrorEditorHandle {
  focus: () => void
  undo: () => void
  redo: () => void
  openSearch: (query?: string) => void
  closeSearch: () => void
  revealText: (query: string) => void
  isSearchOpen: () => boolean
  getMarkdown: () => string
  getContentDOM: () => HTMLElement | null
}

export interface AtomicCodeMirrorEditorProps {
  documentId?: string
  markdownSource: string
  initialSearchText?: string | null
  initialRevealText?: string | null
  blurEditorOnMount?: boolean
  onMarkdownChange?: (markdown: string) => void
  onLinkClick?: (url: string) => void
  editorHandleRef?: MutableRefObject<AtomicCodeMirrorEditorHandle | null>
  codeLanguages?: readonly LanguageDescription[]
  extensions?: readonly Extension[]
}

const EMPTY_CODE_LANGUAGES: readonly LanguageDescription[] = []
const EMPTY_EXTENSIONS: readonly Extension[] = []

export function AtomicCodeMirrorEditor({
  markdownSource,
  documentId,
  initialSearchText,
  initialRevealText,
  blurEditorOnMount: _blurEditorOnMount,
  onMarkdownChange,
  onLinkClick,
  editorHandleRef,
  codeLanguages = EMPTY_CODE_LANGUAGES,
  extensions = EMPTY_EXTENSIONS
}: AtomicCodeMirrorEditorProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const clearRevealTimerRef = useRef<number | null>(null)
  const onMarkdownChangeRef = useRef(onMarkdownChange)
  const onLinkClickRef = useRef(onLinkClick)

  useEffect(() => {
    onMarkdownChangeRef.current = onMarkdownChange
  }, [onMarkdownChange])

  useEffect(() => {
    onLinkClickRef.current = onLinkClick
  }, [onLinkClick])

  const editorIdentity = documentId ?? markdownSource

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const view = new EditorView({
      parent: root,
      state: EditorState.create({
        doc: markdownSource,
        extensions: [
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          rectangularSelection(),
          highlightActiveLine(),
          closeBrackets(),
          extendEmphasisPair,
          autoCloseCodeFence,
          EditorView.lineWrapping,
          search({
            top: true,
            createPanel: (innerView) => {
              const panel = defaultSearchPanel(innerView)
              panel.dom.classList.add('atomic-editor-search-panel')
              return panel
            }
          }),
          markdown({ base: markdownLanguage, codeLanguages: [...codeLanguages] }),
          markdownLanguage.data.of({
            closeBrackets: { brackets: ['(', '[', '{', "'", '"', '*', '_', '`'] }
          }),
          atomicMarkdownSyntax,
          atomicEditorTheme,
          keymap.of([
            ...closeBracketsKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...markdownKeymap,
            indentWithTab,
            ...defaultKeymap
          ]),
          tables({
            onLinkClick: (url: string) => onLinkClickRef.current?.(url)
          }),
          imageBlocks(),
          inlinePreview({
            onLinkClick: (url: string) => onLinkClickRef.current?.(url)
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            onMarkdownChangeRef.current?.(update.state.doc.toString())
          }),
          initialRevealField,
          ...extensions
        ]
      })
    })

    viewRef.current = view

    if (initialSearchText) {
      queueMicrotask(() => {
        if (viewRef.current !== view) return
        view.dispatch({
          effects: setSearchQuery.of(new SearchQuery({ search: initialSearchText }))
        })
        openSearchPanel(view)
      })
    }

    return () => {
      if (clearRevealTimerRef.current !== null) {
        window.clearTimeout(clearRevealTimerRef.current)
        clearRevealTimerRef.current = null
      }
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorIdentity])

  useEffect(() => {
    const view = viewRef.current
    if (!view || !initialRevealText) return
    revealInitialMatch(viewRef, view, initialRevealText, clearRevealTimerRef)
  }, [editorIdentity, initialRevealText])

  useEffect(() => {
    if (!editorHandleRef) return
    editorHandleRef.current = {
      focus: () => viewRef.current?.focus(),
      undo: () => {
        const view = viewRef.current
        if (view) undo(view)
      },
      redo: () => {
        const view = viewRef.current
        if (view) redo(view)
      },
      openSearch: (query?: string) => {
        const view = viewRef.current
        if (!view) return
        if (query !== undefined) {
          view.dispatch({
            effects: setSearchQuery.of(new SearchQuery({ search: query }))
          })
        }
        openSearchPanel(view)
      },
      closeSearch: () => {
        const view = viewRef.current
        if (view) closeSearchPanel(view)
      },
      revealText: (query: string) => {
        const view = viewRef.current
        if (!view || !query) return
        revealInitialMatch(viewRef, view, query, clearRevealTimerRef)
      },
      isSearchOpen: () => {
        const view = viewRef.current
        return view ? searchPanelOpen(view.state) : false
      },
      getMarkdown: () => viewRef.current?.state.doc.toString() ?? '',
      getContentDOM: () => viewRef.current?.contentDOM ?? null
    }
    return () => {
      if (editorHandleRef.current) {
        editorHandleRef.current = null
      }
    }
  }, [editorHandleRef])

  return <div ref={rootRef} className="atomic-cm-editor" />
}

export const LuminaCodeMirrorEditor = AtomicCodeMirrorEditor

// ---------------------------------------------------------------------
// Initial Reveal Highlight
// ---------------------------------------------------------------------
const setInitialReveal = StateEffect.define<{ from: number; to: number } | null>()
const initialRevealField = StateField.define({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes)
    for (const effect of tr.effects) {
      if (!effect.is(setInitialReveal)) continue
      if (!effect.value) {
        decorations = Decoration.none
        continue
      }
      decorations = Decoration.set([
        Decoration.mark({ class: 'cm-initialRevealMatch' }).range(effect.value.from, effect.value.to)
      ])
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field)
})

const REVEAL_FADE_MS = 3200

function revealInitialMatch(
  viewRef: React.MutableRefObject<EditorView | null>,
  view: EditorView,
  queryText: string,
  clearRevealTimerRef: React.MutableRefObject<number | null>
): void {
  const match = findInitialRevealRange(view.state.doc, queryText)
  if (!match) return
  const { from, to } = match
  view.dispatch({
    effects: [setInitialReveal.of({ from, to }), EditorView.scrollIntoView(from, { y: 'start', yMargin: 72 })]
  })

  requestAnimationFrame(() => {
    if (viewRef.current !== view) return
    const el =
      view.dom.querySelector('.cm-initialRevealMatch')?.closest('.cm-line') ??
      view.dom.querySelector('.cm-initialRevealMatch')
    if (el instanceof HTMLElement) {
      scrollMatchNearTop(el, 72)
    }
  })

  if (clearRevealTimerRef.current !== null) {
    window.clearTimeout(clearRevealTimerRef.current)
  }
  clearRevealTimerRef.current = window.setTimeout(() => {
    if (viewRef.current !== view) return
    view.dispatch({ effects: setInitialReveal.of(null) })
    clearRevealTimerRef.current = null
  }, REVEAL_FADE_MS)
}

function findInitialRevealRange(
  docText: any,
  queryText: string
): { from: number; to: number } | null {
  for (const candidate of buildRevealCandidates(queryText)) {
    const query = new SearchQuery({ search: candidate })
    if (!query.valid || !query.search) continue
    const cursor = query.getCursor(docText)
    const first = cursor.next()
    if (!first.done && first.value.from !== first.value.to) {
      return first.value
    }
  }
  return null
}

function buildRevealCandidates(queryText: string): string[] {
  const candidates = new Set<string>()
  const trimmed = queryText.trim()
  if (!trimmed) return []
  candidates.add(trimmed)
  const collapsed = trimmed.replace(/\s+/g, ' ').trim()
  if (collapsed) candidates.add(collapsed)
  for (const line of trimmed
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean)) {
    candidates.add(line)
    const lineCollapsed = line.replace(/\s+/g, ' ').trim()
    if (lineCollapsed) candidates.add(lineCollapsed)
  }
  if (collapsed.length > 140) candidates.add(collapsed.slice(0, 140).trim())
  if (collapsed.length > 80) candidates.add(collapsed.slice(0, 80).trim())
  return [...candidates].filter((candidate) => candidate.length >= 12 || candidate === trimmed)
}

function scrollMatchNearTop(match: HTMLElement, offset: number): void {
  const scrollParent = findScrollParent(match)
  if (!scrollParent) {
    match.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  const parentRect = scrollParent.getBoundingClientRect()
  const matchRect = match.getBoundingClientRect()
  const nextTop = scrollParent.scrollTop + (matchRect.top - parentRect.top) - offset
  scrollParent.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
}

function findScrollParent(node: HTMLElement): HTMLElement | null {
  let current = node.parentElement
  while (current) {
    const { overflowY } = window.getComputedStyle(current)
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
      return current
    }
    current = current.parentElement
  }
  return null
}

// ---------------------------------------------------------------------
// Built-in Minimal Search Panel
// ---------------------------------------------------------------------
const SEARCH_ICON_PREV = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`
const SEARCH_ICON_NEXT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`
const SEARCH_ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`

function defaultSearchPanel(view: EditorView): Panel {
  const dom = document.createElement('div')
  dom.className = 'cm-search'
  dom.setAttribute('aria-label', 'Find')
  const form = document.createElement('form')
  form.autocomplete = 'off'
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    findNext(view)
  })

  const initial = getSearchQuery(view.state)
  const searchInput = document.createElement('input')
  searchInput.type = 'text'
  searchInput.placeholder = 'Search'
  searchInput.value = initial.search
  searchInput.className = 'cm-atomic-search-input'
  searchInput.setAttribute('main-field', 'true')
  searchInput.setAttribute('aria-label', 'Search')

  const count = document.createElement('span')
  count.className = 'cm-atomic-search-count'
  count.setAttribute('aria-live', 'polite')

  const prevBtn = makeIconButton(SEARCH_ICON_PREV, 'Previous match', () => findPrevious(view))
  const nextBtn = makeIconButton(SEARCH_ICON_NEXT, 'Next match', () => findNext(view))
  const closeBtn = makeIconButton(SEARCH_ICON_CLOSE, 'Close', () => closeSearchPanel(view))

  const recomputeCount = (query: SearchQuery): void => {
    if (!query.search) {
      count.textContent = ''
      return
    }
    try {
      if (!query.valid) {
        count.textContent = ''
        return
      }
      let n = 0
      let capped = false
      const cursor = query.getCursor(view.state.doc)
      while (!cursor.next().done) {
        n++
        if (n >= 10000) {
          capped = true
          break
        }
      }
      count.textContent = capped ? '9999+ matches' : n === 0 ? 'No matches' : n === 1 ? '1 match' : `${n} matches`
    } catch {
      count.textContent = ''
    }
  }

  const dispatchQuery = (): void => {
    const query = new SearchQuery({
      search: searchInput.value,
      caseSensitive: initial.caseSensitive,
      regexp: initial.regexp,
      wholeWord: initial.wholeWord
    })
    view.dispatch({ effects: setSearchQuery.of(query) })
    recomputeCount(query)
  }

  searchInput.addEventListener('input', dispatchQuery)
  recomputeCount(initial)

  form.append(searchInput, count, prevBtn, nextBtn, closeBtn)
  dom.append(form)

  return {
    dom,
    top: true,
    mount: () => {
      searchInput.focus()
      searchInput.select()
    },
    update: (update) => {
      const next = getSearchQuery(update.state)
      const prev = getSearchQuery(update.startState)
      if (next.search !== prev.search && searchInput.value !== next.search) {
        searchInput.value = next.search
      }
      if (update.docChanged || next.search !== prev.search) {
        recomputeCount(next)
      }
    }
  }
}

function makeIconButton(svg: string, label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'cm-atomic-search-btn'
  el.innerHTML = svg
  el.setAttribute('aria-label', label)
  el.title = label
  el.addEventListener('click', onClick)
  return el
}
