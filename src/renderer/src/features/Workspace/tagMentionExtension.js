import { MatchDecorator, Decoration, ViewPlugin } from '@codemirror/view'

const tagPrefixDecorator = new MatchDecorator({
  regexp: /(?<=\s|^)(#)(?=[\w-]+)/g,
  decoration: (match) => Decoration.mark({ class: 'cm-tag-prefix' })
})

const tagTextDecorator = new MatchDecorator({
  regexp: /(?<=\s#|^#)([\w-]+)/g,
  decoration: (match) => Decoration.mark({ class: 'cm-inline-tag' })
})

const mentionPrefixDecorator = new MatchDecorator({
  regexp: /(?<=\s|^)(@)(?=[\w-]+)/g,
  decoration: (match) => Decoration.mark({ class: 'cm-mention-prefix' })
})

const mentionTextDecorator = new MatchDecorator({
  regexp: /(?<=\s@|^@)([\w-]+)/g,
  decoration: (match) => Decoration.mark({ class: 'cm-inline-mention' })
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
  createPlugin(tagPrefixDecorator),
  createPlugin(tagTextDecorator),
  createPlugin(mentionPrefixDecorator),
  createPlugin(mentionTextDecorator)
]
