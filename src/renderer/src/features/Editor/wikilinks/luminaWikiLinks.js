/**
 * luminaWikiLinks.js
 * 
 * High-performance, 100% native CodeMirror 6 wikilink extension using Decoration.mark.
 * Eliminates all widget-based posBefore errors and provides standard paragraph-like text selection.
 */

import { RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'
import { useVaultStore } from '../../../core/store/useVaultStore'

const WIKILINK_REGEX = /\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g

export function createLuminaWikiLinks(config = {}) {
  const wikiLinkField = StateField.define({
    create(state) {
      return buildDecorations(state)
    },
    update(deco, tr) {
      if (tr.docChanged || tr.selection) {
        return buildDecorations(tr.state)
      }
      return deco.map(tr.changes)
    },
    provide: (f) => EditorView.decorations.from(f)
  })

  function buildDecorations(state) {
    const builder = new RangeSetBuilder()
    const doc = state.doc
    const sel = state.selection.main

    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i)
      const text = line.text
      if (!text.includes('[[')) continue

      let match
      WIKILINK_REGEX.lastIndex = 0
      while ((match = WIKILINK_REGEX.exec(text)) !== null) {
        const fullMatch = match[0]
        const target = match[1].trim()
        const alias = match[2]?.trim()
        const startPos = line.from + match.index
        const endPos = startPos + fullMatch.length

        // Check if cursor/selection intersects this wikilink
        const isActive = sel.from <= endPos && sel.to >= startPos

        if (isActive) {
          // While active/editing, show as highlighted text with brackets visible for editing
          builder.add(
            startPos,
            endPos,
            Decoration.mark({
              class: 'cm-atomic-wiki-link cm-atomic-wiki-link-active',
              attributes: { 'data-wiki-link-target': target }
            })
          )
        } else {
          // Inactive: hide [[, show styled target/alias, hide ]]
          const openBracketEnd = startPos + 2
          const closeBracketStart = endPos - 2

          // Hide [[
          builder.add(
            startPos,
            openBracketEnd,
            Decoration.mark({ class: 'cm-wikilink-syntax' })
          )

          // Styled text
          if (alias) {
            const pipePos = startPos + 2 + match[1].length
            // Target + pipe hidden
            builder.add(
              openBracketEnd,
              pipePos + 1,
              Decoration.mark({ class: 'cm-wikilink-syntax' })
            )
            // Alias styled as link
            builder.add(
              pipePos + 1,
              closeBracketStart,
              Decoration.mark({
                class: 'cm-atomic-wiki-link cm-atomic-wiki-link-resolved',
                attributes: { 'data-wiki-link-target': target }
              })
            )
          } else {
            // Target styled as link
            builder.add(
              openBracketEnd,
              closeBracketStart,
              Decoration.mark({
                class: 'cm-atomic-wiki-link cm-atomic-wiki-link-resolved',
                attributes: { 'data-wiki-link-target': target }
              })
            )
          }

          // Hide ]]
          builder.add(
            closeBracketStart,
            endPos,
            Decoration.mark({ class: 'cm-wikilink-syntax' })
          )
        }
      }
    }

    return builder.finish()
  }

  // Click handler (only navigates if it was a pure click, not a drag-selection)
  let clickStartX = 0
  let clickStartY = 0
  let isDragging = false

  const clickHandler = EditorView.domEventHandlers({
    mousedown(e) {
      clickStartX = e.clientX
      clickStartY = e.clientY
      isDragging = false
    },
    mousemove(e) {
      if (Math.abs(e.clientX - clickStartX) > 4 || Math.abs(e.clientY - clickStartY) > 4) {
        isDragging = true
      }
    },
    click(e, view) {
      if (isDragging) return false
      const link = e.target.closest('.cm-atomic-wiki-link')
      if (!link) return false

      const target = link.getAttribute('data-wiki-link-target')
      if (!target) return false

      // Check if user is actively holding modifier or clicking link
      e.preventDefault()
      e.stopPropagation()

      if (config.onOpen) {
        config.onOpen(target)
      } else {
        openNote(target)
      }
      return true
    }
  })

  async function openNote(target) {
    try {
      const { snippets: allSnippets, saveSnippet, setSelectedSnippet } = useVaultStore.getState()
      const targetLower = target.toLowerCase()
      let targetSnippet = allSnippets.find((s) => {
        if (!s.title) return false
        const titleLower = s.title.toLowerCase()
        const fullPathLower = s.folderId ? `${s.folderId}/${s.title}`.toLowerCase() : titleLower
        return (
          titleLower === targetLower ||
          titleLower === `${targetLower}.md` ||
          fullPathLower === targetLower ||
          fullPathLower === `${targetLower}.md`
        )
      })

      if (!targetSnippet) {
        targetSnippet = {
          id: crypto.randomUUID(),
          title: target,
          code: `# ${target}\n\n`,
          language: 'markdown',
          tags: '',
          timestamp: Date.now()
        }
        await saveSnippet(targetSnippet)
      }
      setSelectedSnippet(targetSnippet)
    } catch (err) {
      console.error('Failed to open wikilink:', err)
    }
  }

  return [wikiLinkField, clickHandler]
}
