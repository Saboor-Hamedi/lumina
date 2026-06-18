import { useMemo } from 'react'
import { useVaultStore } from '../store/useVaultStore'

export const useTag = () => {
  const { snippets } = useVaultStore()

  const tags = useMemo(() => {
    const tagSet = new Set()
    const tagRegex = /(?:^|\s)(#[\w-]+)/g

    snippets.forEach((snippet) => {
      // 1. Add frontmatter tags
      if (snippet.tags) {
        const rawTags = Array.isArray(snippet.tags) 
          ? snippet.tags 
          : (typeof snippet.tags === 'string' ? snippet.tags.split(',') : [])
        
        rawTags.forEach(t => {
          const trimmed = String(t).trim()
          if (trimmed) {
            tagSet.add(trimmed.startsWith('#') ? trimmed : `#${trimmed}`)
          }
        })
      }

      // 2. Add inline tags from markdown body (exclude code blocks)
      let code = snippet.code || ''
      code = code.replace(/```[\s\S]*?```/g, '')
      code = code.replace(/`[^`]+`/g, '')
      
      let match
      while ((match = tagRegex.exec(code)) !== null) {
        tagSet.add(match[1])
      }
    })

    return Array.from(tagSet).sort()
  }, [snippets])

  return { tags }
}
