import { useState, useEffect, useCallback } from 'react'

/**
 * Custom hook to manage prompt submission, streaming AI generation, replacement and clipboard actions for InlineLumina.
 */
export const useInlineGeneration = ({
  isOpen,
  onClose,
  onInsert,
  contextRange,
  title,
  inputRef
}) => {
  const [query, setQuery] = useState('')
  const [lastQuery, setLastQuery] = useState('')
  const [response, setResponse] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [abortController, setAbortController] = useState(null)
  const [copied, setCopied] = useState(false)

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setLastQuery('')
      setResponse('')
      setIsGenerating(false)
      setCopied(false)
      if (abortController) {
        abortController.abort()
        setAbortController(null)
      }
    }
  }, [isOpen])

  const handleStop = useCallback(() => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
    setIsGenerating(false)
  }, [abortController])

  const handleCopy = useCallback(() => {
    if (response) {
      navigator.clipboard.writeText(response)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [response])

  const handleReplace = useCallback(() => {
    if (response && onInsert && contextRange) {
      onInsert(response, { from: contextRange.from, to: contextRange.to })
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (response && onInsert) {
      onInsert(response)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [response, onInsert, contextRange, inputRef])

  const handleCancel = useCallback(() => {
    handleStop()
    onClose()
  }, [handleStop, onClose])

  // Global ESC key listener
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        e.stopPropagation()
        handleCancel()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
    }

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true })
    }
  }, [isOpen, handleCancel])

  const handleSubmit = useCallback(
    async (e) => {
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }

      if (!query || !query.trim() || isGenerating) return

      const currentQuery = query.trim()
      setLastQuery(currentQuery)
      setQuery('')
      setIsGenerating(true)
      setResponse('')
      setCopied(false)

      const controller = new AbortController()
      setAbortController(controller)

      try {
        let systemPrompt = `You are a premium AI writing assistant integrated directly into a user's text editor.

CRITICAL INSTRUCTIONS:
1. You have access to the Full File Contents. Use this to deeply understand the topic, links, tags, and tone of the entire document.
2. When the user asks you to modify, expand, or rewrite the Target Block (their selection/cursor position), you MUST use the Full File Context to inform your changes. Ensure your output seamlessly integrates with the rest of the document.
3. If modifying text, output ONLY the final text for the Target Block. DO NOT include conversational filler like "Here is the expanded text:".
4. DO NOT wrap the text in markdown code blocks (\`\`\`) unless the user explicitly asks for code.
5. If the user asks a general question (e.g., "what is this file about", "summarize", "what is the file name"), answer concisely based on the Full File Contents.`

        if (title) {
          systemPrompt += `\n\n**File Name / Title:** ${title}`
        }

        if (contextRange) {
          if (contextRange.fullText) {
            systemPrompt += `\n\n**Full File Contents (For deep context & understanding):**\n\`\`\`\n${contextRange.fullText}\n\`\`\``
          }
          if (contextRange.text) {
            systemPrompt +=
              "\n\n**Current Target Block (Where the user's cursor/selection is located):**\n" +
              contextRange.text
            if (contextRange.isSelection) {
              systemPrompt +=
                '\n\n*(The user has highlighted the Target Block above. You must operate strictly on replacing/expanding this selection, but use the Full File Contents for context).*'
            } else {
              systemPrompt +=
                '\n\n*(This is the Target Block surrounding the user cursor. You must operate strictly on this block, but use the Full File Contents for context).*'
            }
          }
        }

        let visibleKey = null
        let model = 'deepseek-chat'
        try {
          const [{ useSettingsStore }, { resolveProviderConfig }] = await Promise.all([
            import('../../../core/store/useSettingsStore'),
            import('../providers/index.js')
          ])
          const settingsObj = useSettingsStore.getState().settings || {}
          const cfg = resolveProviderConfig(settingsObj)
          visibleKey = cfg.apiKey
          model = cfg.activeModel || 'deepseek-chat'
        } catch (err) {}

        if (!visibleKey) {
          setResponse('**Error:** Missing API Key. Please configure it in Settings.')
          setIsGenerating(false)
          return
        }

        const timeoutId = setTimeout(() => controller.abort(), 60000)

        let apiResponse
        try {
          apiResponse = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${visibleKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: currentQuery }
              ],
              temperature: 0.7,
              stream: true
            }),
            signal: controller.signal
          })
        } catch (fetchErr) {
          clearTimeout(timeoutId)
          if (fetchErr.name === 'AbortError') throw new Error('Request timed out.')
          throw fetchErr
        }

        clearTimeout(timeoutId)

        if (!apiResponse.ok) {
          const errData = await apiResponse.json().catch(() => ({}))
          throw new Error(errData.error?.message || `API Error: ${apiResponse.status}`)
        }

        const reader = apiResponse.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let fullResponse = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                  fullResponse += data.choices[0].delta.content
                  setResponse(fullResponse)
                }
              } catch (e) {}
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          setResponse((prev) => prev + '\n\n*(Generation stopped)*')
        } else {
          setResponse(`**Error:** ${err.message}`)
        }
      } finally {
        setIsGenerating(false)
        setAbortController(null)
      }
    },
    [query, isGenerating, contextRange, title]
  )

  return {
    query,
    setQuery,
    lastQuery,
    response,
    isGenerating,
    copied,
    handleStop,
    handleCopy,
    handleReplace,
    handleCancel,
    handleSubmit
  }
}
