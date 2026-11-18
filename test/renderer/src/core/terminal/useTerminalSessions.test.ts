import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTerminalSessions } from '../../../../../src/renderer/src/core/terminal/useTerminalSessions'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/SettingStore'

describe('useTerminalSessions', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('uses settings.defaultTerminalShell on fresh launch even if stale localStorage sessions exist', () => {
    localStorage.setItem(
      'lumina_terminal_sessions',
      JSON.stringify([{ id: 'old', name: '1: cmd', shell: 'cmd.exe', cwd: 'C:\\', createdAt: 1 }])
    )
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        defaultTerminalShell: 'C:\\Program Files\\Git\\bin\\bash.exe'
      } as any
    })

    const { result } = renderHook(() => useTerminalSessions())
    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions[0].shell).toBe('C:\\Program Files\\Git\\bin\\bash.exe')
    expect(result.current.sessions[0].name).toBe('1: bash')
  })
})
