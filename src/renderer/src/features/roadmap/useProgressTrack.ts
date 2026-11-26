import { StateField, StateEffect, type EditorState, type Range } from '@codemirror/state'
import { EditorView, Decoration, type DecorationSet, WidgetType } from '@codemirror/view'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { getTrackStats, type TrackStats } from './useStoreProgress'
import { parseTable } from '../table/tableModel'

export const forceRoadmapUpdateEffect = StateEffect.define<unknown>()

class ProgressBarWidget extends WidgetType {
  private readonly stats: TrackStats

  constructor(stats: TrackStats) {
    super()
    this.stats = stats
  }

  eq(other: ProgressBarWidget): boolean {
    return (
      this.stats.total === other.stats.total &&
      this.stats.completed === other.stats.completed &&
      this.stats.inProgress === other.stats.inProgress
    )
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'roadmap-progress-bar-wrap'
    wrap.style.width = '100%'
    wrap.style.height = '2px'
    wrap.style.backgroundColor = 'rgba(157, 124, 216, 0.3)'
    wrap.style.borderRadius = '1px'
    wrap.style.marginTop = '4px'
    wrap.style.marginBottom = '8px'
    wrap.style.overflow = 'hidden'
    wrap.style.position = 'relative'

    const fill = document.createElement('div')
    const { total, completed, inProgress } = this.stats
    const percentage =
      total === 0
        ? 0
        : Math.min(100, Math.round(((completed + inProgress * 0.5) / total) * 100))

    fill.style.width = `${percentage}%`
    fill.style.height = '100%'
    fill.style.backgroundColor = 'var(--text-accent, #9d7cd8)'
    wrap.appendChild(fill)

    wrap.title = `Progress: ${percentage}% (${completed}/${total} completed, ${inProgress} in progress)`

    return wrap
  }

  ignoreEvent(): boolean {
    return true
  }
}

export function buildRoadmapProgressBarDecorations(state: EditorState): DecorationSet {
  const builder: Range<Decoration>[] = []
  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state)
  const doc = state.doc

  let currentHeader: { name: string; to: number } | null = null

  tree.iterate({
    enter: (node) => {
      if (node.name.includes('Heading')) {
        const text = doc.sliceString(node.from, node.to).replace(/^#+\s*/, '').trim()
        currentHeader = { name: text, to: node.to }
      }

      if (node.name === 'Table' && currentHeader) {
        const model = parseTable(state, node.node)
        if (model && model.header.some((h) => /^(#|no\.?|status)$/i.test(h.replace(/[*_`]/g, '').trim()))) {
          const stats = getTrackStats(currentHeader.name, model)

          builder.push(
            Decoration.widget({
              widget: new ProgressBarWidget(stats),
              side: 1,
              block: true
            }).range(currentHeader.to)
          )
        }
        currentHeader = null
      }
    }
  })

  return Decoration.set(builder, true)
}

export const roadmapProgressBarPlugin = StateField.define<DecorationSet>({
  create(state) {
    return buildRoadmapProgressBarDecorations(state)
  },
  update(decos, tr) {
    const forceUpdate = tr.effects.some((e) => e.is(forceRoadmapUpdateEffect))
    if (tr.docChanged || forceUpdate) {
      return buildRoadmapProgressBarDecorations(tr.state)
    }
    return decos.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f)
})
