import { useMemo } from 'react'
import hljs from 'highlight.js/lib/core'

import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import xml from 'highlight.js/lib/languages/xml' // HTML uses XML
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import cpp from 'highlight.js/lib/languages/cpp'
import java from 'highlight.js/lib/languages/java'
import php from 'highlight.js/lib/languages/php'

// Register languages
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('html', xml) // Register HTML as XML
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('java', java)
hljs.registerLanguage('php', php)

// Language aliases mapping
const languageMap = {
  js: 'javascript',
  py: 'python',
  sh: 'bash',
  md: 'markdown',
  txt: 'text',
  text: 'text',
  php: 'php'
}

const useHighlight = (code, language = 'text') => {
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
