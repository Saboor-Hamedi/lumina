import {
  Decoration,
  type DecorationSet,
  type EditorView,
  MatchDecorator,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view'

const tagDecorator = new MatchDecorator({
  regexp: /(?<=\W|^)(#[a-zA-Z0-9_\u00C0-\u017F\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF-]+)/g,
  decoration: () => Decoration.mark({ class: 'cm-inline-tag' })
})

const mentionDecorator = new MatchDecorator({
  regexp: /(?<=\W|^)(@[a-zA-Z0-9_\u00C0-\u017F\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF-]+)/g,
  decoration: () => Decoration.mark({ class: 'cm-inline-mention' })
})

interface MatchDecoratorPluginValue {
  decorations: DecorationSet
  update(update: ViewUpdate): void
}

function createPlugin(decorator: MatchDecorator) {
  return ViewPlugin.define<MatchDecoratorPluginValue>(
    (view: EditorView) => ({
      decorations: decorator.createDeco(view),
      update(update: ViewUpdate) {
        this.decorations = decorator.updateDeco(update, this.decorations)
      }
    }),
    {
      decorations: (v) => v.decorations
    }
  )
}

export const tagMentionExtension = [
  createPlugin(tagDecorator),
  createPlugin(mentionDecorator)
]
