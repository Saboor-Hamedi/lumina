import { BaseProvider } from './BaseProvider'
import type { ProviderConfig } from '../types/ai.types'
import type { ChatMessageParam, ChatStreamOptions } from './BaseProvider'

interface OllamaToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

function toOllamaTools(tools: Record<string, any> = {}): OllamaToolDefinition[] {
  return Object.entries(tools).flatMap(([name, tool]) => {
    const schema = tool?.inputSchema?.jsonSchema || tool?.inputSchema
    if (!tool?.execute || !schema || typeof schema !== 'object') return []
    return [{
      type: 'function' as const,
      function: {
        name,
        description: tool.description || name,
        parameters: schema as Record<string, unknown>
      }
    }]
  })
}

function serializeToolResult(result: unknown): string {
  try {
    if (typeof result === 'string') return result.slice(0, 12000)
    if (result && typeof result === 'object') {
      const compact = { ...(result as Record<string, unknown>) }
      // The model already authored the file body; returning it in the tool result
      // wastes local context and can make subsequent Ollama calls very slow.
      delete compact.writtenContent
      return JSON.stringify(compact).slice(0, 12000)
    }
    return JSON.stringify(result) || String(result)
  } catch {
    return String(result)
  }
}

/** Turn the app's request-scoped IPC events into a renderer ReadableStream. */
function createIpcOllamaResponse(api: any, payload: Record<string, any>, signal?: AbortSignal): Promise<Response> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const encoder = new TextEncoder()
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null
    let responseCreated = false
    let unsubscribe = () => {}
    let abortHandler: (() => void) | null = null

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller
      },
      cancel() {
        unsubscribe()
        api.cancelOllamaChat?.(requestId)
      }
    })

    const cleanup = () => {
      unsubscribe()
      if (abortHandler) signal?.removeEventListener('abort', abortHandler)
    }

    unsubscribe = api.onOllamaChatEvent((event: any) => {
      if (event?.requestId !== requestId) return

      if (event.type === 'headers' && !responseCreated) {
        responseCreated = true
        resolve(new Response(stream, { status: event.status || 200 }))
        return
      }
      if (event.type === 'chunk' && typeof event.chunk === 'string') {
        try {
          streamController?.enqueue(encoder.encode(event.chunk))
        } catch (_) {}
        return
      }
      if (event.type === 'done') {
        cleanup()
        try {
          streamController?.close()
        } catch (_) {}
      }
    })

    abortHandler = () => {
      cleanup()
      api.cancelOllamaChat?.(requestId)
      const error = new DOMException('The Ollama request was aborted.', 'AbortError')
      if (!responseCreated) reject(error)
      else {
        try {
          streamController?.error(error)
        } catch (_) {}
      }
    }
    if (signal?.aborted) {
      abortHandler()
      return
    }
    signal?.addEventListener('abort', abortHandler, { once: true })

    Promise.resolve(api.startOllamaChat({ ...payload, requestId })).catch((error: any) => {
      cleanup()
      if (!responseCreated) reject(error)
      else streamController?.error(error)
    })
  })
}

/**
 * Normalizes Ollama endpoint URLs to ensure they use IPv4 (127.0.0.1)
 * to avoid Windows IPv6 localhost ([::1]) binding issues, and targets the `/api/chat` endpoint.
 */
export function normalizeOllamaUrl(rawUrl?: string): string {
  if (!rawUrl) return 'http://127.0.0.1:11434/api/chat'
  let urlStr = rawUrl.trim()
  if (!urlStr) return 'http://127.0.0.1:11434/api/chat'

  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    urlStr = `http://${urlStr}`
  }

  // Replace localhost with 127.0.0.1 to avoid Windows IPv6 [::1] connection refused
  urlStr = urlStr.replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://127.0.0.1')
  urlStr = urlStr.replace(/^https:\/\/localhost(?=[:/]|$)/i, 'https://127.0.0.1')

  try {
    const parsed = new URL(urlStr)
    const host = parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname
    const port = parsed.port || '11434'
    let pathname = parsed.pathname
    if (!pathname || pathname === '/' || pathname === '') {
      pathname = '/api/chat'
    } else if (!pathname.endsWith('/api/chat')) {
      pathname = pathname.replace(/\/+$/, '') + '/api/chat'
    }
    return `${parsed.protocol}//${host}:${port}${pathname}`
  } catch {
    return 'http://127.0.0.1:11434/api/chat'
  }
}

