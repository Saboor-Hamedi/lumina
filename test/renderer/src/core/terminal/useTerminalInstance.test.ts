import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTerminalInstance, createElectronPtyTransport } from '../../../../../src/renderer/src/core/terminal/useTerminalInstance'

describe('createElectronPtyTransport fallback', () => {
  it('creates a headless mock transport when window.api is missing', () => {
    const transport = createElectronPtyTransport({
      id: 'sess_1',
      name: 'Test Terminal',
      shell: 'cmd.exe',
      cwd: 'C:\\test',
      status: 'idle',
      createdAt: Date.now()
    })

    expect(transport).toBeDefined()
    expect(typeof transport.write).toBe('function')
    expect(typeof transport.onData).toBe('function')

    const dataSpy = vi.fn()
    transport.onData(dataSpy)

    // Simulating Enter in mock
    transport.write('\r')
    expect(dataSpy).toHaveBeenCalledWith('\r\n$ ')
  })
})
