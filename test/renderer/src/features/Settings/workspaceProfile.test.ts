import { describe, it, expect, beforeEach } from 'vitest'
import {
  normalizeWorkspaceProfileKey,
  getWorkspaceProfile,
  saveWorkspaceProfile,
  removeWorkspaceProfile
} from '../../../../../src/renderer/src/features/Settings/hook/workspaceProfile'

describe('workspaceProfile', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('normalizes Windows and Unix workspace paths consistently', () => {
    expect(normalizeWorkspaceProfileKey('B:\\Notes\\Coding\\')).toBe('b:/notes/coding')
    expect(normalizeWorkspaceProfileKey('b:/notes/coding/')).toBe('b:/notes/coding')
  })

  it('saves, merges, retrieves, and removes per-workspace theme and AI profiles', () => {
    saveWorkspaceProfile('B:\\Vaults\\Coding', { theme: 'tokyo-night', accentColor: '#38bdf8' })
    saveWorkspaceProfile('b:/vaults/coding/', { activeAIMode: 'Execution' })

    const profile = getWorkspaceProfile('B:\\Vaults\\Coding')
    expect(profile).toMatchObject({
      theme: 'tokyo-night',
      accentColor: '#38bdf8',
      activeAIMode: 'Execution'
    })

    removeWorkspaceProfile('B:\\Vaults\\Coding')
    expect(getWorkspaceProfile('B:\\Vaults\\Coding')).toBeNull()
  })
})
