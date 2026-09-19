import { describe, it, expect, vi, beforeEach } from 'vitest'
import { luminaDiagnoseSystemTool } from '../../../../../../src/renderer/src/features/AI/tools/luminaDiagnoseSystem'
import { detectUserIntent, IntentCategory } from '../../../../../../src/renderer/src/features/AI/services/intentRouter'
import { SLASH_COMMANDS } from '../../../../../../src/renderer/src/features/AI/LuminaSlash'
import { useWorkspaceStore } from '../../../../../../src/renderer/src/core/store/workspaceStore'
import { useSettingsStore } from '../../../../../../src/renderer/src/core/store/SettingStore'

describe('System Self-Diagnostics & Health Verification (luminaDiagnoseSystem)', () => {
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

  it('runs diagnostic check in-memory without creating lumina-health.md on disk by default', async () => {
    const result = await luminaDiagnoseSystemTool.execute({ fullCheck: true, saveToDisk: false })

    expect(result.success).toBe(true)
    expect(result.summary).toContain('Health Check Passed')
    expect(result.summary).toContain('8 systems running smoothly')

    // Confirm that by default saveSnippet was NOT called with lumina-health
    const savedCalls = (window.api.saveSnippet as any).mock.calls
    const healthCall = savedCalls.find((call: any[]) => call[0]?.title === 'lumina-health')
    expect(healthCall).toBeUndefined()

    // Confirm structured result is provided
    const data = result.result as any
    expect(data.checksPassed).toBe(8)
    expect(data.totalNotes).toBe(2)
    expect(data.savedToDisk).toBe(false)
  })

  it('creates lumina-health.md on disk when saveToDisk is explicitly requested', async () => {
    const result = await luminaDiagnoseSystemTool.execute({ fullCheck: true, saveToDisk: true })

    expect(result.success).toBe(true)
    expect(result.summary).toContain('Saved report to lumina-health.md')

    // Confirm window.api.saveSnippet was called targeting lumina-health
    expect(window.api.saveSnippet).toHaveBeenCalled()
    const savedCalls = (window.api.saveSnippet as any).mock.calls
    const healthCall = savedCalls.find((call: any[]) => call[0]?.title === 'lumina-health')
    expect(healthCall).toBeDefined()
    expect(healthCall[0].title).toBe('lumina-health')

    const data = result.result as any
    expect(data.savedToDisk).toBe(true)
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
    expect(doctorCmd?.insertText).toBe('/doctor')

    const mockSetInput = vi.fn()
    doctorCmd?.action(vi.fn(), { setInput: mockSetInput })
    expect(mockSetInput).toHaveBeenCalledWith('/doctor')
  })
})
