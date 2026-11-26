import { useMemo } from 'react'
import hljs from '../code/hljsCore'

// Language aliases mapping
const languageMap: Record<string, string> = {
  js: 'javascript',
  py: 'python',
  sh: 'bash',
  md: 'markdown',
  txt: 'text',
  text: 'text',
  php: 'php'
}

const useHighlight = (code: string, language = 'text'): string => {
  return useMemo(() => {
    // Map language aliases to their full names
    const mappedLanguage = languageMap[language] || language

    // Handle plain text (no highlighting needed)
    if (mappedLanguage === 'text' || mappedLanguage === 'txt' || !code.trim()) {
      return code
    }

    try {
      // Try to highlight with the specified language
      const result = hljs.highlight(code, { language: mappedLanguage })
      return result.value
    } catch {
      // If language not supported, try auto-detection
      try {
        const result = hljs.highlightAuto(code)
        return result.value
      } catch {
        // Fallback to plain text
        return code
      }
    }
  }, [code, language])
}

export default useHighlight