/**
 * Ollama Provider.
 * Streams chat completions locally using Ollama's /api/chat NDJSON endpoint,
 * with automatic IPv4 normalization and Electron Main Process IPC fallback.
 */
export class OllamaProvider extends BaseProvider {
  constructor(config: ProviderConfig = {}) {
    super(config)
    this.baseUrl = normalizeOllamaUrl(config.baseUrl)
    this.defaultModel = config.activeModel || (config as any).model || 'llama3'
    this.id = 'ollama'
    this.name = 'Ollama (Local)'
  }

  async *chatStream(
    messages: ChatMessageParam[],
    options: ChatStreamOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const targetModel = options.model || this.defaultModel
    const chatUrl = normalizeOllamaUrl(this.baseUrl)
    const toolMap = (options.tools || {}) as Record<string, any>
    const ollamaTools = toOllamaTools(toolMap)
    const conversation = messages.map((message) => ({ ...message })) as Array<Record<string, any>>
    const maxToolRounds = ollamaTools.length > 0 ? 12 : 0

    for (let round = 0; round <= maxToolRounds; round++) {
      if (options.signal?.aborted) return

      let response: Response | null = null
      const api = (window as any)?.api
      const useElectronBridge = typeof api?.chatOllama === 'function'
      let rendererConnectionError = ''

      // Electron's document CSP deliberately excludes localhost. Use IPC in
      // desktop builds and keep renderer streaming for browser/dev contexts.
      if (!useElectronBridge) {
        try {
          response = await fetch(chatUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: targetModel,
              messages: conversation,
              tools: ollamaTools.length ? ollamaTools : undefined,
              stream: true,
              options: {
                temperature: options.temperature ?? 0.7,
                num_predict: options.max_tokens || 4096
              }
            }),
            signal: options.signal
          })
        } catch (err: any) {
          if (err?.name === 'AbortError') throw err
          rendererConnectionError = err?.message || String(err)
        }
      } else if (typeof api?.startOllamaChat === 'function' && typeof api?.onOllamaChatEvent === 'function') {
        response = await createIpcOllamaResponse(api, {
          url: chatUrl,
          model: targetModel,
          messages: conversation,
          tools: ollamaTools.length ? ollamaTools : undefined,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.max_tokens || 4096
          }
        }, options.signal)
      }

      let assistantMessage: Record<string, any> = { role: 'assistant', content: '' }

      // Electron IPC bypasses Ollama's renderer CORS restrictions. It returns the
      // final message, including tool_calls, so the same agent loop works there.
      if (!response && useElectronBridge) {
        const request = {
          url: chatUrl,
          model: targetModel,
          messages: conversation,
          tools: ollamaTools.length ? ollamaTools : undefined,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.max_tokens || 4096
          }
        }
        let ipcRes = await api.chatOllama(request)
        if (options.signal?.aborted) return
        const toolSupportError = /(?:does not support|doesn't support|unsupported|not supported)[^\n]*tools/i.test(
          ipcRes?.error || ''
        )
        if (!ipcRes?.ok && ollamaTools.length > 0 && toolSupportError) {
          // Older/smaller Ollama models reject the tools field at the API layer.
          // Retry as plain chat; the system prompt supplies an equivalent
          // createFile/createFolder text format that the caller already parses.
          ipcRes = await api.chatOllama({ ...request, tools: undefined })
          if (options.signal?.aborted) return
        }
        if (!ipcRes?.ok) {
          throw new Error(ipcRes?.error || 'Unable to connect to the Ollama server.')
        }
        assistantMessage = ipcRes.message || { role: 'assistant', content: ipcRes.content || '' }
        if (assistantMessage.content) yield assistantMessage.content
      } else {
        if (!response) {
          throw new Error(`Unable to connect to Ollama at ${chatUrl}. ${rendererConnectionError || 'Check that Ollama is running and the server URL is correct.'}`)
        }
        if (!response.ok) {
          const detail = (await response.text().catch(() => '')).slice(0, 800)
          const modelRejectsTools = /(?:does not support|doesn't support|unsupported|not supported)[^\n]*tools/i.test(detail)
          if (response.status === 400 && ollamaTools.length > 0 && modelRejectsTools) {
            const retryPayload = {
              url: chatUrl,
              model: targetModel,
              messages: conversation,
              tools: undefined,
              options: {
                temperature: options.temperature ?? 0.7,
                num_predict: options.max_tokens || 4096
              }
            }
            response = useElectronBridge && typeof api?.startOllamaChat === 'function'
              ? await createIpcOllamaResponse(api, retryPayload, options.signal)
              : await fetch(chatUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...retryPayload, stream: true }),
                  signal: options.signal
                })
          } else if (response.status === 404) {
            throw new Error(
              `Model "${targetModel}" was not found in Ollama. Pull it in terminal with "ollama pull ${targetModel}" or select an installed model in Settings.`
            )
          } else {
            throw new Error(`Ollama request failed (${response.status})${detail ? `: ${detail}` : ''}`)
          }
          if (!response.ok) {
            const retryDetail = (await response.text().catch(() => '')).slice(0, 800)
            throw new Error(`Ollama request failed (${response.status})${retryDetail ? `: ${retryDetail}` : ''}`)
          }
        }
        if (!response.body) throw new Error('Response body is null')

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        const consumeLine = (line: string): { done: boolean; content: string } => {
          const trimmed = line.trim()
          if (!trimmed) return { done: false, content: '' }
          try {
            const parsed = JSON.parse(trimmed)
            const message = parsed.message || {}
            if (message.content) {
              assistantMessage.content += message.content
            }
            if (message.tool_calls) {
              const accumulated = assistantMessage.tool_calls || []
              message.tool_calls.forEach((call: any, index: number) => {
                const previous = accumulated[index] || {}
                const previousArgs = previous.function?.arguments
                const nextArgs = call.function?.arguments
                const mergedArgs =
                  typeof previousArgs === 'string' && typeof nextArgs === 'string'
                    ? previousArgs + nextArgs
                    : nextArgs ?? previousArgs
                accumulated[index] = {
                  ...previous,
                  ...call,
                  function: {
                    ...previous.function,
                    ...call.function,
                    arguments: mergedArgs
                  }
                }
              })
              assistantMessage.tool_calls = accumulated
            }
            return { done: Boolean(parsed.done), content: message.content || '' }
          } catch (error) {
            console.warn('Ollama parse error:', error)
            return { done: false, content: '' }
          }
        }

        try {
          let done = false
          while (!done) {
            const { done: streamDone, value } = await reader.read()
            if (streamDone) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              const event = consumeLine(line)
              if (event.content) yield event.content
              if (event.done) {
                done = true
                break
              }
            }
          }
          if (buffer.trim()) {
            const event = consumeLine(buffer)
            if (event.content) yield event.content
          }
        } finally {
          reader.releaseLock()
        }
      }

      const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : []
      if (toolCalls.length === 0) return
      if (round === maxToolRounds) {
        throw new Error('Ollama reached the workspace tool-call limit for this response.')
      }

      conversation.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        tool_calls: toolCalls
      })

      for (const call of toolCalls) {
        if (options.signal?.aborted) return
        const functionCall = call?.function || {}
        const toolName = functionCall.name
        const tool = toolMap[toolName]
        let result: unknown

        try {
          let args = functionCall.arguments || {}
          if (typeof args === 'string') args = JSON.parse(args)
          if (!tool?.execute) {
            result = { success: false, error: `Tool "${toolName}" is unavailable.` }
          } else {
            ;(options as any).onToolActivity?.(toolName, args, null)
            result = await tool.execute(args)
            ;(options as any).onToolActivity?.(toolName, args, result)
          }
        } catch (error: any) {
          result = { success: false, error: error?.message || 'Tool execution failed.' }
          ;(options as any).onToolActivity?.(toolName, functionCall.arguments || {}, result)
        }

        conversation.push({
          role: 'tool',
          tool_name: toolName,
          content: serializeToolResult(result)
        })
      }
    }
  }
}
