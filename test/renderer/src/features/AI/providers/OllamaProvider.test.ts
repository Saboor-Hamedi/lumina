import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OllamaProvider, normalizeOllamaUrl } from '../../../../../../src/renderer/src/features/AI/providers/OllamaProvider'

describe('OllamaProvider & normalizeOllamaUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete (window as any).api
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('normalizeOllamaUrl', () => {
    it('normalizes undefined or empty url to IPv4 default', () => {
      expect(normalizeOllamaUrl()).toBe('http://127.0.0.1:11434/api/chat')
      expect(normalizeOllamaUrl('')).toBe('http://127.0.0.1:11434/api/chat')
    })

    it('converts localhost to 127.0.0.1 to avoid Windows IPv6 resolution issues', () => {
      expect(normalizeOllamaUrl('http://localhost:11434')).toBe('http://127.0.0.1:11434/api/chat')
      expect(normalizeOllamaUrl('http://localhost:11434/api/chat')).toBe('http://127.0.0.1:11434/api/chat')
      expect(normalizeOllamaUrl('localhost:11434')).toBe('http://127.0.0.1:11434/api/chat')
    })

    it('preserves custom host/port while ensuring /api/chat endpoint', () => {
      expect(normalizeOllamaUrl('http://192.168.1.100:11434')).toBe('http://192.168.1.100:11434/api/chat')
      expect(normalizeOllamaUrl('http://192.168.1.100:11434/api/chat')).toBe('http://192.168.1.100:11434/api/chat')
    })
  })

  describe('chatStream', () => {
    it('streams tokens when direct fetch succeeds', async () => {
      const chunks = [
        JSON.stringify({ message: { content: 'Hello' }, done: false }),
        JSON.stringify({ message: { content: ' world' }, done: true })
      ]

      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(new TextEncoder().encode(chunk + '\n'))
          }
          controller.close()
        }
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: stream
      })

      const provider = new OllamaProvider({ activeModel: 'phi:latest' })
      const tokens: string[] = []

      for await (const token of provider.chatStream([{ role: 'user', content: 'hi' }])) {
        tokens.push(token)
      }

      expect(tokens.join('')).toBe('Hello world')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:11434/api/chat',
        expect.objectContaining({
          method: 'POST'
        })
      )
    })

    it('falls back to window.api.chatOllama if direct renderer fetch throws (CORS / socket error)', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

      const mockChatOllama = vi.fn().mockResolvedValue({
        ok: true,
        content: 'Response via Main Process IPC fallback'
      })
      ;(window as any).api = { chatOllama: mockChatOllama }

      const provider = new OllamaProvider({ activeModel: 'phi:latest' })
      const tokens: string[] = []

      for await (const token of provider.chatStream([{ role: 'user', content: 'hello' }])) {
        tokens.push(token)
      }

      expect(mockChatOllama).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'phi:latest',
          url: 'http://127.0.0.1:11434/api/chat'
        })
      )
      expect(tokens.join('')).toBe('Response via Main Process IPC fallback')
    })

    it('throws friendly server offline error when both fetch and IPC fail', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      ;(window as any).api = {
        chatOllama: vi.fn().mockResolvedValue({
          ok: false,
          error: 'Ollama server is not running. Please start Ollama on your computer to chat.'
        })
      }

      const provider = new OllamaProvider({ activeModel: 'phi:latest' })

      await expect(async () => {
        for await (const _ of provider.chatStream([{ role: 'user', content: 'test' }])) {
          // consume
        }
      }).rejects.toThrow('Ollama server is not running. Please start Ollama on your computer to chat.')
    })
  })
})
