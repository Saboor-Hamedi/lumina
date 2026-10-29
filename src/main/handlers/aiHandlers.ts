import { ipcMain, net } from 'electron'
// @ts-ignore
import { registerOllamaChatStream } from '../lumina/ollamaChatStream'
import { validateIpc, z } from './ipcValidation'
import { resolveAllowedOllamaUrl } from '../security/ollamaUrl'

/**
 * ============================================================================
 * Local AI & Ollama IPC Handlers
 * ============================================================================
 * 
 * Manages direct communication between the UI and local Ollama daemon:
 * - `ollama:getModels`: Auto-detects installed models across IPv4 (127.0.0.1)
 *   and localhost to prevent browser CORS and IPv6 resolution mismatches.
 * - `ollama:chat`: Non-streaming Ollama chat completions.
 * - `registerOllamaChatStream`: NDJSON streaming transport for real-time tokens.
 */

const getModelsSchema = z.string().optional()
const cloudModelsSchema = z.object({
  provider: z.enum(['deepseek', 'openai', 'anthropic']),
  apiKey: z.string().min(1).max(4096)
})
const chatPayloadSchema = z.object({
  url: z.string().optional(),
  model: z.string().optional(),
  messages: z.array(z.any()).optional(),
  tools: z.array(z.any()).optional(),
  options: z.record(z.string(), z.any()).optional()
}).passthrough()

export function registerAiHandlers(): void {
  // Discover model IDs from fixed first-party endpoints. API keys are only
  // forwarded to the selected provider and are never persisted or logged here.
  ipcMain.handle('ai:listModels', async (_, payload) => {
    try {
      const { provider, apiKey } = validateIpc(cloudModelsSchema, payload)
      const endpoints = {
        deepseek: 'https://api.deepseek.com/models',
        openai: 'https://api.openai.com/v1/models',
        anthropic: 'https://api.anthropic.com/v1/models?limit=1000'
      }
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (provider === 'anthropic') {
        headers['x-api-key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
      } else {
        headers.Authorization = `Bearer ${apiKey}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 12000)
      try {
        const providerFetch = typeof net?.fetch === 'function' ? net.fetch.bind(net) : fetch
        const rows: any[] = []
        let nextUrl: string | null = endpoints[provider]
        let page = 0
        while (nextUrl && page < 10) {
          const response = await providerFetch(nextUrl, {
            method: 'GET', headers, signal: controller.signal
          })
          if (!response.ok) {
            const detail = (await response.text().catch(() => '')).slice(0, 700)
            return { ok: false, error: `Provider returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`, models: [] }
          }
          const body = await response.json() as any
          const pageRows = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : []
          rows.push(...pageRows)
          page += 1
          nextUrl = provider === 'anthropic' && body?.has_more && body?.last_id
            ? `https://api.anthropic.com/v1/models?limit=1000&after_id=${encodeURIComponent(body.last_id)}`
            : null
        }
        const models = rows.flatMap((item: any) => {
          const id = typeof item === 'string' ? item : item?.id || item?.model
          if (!id || typeof id !== 'string') return []
          // OpenAI's endpoint also returns image, speech, embedding, and other
          // non-chat models. Keep this picker limited to conversational models.
          if (provider === 'openai' && !/^(?:ft:)?(?:gpt-|o\d)/i.test(id)) return []
          if (provider === 'openai' && /(?:image|audio|realtime|transcri|tts|embed|moderation|deep-research)/i.test(id)) return []
          return [{ id, name: typeof item?.display_name === 'string' ? item.display_name : typeof item?.name === 'string' ? item.name : id }]
        })
        return { ok: true, models }
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to discover provider models', models: [] }
    }
  })

  // Query installed models from local Ollama instance with multi-endpoint fallback
  ipcMain.handle('ollama:getModels', async (_, rawUrl) => {
    try {
      const validUrl = validateIpc(getModelsSchema, rawUrl)
      const ollamaFetch = typeof net?.fetch === 'function' ? net.fetch.bind(net) : fetch
      const baseUrl = resolveAllowedOllamaUrl(validUrl)

      const parsedUrl = new URL(baseUrl)
      const port = parsedUrl.port || '11434'
      const proto = parsedUrl.protocol || 'http:'

      const endpoints = [
        `${baseUrl}/api/tags`,
        `${proto}//127.0.0.1:${port}/api/tags`,
        `${proto}//localhost:${port}/api/tags`
      ]
      const uniqueEndpoints = [...new Set(endpoints)]

      for (const endpoint of uniqueEndpoints) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 2500)
          const res = await ollamaFetch(endpoint, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal
          })
          clearTimeout(timeoutId)
          if (res.ok) {
            const data = (await res.json()) as any
            const models = Array.isArray(data?.models) ? data.models : []
            const names = models
              .map((m: any) => (typeof m === 'string' ? m : m.name || m.model))
              .filter(Boolean)
            return { ok: true, models: names }
          }
        } catch (_) {}
      }
      return { ok: false, error: 'Ollama is offline or unreachable', models: [] }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to query Ollama', models: [] }
    }
  })

  // Direct IPC Ollama Chat (Zero-CORS, reliable localhost/127.0.0.1 fallback)
  ipcMain.handle('ollama:chat', async (_, payload) => {
    try {
      const validPayload = validateIpc(chatPayloadSchema, payload || {})
      const ollamaFetch = typeof net?.fetch === 'function' ? net.fetch.bind(net) : fetch
      const { url: rawUrl, model, messages, tools, options } = validPayload
      const baseUrl = resolveAllowedOllamaUrl(rawUrl)

      const parsedUrl = new URL(baseUrl)
      const port = parsedUrl.port || '11434'
      const proto = parsedUrl.protocol || 'http:'

      const endpoints = [
        `${baseUrl}/api/chat`,
        `${proto}//127.0.0.1:${port}/api/chat`,
        `${proto}//localhost:${port}/api/chat`
      ]
      const uniqueEndpoints = [...new Set(endpoints)]

      let lastConnectionError = ''
      for (const endpoint of uniqueEndpoints) {
        try {
          const res = await ollamaFetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            body: JSON.stringify({
              model: model || 'llama3',
              messages: messages || [],
              tools: Array.isArray(tools) && tools.length ? tools : undefined,
              stream: false,
              options: options || {}
            })
          })
          if (res.ok) {
            const data = (await res.json()) as any
            return {
              ok: true,
              content: data?.message?.content || '',
              message: data?.message || { role: 'assistant', content: '' }
            }
          }
          const responseText = (await res.text().catch(() => '')).slice(0, 1200)
          if (res.status === 404 && /model/i.test(responseText)) {
            return {
              ok: false,
              error: `Model "${model}" was not found in Ollama. Pull it in terminal with "ollama pull ${model}" or select an installed model in Settings.`
            }
          }
          return {
            ok: false,
            error: `Ollama returned HTTP ${res.status}${responseText ? `: ${responseText}` : ''}`
          }
        } catch (error: any) {
          lastConnectionError = error?.message || String(error)
        }
      }
      return {
        ok: false,
        error: `Unable to connect to Ollama at ${baseUrl}. ${lastConnectionError || 'Check that Ollama is running and the server URL is correct.'}`
      }
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to communicate with Ollama' }
    }
  })

  // Register NDJSON streaming transport handlers
  registerOllamaChatStream(ipcMain, net)
}
