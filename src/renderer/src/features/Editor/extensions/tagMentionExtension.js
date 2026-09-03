import { MatchDecorator, Decoration, ViewPlugin } from '@codemirror/view'

const tagDecorator = new MatchDecorator({
  regexp: /(?<=\W|^)(#[a-zA-Z0-9_\u00C0-\u017F\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF-]+)/g,
  decoration: () => Decoration.mark({ class: 'cm-inline-tag' })
})

const mentionDecorator = new MatchDecorator({
  regexp: /(?<=\W|^)(@[a-zA-Z0-9_\u00C0-\u017F\u0600-\u06FF\u0400-\u04FF\u4E00-\u9FFF-]+)/g,
  decoration: () => Decoration.mark({ class: 'cm-inline-mention' })
})

function createPlugin(decorator) {
  return ViewPlugin.define(
    (view) => ({
      decorations: decorator.createDeco(view),
      update(update) {
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
