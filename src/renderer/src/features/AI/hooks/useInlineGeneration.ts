import { useState, useEffect, useCallback, FormEvent, RefObject } from 'react'
import { useSettingsStore } from '../../../core/store/SettingStore'
import { resolveProviderConfig, AIProviderFactory } from '../providers'
import type { InlineContextRange } from './useInlineContextExtractor'

export interface UseInlineGenerationProps {
  isOpen: boolean
  onClose: () => void
  onInsert?: (content: string, range?: { from: number; to: number }) => void
  contextRange?: InlineContextRange | null
  title?: string
  inputRef?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
}

export interface UseInlineGenerationReturn {
  query: string
  setQuery: (val: string) => void
  lastQuery: string
  response: string
  isGenerating: boolean
  copied: boolean
  handleStop: () => void
  handleCopy: () => void
  handleReplace: () => void
  handleCancel: () => void
  handleSubmit: (e?: FormEvent | KeyboardEvent) => Promise<void>
}

/**
 * Custom hook to manage prompt submission, streaming AI generation, replacement and clipboard actions for InlineLumina.
 * Integrates with AI providers (DeepSeek, OpenAI, Anthropic, Ollama) and streams directly into the active editor context.
 */
export const useInlineGeneration = ({
  isOpen,
  onClose,
  onInsert,
  contextRange,
  title,
  inputRef
}: UseInlineGenerationProps): UseInlineGenerationReturn => {
  const [query, setQuery] = useState<string>('')
  const [lastQuery, setLastQuery] = useState<string>('')
  const [response, setResponse] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [copied, setCopied] = useState<boolean>(false)

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
      setTimeout(() => inputRef?.current?.focus(), 50)
    } else if (response && onInsert) {
      onInsert(response)
      setTimeout(() => inputRef?.current?.focus(), 50)
    }
  }, [response, onInsert, contextRange, inputRef])

  const handleCancel = useCallback(() => {
    handleStop()
    onClose()
  }, [handleStop, onClose])

  // Global ESC key listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
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
    async (e?: FormEvent | KeyboardEvent) => {
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

        const settingsObj = useSettingsStore.getState().settings || {}
        const cfg = resolveProviderConfig(settingsObj)

        if (!cfg.apiKey && cfg.providerType !== 'ollama') {
          setResponse('**Error:** Missing API Key. Please configure it in Settings.')
          setIsGenerating(false)
          return
        }

        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: currentQuery }
        ]

        let fullResponse = ''

        try {
          const provider = AIProviderFactory.createProvider(cfg.providerType, {
            apiKey: cfg.apiKey || '',
            activeModel: cfg.activeModel || undefined,
            baseUrl: cfg.baseUrl
          })

          for await (const chunk of provider.chatStream(messages, {
            signal: controller.signal,
            model: cfg.activeModel || undefined,
            temperature: 0.7
          })) {
            fullResponse += chunk
            setResponse(fullResponse)
          }
        } catch (providerErr: any) {
          if (providerErr?.name === 'AbortError') {
            throw providerErr
          }
          // Fallback to direct DeepSeek fetch if factory call fails
          const endpoint = 'https://api.deepseek.com/chat/completions'
          const apiResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${cfg.apiKey}`
            },
            body: JSON.stringify({
              model: cfg.activeModel || 'deepseek-chat',
              messages,
              temperature: 0.7,
              stream: true
            }),
            signal: controller.signal
          })

          if (!apiResponse.ok) {
            const errData = await apiResponse.json().catch(() => ({}))
            throw new Error(errData.error?.message || `API Error: ${apiResponse.status}`)
          }

          const reader = apiResponse.body?.getReader()
          if (!reader) throw new Error('Failed to read stream')
          const decoder = new TextDecoder('utf-8')

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
                } catch {
                  // Ignore partial SSE lines
                }
              }
            }
          }
        }
      } catch (err: any) {
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
