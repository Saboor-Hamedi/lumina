import { useMemo } from 'react'
import { useVaultStore } from '../store/useVaultStore'

export const useMention = () => {
  const { snippets } = useVaultStore()

  const mentions = useMemo(() => {
    const mentionSet = new Set()
    const mentionRegex = /(?:^|\s)(@[\w-]+)/g

    snippets.forEach((snippet) => {
      // Add inline mentions from markdown body (exclude code blocks)
      let code = snippet.code || ''
      code = code.replace(/```[\s\S]*?```/g, '')
      code = code.replace(/`[^`]+`/g, '')

      let match
      while ((match = mentionRegex.exec(code)) !== null) {
        mentionSet.add(match[1])
      }
    })

    return Array.from(mentionSet).sort()
  }, [snippets])

  return { mentions }
}
