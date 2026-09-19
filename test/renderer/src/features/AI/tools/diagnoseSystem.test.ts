import { describe, it, expect, vi, beforeEach } from 'vitest'
import { diagnoseSystemTool } from '../../../../../../src/renderer/src/features/AI/tools/diagnoseSystem'
import { detectUserIntent, IntentCategory } from '../../../../../../src/renderer/src/features/AI/services/intentRouter'
import { SLASH_COMMANDS } from '../../../../../../src/renderer/src/features/AI/LuminaSlash'
import { useWorkspaceStore } from '../../../../../../src/renderer/src/core/store/workspaceStore'
import { useSettingsStore } from '../../../../../../src/renderer/src/core/store/SettingStore'

describe('System Self-Diagnostics & Health Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    let savedSnippetData: any = null

    window.api = {
      getSnippets: vi.fn().mockResolvedValue([]),
      saveSnippet: vi.fn().mockImplementation((snip) => {
        savedSnippetData = { ...snip }
        return Promise.resolve(savedSnippetData)
      }),
      readSnippet: vi.fn().mockImplementation((id) => {
        return Promise.resolve(savedSnippetData || { id, code: 'Verification' })
      }),
      loadMemory: vi.fn().mockResolvedValue({
        user: { name: 'Saboor' },
        preferences: ['concise'],
        facts: ['developer']
      })
    } as any

    useWorkspaceStore.setState({
      notes: [
        { id: 'note-1', title: 'Architecture', code: '# System Design', folderId: '' },
        { id: 'note-2', title: 'Roadmap', code: '# 2026 Goals', folderId: 'Planning' }
      ],
      snippets: [
        { id: 'note-1', title: 'Architecture', code: '# System Design', folderId: '' },
        { id: 'note-2', title: 'Roadmap', code: '# 2026 Goals', folderId: 'Planning' }
      ],
      selectedNote: { id: 'note-1', title: 'Architecture', code: '# System Design', folderId: '' },
      selectedSnippet: { id: 'note-1', title: 'Architecture', code: '# System Design', folderId: '' },
      folders: ['Planning'],
      openTabs: ['note-1'],
      dirtyNoteIds: [],
      saveNote: vi.fn().mockImplementation((note) => {
        return window.api.saveSnippet(note)
      })
    } as any)

    useSettingsStore.setState({
      settings: {
        activeProvider: 'deepseek',
        activeModel: 'deepseek-chat',
        activeAIMode: 'Code'
      }
    } as any)
  })

  it('performs live write-and-read disk verification on lumina-health.md (never .tmp)', async () => {
    const result = await diagnoseSystemTool.execute({ fullCheck: true })

    expect(result.success).toBe(true)
    expect(result.summary).toContain('Health Check Passed')
    expect(result.summary).toContain('lumina-health.md')

    // Confirm window.api.saveSnippet was called targeting lumina-health
    expect(window.api.saveSnippet).toHaveBeenCalled()
    const savedCalls = (window.api.saveSnippet as any).mock.calls
    const healthCall = savedCalls.find((call: any[]) => call[0]?.title === 'lumina-health')
    expect(healthCall).toBeDefined()
    expect(healthCall[0].title).toBe('lumina-health')

    // Confirm write-read verification payload is NOT .tmp
    expect(healthCall[0].title).not.toContain('.tmp')
    expect(healthCall[0].code).not.toContain('.tmp')

    // Confirm window.api.readSnippet verified the written note
    expect(window.api.readSnippet).toHaveBeenCalledWith(healthCall[0].id)

    // Confirm strict vocabulary: contains "Workspace", never "vault"
    const reportText = (result as any).report || ''
    expect(reportText).toContain('Workspace Storage')
    expect(reportText).toContain('Workspace Notes')
    expect(reportText).not.toMatch(/\bvault\b/i)

    // Confirm clean, non-technical user-facing system names
    expect(reportText).toContain('Desktop Core')
    expect(reportText).toContain('Workspace Storage')
    expect(reportText).toContain('Note Editor')
    expect(reportText).toContain('AI Assistant Engine')
    expect(reportText).toContain('Background AI Tasks')
    expect(reportText).toContain('Personalized Memory')
    expect(reportText).toContain('App Performance')

    // Confirm technical developer jargon is strictly absent
    expect(reportText).not.toMatch(/CodeMirror/i)
    expect(reportText).not.toMatch(/Electron IPC/i)
    expect(reportText).not.toMatch(/JS Heap/i)
  })

  it('correctly classifies natural language diagnostic intents and /doctor', () => {
    expect(detectUserIntent('check yourself')).toBe(IntentCategory.DIAGNOSTICS)
    expect(detectUserIntent('run diagnostics')).toBe(IntentCategory.DIAGNOSTICS)
    expect(detectUserIntent('test your health')).toBe(IntentCategory.DIAGNOSTICS)
    expect(detectUserIntent('test health')).toBe(IntentCategory.DIAGNOSTICS)
    expect(detectUserIntent('system health')).toBe(IntentCategory.DIAGNOSTICS)
    expect(detectUserIntent('check health')).toBe(IntentCategory.DIAGNOSTICS)
    expect(detectUserIntent('/doctor')).toBe(IntentCategory.DIAGNOSTICS)
  })

  it('includes /doctor in SLASH_COMMANDS configured with Activity icon and /doctor insert text', () => {
    const doctorCmd = SLASH_COMMANDS.find((cmd) => cmd.id === 'doctor')
    expect(doctorCmd).toBeDefined()
    expect(doctorCmd?.label).toBe('Doctor')
    expect(doctorCmd?.desc).toContain('lumina-health.md')
    expect(doctorCmd?.insertText).toBe('/doctor')

    const mockSetInput = vi.fn()
    doctorCmd?.action(vi.fn(), { setInput: mockSetInput })
    expect(mockSetInput).toHaveBeenCalledWith('/doctor')
  })
})
