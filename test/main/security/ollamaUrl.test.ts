import { describe, it, expect, vi, beforeEach } from 'vitest'

const getAllMock = vi.fn()

vi.mock('../../../src/main/settings/settingsManager', () => ({
  default: { getAll: (...args: unknown[]) => getAllMock(...args) }
}))

import { resolveAllowedOllamaUrl } from '../../../src/main/security/ollamaUrl'

const LOCAL = { ollamaUrl: 'http://localhost:11434/api/chat' }

describe('resolveAllowedOllamaUrl', () => {
  beforeEach(() => {
    getAllMock.mockReset()
    getAllMock.mockReturnValue(LOCAL)
  })

  it('allows loopback hosts', () => {
    expect(resolveAllowedOllamaUrl('http://127.0.0.1:11434')).toBe('http://127.0.0.1:11434')
    expect(resolveAllowedOllamaUrl('http://localhost:11434')).toBe('http://localhost:11434')
    expect(resolveAllowedOllamaUrl('http://127.0.0.1:11434/api/chat')).toBe('http://127.0.0.1:11434')
    expect(resolveAllowedOllamaUrl('http://[::1]:11434/api/tags')).toBe('http://[::1]:11434')
  })

  it('falls back to the configured URL, then loopback', () => {
    expect(resolveAllowedOllamaUrl()).toBe('http://localhost:11434')
    expect(resolveAllowedOllamaUrl(undefined)).toBe('http://localhost:11434')

    getAllMock.mockReturnValue({ ollamaUrl: 'http://gpu-box.local:8080/api/chat' })
    expect(resolveAllowedOllamaUrl()).toBe('http://gpu-box.local:8080')

    getAllMock.mockReturnValue({ ollamaUrl: undefined })
    expect(resolveAllowedOllamaUrl()).toBe('http://127.0.0.1:11434')
  })

  it('normalizes to protocol//host:port', () => {
    expect(resolveAllowedOllamaUrl('https://127.0.0.1:9999/api/chat')).toBe('https://127.0.0.1:9999')
  })

  it('rejects non-http(s) protocols', () => {
    expect(() => resolveAllowedOllamaUrl('file:///etc/passwd')).toThrow(/protocol/i)
    expect(() => resolveAllowedOllamaUrl('ftp://127.0.0.1:21')).toThrow(/protocol/i)
  })

  it('blocks arbitrary remote hosts (SSRF)', () => {
    expect(() => resolveAllowedOllamaUrl('http://169.254.169.254/latest/meta-data')).toThrow(
      /Blocked Ollama host/i
    )
    expect(() => resolveAllowedOllamaUrl('http://evil.example.com:11434')).toThrow(
      /Blocked Ollama host/i
    )
    expect(() => resolveAllowedOllamaUrl('http://127.0.0.1.evil.com:11434')).toThrow(
      /Blocked Ollama host/i
    )
  })

  it('allows the host configured in settings', () => {
    getAllMock.mockReturnValue({ ollamaUrl: 'http://gpu-box.local:11434/api/chat' })
    expect(resolveAllowedOllamaUrl('http://gpu-box.local:11434')).toBe('http://gpu-box.local:11434')
  })

  it('still blocks other hosts when a remote host is configured', () => {
    getAllMock.mockReturnValue({ ollamaUrl: 'http://gpu-box.local:11434/api/chat' })
    expect(() => resolveAllowedOllamaUrl('http://169.254.169.254')).toThrow(/Blocked Ollama host/i)
  })

  it('accepts a scheme-less configured remote host (matches renderer normalization)', () => {
    getAllMock.mockReturnValue({ ollamaUrl: '  gpu-box.local:11434  ' })
    expect(resolveAllowedOllamaUrl('http://gpu-box.local:11434/api/chat')).toBe(
      'http://gpu-box.local:11434'
    )
    expect(resolveAllowedOllamaUrl()).toBe('http://gpu-box.local:11434')
    expect(() => resolveAllowedOllamaUrl('http://other-box.local:11434')).toThrow(
      /Blocked Ollama host/i
    )
  })

  it('tolerates unreadable settings', () => {
    getAllMock.mockImplementation(() => {
      throw new Error('settings not ready')
    })
    expect(resolveAllowedOllamaUrl('http://127.0.0.1:11434')).toBe('http://127.0.0.1:11434')
    expect(() => resolveAllowedOllamaUrl('http://remote.example.com')).toThrow(/Blocked Ollama host/i)
  })

  it('throws on an invalid URL', () => {
    expect(() => resolveAllowedOllamaUrl('not a url')).toThrow()
  })
})
