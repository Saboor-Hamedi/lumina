import { useMemo } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'

export const useTag = () => {
  const notes = useWorkspaceStore((state) => state.notes) || []

  const tags = useMemo(() => {
    const tagSet = new Set()
    const tagRegex = /(?:^|\s)(#[\w-]+)/g

    notes.forEach((note) => {
      // 1. Add frontmatter tags
      if (note.tags) {
        const rawTags = Array.isArray(note.tags)
          ? note.tags
          : typeof note.tags === 'string'
            ? note.tags.split(',')
            : []

        rawTags.forEach((t) => {
          const trimmed = String(t).trim()
          if (trimmed) {
            tagSet.add(trimmed.startsWith('#') ? trimmed : `#${trimmed}`)
          }
        })
      }

      // 2. Add inline tags from markdown body (exclude code blocks)
      let code = note.code || ''
      code = code.replace(/```[\s\S]*?```/g, '')
      code = code.replace(/`[^`]+`/g, '')

      let match
      while ((match = tagRegex.exec(code)) !== null) {
        tagSet.add(match[1])
      }
    })

    return Array.from(tagSet).sort()
  }, [notes])

  return { tags }
}
