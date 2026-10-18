import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../src/main/settings/settingsManager', () => ({
  default: { getAll: () => ({ ollamaUrl: 'http://localhost:11434/api/chat' }) }
}))

import { registerOllamaChatStream } from '../../../src/main/lumina/ollamaChatStream'

function register() {
  const listeners = new Map<string, Function>()
  const ipcMain = { on: (channel: string, fn: Function) => listeners.set(channel, fn) }
  registerOllamaChatStream(ipcMain as never, {} as never)
  return listeners
}

function makeSender(sent: any[]) {
  return {
    isDestroyed: () => false,
    send: (_channel: string, message: any) => sent.push(message),
    once: () => {},
    removeListener: () => {}
  }
}

describe('ollamaChatStream SSRF integration', () => {
  it('registers the streaming listeners', () => {
    const listeners = register()
    expect(listeners.has('ollama:chat-stream')).toBe(true)
    expect(listeners.has('ollama:chat-cancel')).toBe(true)
  })

  it('blocks a cloud-metadata host and reports it as an error, never fetching it', async () => {
    const listeners = register()
    const sent: any[] = []
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    listeners.get('ollama:chat-stream')!(
      { sender: makeSender(sent) },
      { requestId: 'r1', url: 'http://169.254.169.254/latest/meta-data', model: 'x', messages: [] }
    )

    await vi.waitFor(() => {
      expect(sent.some((m) => m.type === 'done')).toBe(true)
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(sent.some((m) => m.type === 'headers' && m.status === 503)).toBe(true)
    const chunk = sent.find((m) => m.type === 'chunk')
    expect(String(chunk?.chunk)).toMatch(/Blocked Ollama host/i)
    fetchSpy.mockRestore()
  })

  it('allows a configured remote host to reach the fetch layer', async () => {
    const listeners = register()
    const sent: any[] = []
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 200 }))

    listeners.get('ollama:chat-stream')!(
      { sender: makeSender(sent) },
      { requestId: 'r2', url: 'http://127.0.0.1:11434', model: 'x', messages: [] }
    )

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/chat')
    fetchSpy.mockRestore()
  })
})
