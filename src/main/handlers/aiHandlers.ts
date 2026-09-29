import { ipcMain, net } from 'electron'
// @ts-ignore
import { registerOllamaChatStream } from '../lumina/ollamaChatStream'
import { validateIpc, z } from './ipcValidation'

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
const chatPayloadSchema = z.object({
  url: z.string().optional(),
  model: z.string().optional(),
  messages: z.array(z.any()).optional(),
  tools: z.array(z.any()).optional(),
  options: z.record(z.string(), z.any()).optional()
}).passthrough()

export function registerAiHandlers(): void {
  // Query installed models from local Ollama instance with multi-endpoint fallback
  ipcMain.handle('ollama:getModels', async (_, rawUrl) => {
    try {
      const validUrl = validateIpc(getModelsSchema, rawUrl)
      const ollamaFetch = typeof net?.fetch === 'function' ? net.fetch.bind(net) : fetch
      let baseUrl = 'http://127.0.0.1:11434'
      try {
        const parsed = new URL(validUrl || 'http://127.0.0.1:11434')
        const port = parsed.port || '11434'
        const proto = parsed.protocol || 'http:'
        const host = parsed.hostname || '127.0.0.1'
        baseUrl = `${proto}//${host}:${port}`
      } catch {}

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
      let baseUrl = 'http://127.0.0.1:11434'
      try {
        const parsed = new URL(rawUrl || 'http://127.0.0.1:11434')
        const port = parsed.port || '11434'
        const proto = parsed.protocol || 'http:'
        const host = parsed.hostname || '127.0.0.1'
        baseUrl = `${proto}//${host}:${port}`
      } catch {}

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
