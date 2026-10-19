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
    const result: any = await (luminaDiagnoseSystemTool.execute as any)({ fullCheck: true, saveToDisk: false })

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
    const result: any = await (luminaDiagnoseSystemTool.execute as any)({ fullCheck: true, saveToDisk: true })

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
    expect(detectUserIntent('Go run health')).toBe(IntentCategory.DIAGNOSTICS)
    expect(detectUserIntent('run health')).toBe(IntentCategory.DIAGNOSTICS)
    expect(detectUserIntent('/doctor')).toBe(IntentCategory.DIAGNOSTICS)
  })

  it('parses raw diagnostic JSON payload into an interactive health block', async () => {
    const { parseMessageBlocks } = await import('../../../../../../src/renderer/src/features/AI/services/chatMarkdownParser')
    const rawMsg = `I'll run a full diagnostic pass on Lumina right now.\n\n{"status":"healthy","timestamp":"2026-10-18T00:00:00.000Z","checks":[{"name":"App Responsiveness","status":"pass","detail":"IPC round-trip 4ms","durationMs":4},{"name":"Workspace Storage","status":"pass","detail":"Read 2ms, Write 3ms on lumina-health.md","durationMs":5},{"name":"Note Editor","status":"pass","detail":"1 open tab, 0 unsaved changes","durationMs":1},{"name":"Workspace Index","status":"pass","detail":"230 notes, 34 folders indexed","durationMs":12},{"name":"AI Engine","status":"pass","detail":"Model ready, memory loaded","durationMs":2},{"name":"Memory Store","status":"pass","detail":"memory.json readable, 4 items","durationMs":1}],"metrics":{"ipcMs":4,"storageReadMs":2,"storageWriteMs":3,"totalNotes":230,"totalFolders":34,"openTabs":1,"unsavedChanges":0,"memoryItems":4,"memoryFootprintMb":148,"activeModel":"DeepSeek"}}`
    
    const blocks = parseMessageBlocks(rawMsg)
    expect(blocks.some((b) => b.type === 'health')).toBe(true)
    const healthBlock = blocks.find((b) => b.type === 'health')
    expect(healthBlock).toBeDefined()
    expect(healthBlock?.content).toContain('"metrics"')
  })

  it('includes /doctor in SLASH_COMMANDS configured with Activity icon and /doctor insert text', () => {
    const doctorCmd = SLASH_COMMANDS.find((cmd) => cmd.id === 'doctor')
    expect(doctorCmd).toBeDefined()
    expect(doctorCmd?.label).toBe('Doctor')
    expect(doctorCmd?.insertText).toBe('/doctor')

    const mockSetInput = vi.fn()
    doctorCmd?.action?.(vi.fn(), { setInput: mockSetInput })
    expect(mockSetInput).toHaveBeenCalledWith('/doctor')
  })
})
