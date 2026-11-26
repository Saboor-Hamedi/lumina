import { useMemo } from 'react'
import { useWorkspaceStore } from '../store/workspaceStore'

export const useMention = (): { mentions: string[] } => {
  const notes = useWorkspaceStore((state) => state.notes) || []

  const mentions = useMemo(() => {
    const mentionSet = new Set<string>()
    const mentionRegex = /(?:^|\s)(@[\w-]+)/g

    notes.forEach((note) => {
      // Add inline mentions from markdown body (exclude code blocks)
      let code = note.code || ''
      code = code.replace(/```[\s\S]*?```/g, '')
      code = code.replace(/`[^`]+`/g, '')

      let match: RegExpExecArray | null
      while ((match = mentionRegex.exec(code)) !== null) {
        mentionSet.add(match[1])
      }
    })

    return Array.from(mentionSet).sort()
  }, [notes])

  return { mentions }
}
