import { RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { normalizeWikilinkTarget } from '../../../core/i18n'

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

        const isActive = sel.from <= endPos && sel.to >= startPos

        if (isActive) {
          builder.add(
            startPos,
            endPos,
            Decoration.mark({
              class: 'cm-atomic-wiki-link cm-atomic-wiki-link-active',
              attributes: { 'data-wiki-link-target': target }
            })
          )
        } else {
          const openBracketEnd = startPos + 2
          const closeBracketStart = endPos - 2

          builder.add(
            startPos,
            openBracketEnd,
            Decoration.mark({ class: 'cm-wikilink-syntax' })
          )

          if (alias) {
            const pipePos = startPos + 2 + match[1].length
            builder.add(
              openBracketEnd,
              pipePos + 1,
              Decoration.mark({ class: 'cm-wikilink-syntax' })
            )
            builder.add(
              pipePos + 1,
              closeBracketStart,
              Decoration.mark({
                class: 'cm-atomic-wiki-link cm-atomic-wiki-link-resolved',
                attributes: { 'data-wiki-link-target': target }
              })
            )
          } else {
            builder.add(
              openBracketEnd,
              closeBracketStart,
              Decoration.mark({
                class: 'cm-atomic-wiki-link cm-atomic-wiki-link-resolved',
                attributes: { 'data-wiki-link-target': target }
              })
            )
          }

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
    click(e) {
      if (isDragging) return false
      const link = e.target.closest('.cm-atomic-wiki-link')
      if (!link) return false

      const target = link.getAttribute('data-wiki-link-target')
      if (!target) return false

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
      const { notes: allNotes, saveNote, setSelectedNote } = useWorkspaceStore.getState()
      const targetKey = normalizeWikilinkTarget(target)
      let targetSnippet = (allNotes || []).find((s) => {
        if (!s.title) return false
        const titleKey = normalizeWikilinkTarget(s.title)
        const titleWithoutMdKey = normalizeWikilinkTarget(s.title.replace(/\.md$/i, ''))
        const fullPathKey = s.folderId ? normalizeWikilinkTarget(`${s.folderId}/${s.title}`) : titleKey
        const fullPathWithoutMdKey = s.folderId
          ? normalizeWikilinkTarget(`${s.folderId}/${s.title.replace(/\.md$/i, '')}`)
          : titleWithoutMdKey
        return (
          titleKey === targetKey ||
          titleWithoutMdKey === targetKey ||
          fullPathKey === targetKey ||
          fullPathWithoutMdKey === targetKey
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
        if (saveNote) await saveNote(targetSnippet)
      }
      if (setSelectedNote) setSelectedNote(targetSnippet)
    } catch (err) {
      console.error('Failed to open wikilink:', err)
    }
  }

  return [wikiLinkField, clickHandler]
}

export default createLuminaWikiLinks
