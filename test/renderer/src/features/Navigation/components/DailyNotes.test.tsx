import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DailyNotes from '../../../../../../src/renderer/src/features/Navigation/components/DailyNotes'
import { useWorkspaceStore } from '../../../../../../src/renderer/src/core/store/workspaceStore'
import { defaultTemplates } from '../../../../../../src/renderer/src/features/template/hooks/defaultTemplates'

vi.mock('../../../../../../src/renderer/src/features/template/Template', () => ({
  default: ({ isOpen, onClose, templates, onSelectTemplate }: any) =>
    isOpen ? (
      <div data-testid="template-modal">
        <button
          onClick={() =>
            onSelectTemplate(templates[1] || { id: 'blank', title: 'Blank Note', code: '' })
          }
        >
          Choose Template
        </button>
        <button onClick={() => onSelectTemplate({ id: 'blank', title: 'Blank Note', code: '' })}>
          Choose Blank
        </button>
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null
}))

const todayISO = new Date().toISOString().split('T')[0]
const TEMPLATE_COUNT = defaultTemplates.length

describe('DailyNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceStore.setState({
      snippets: [],
      selectedSnippet: null,
      isLoading: false,
      searchQuery: '',
      openTabs: [],
      activeTabId: null,
      pinnedTabIds: []
    } as any)
    global.window.api = {
      ...global.window.api,
      createFolder: vi.fn().mockResolvedValue(true),
      saveSnippet: vi.fn((snip) => Promise.resolve(snip)),
      getSetting: vi.fn().mockResolvedValue(null)
    }
  })

  const clickDaily = () => fireEvent.click(screen.getByRole('button', { name: /Daily/ }))

  it('renders the Daily button', () => {
    render(<DailyNotes />)
    expect(screen.getByRole('button', { name: /Daily/ })).toBeInTheDocument()
  })

  it('opens the template modal on first click without saving template files to disk', async () => {
    render(<DailyNotes />)
    clickDaily()

    expect(await screen.findByTestId('template-modal')).toBeInTheDocument()
    const templateSaves = global.window.api.saveSnippet.mock.calls.filter(
      ([snip]: any) => snip.folderId === 'Templates'
    )
    expect(templateSaves.length).toBe(0)
    expect(global.window.api.createFolder).not.toHaveBeenCalledWith('Templates')
  })

  it('does not create template files on disk when modal opens', async () => {
    render(<DailyNotes />)
    clickDaily()

    await waitFor(() => {
      expect(screen.getByTestId('template-modal')).toBeInTheDocument()
    })
    const templateSaves = global.window.api.saveSnippet.mock.calls.filter(
      ([snip]: any) => snip.folderId === 'Templates'
    )
    expect(templateSaves.length).toBe(0)
  })

  it('creates a titled note when a template is selected', async () => {
    render(<DailyNotes />)
    clickDaily()
    await waitFor(() => screen.getByTestId('template-modal'))

    fireEvent.click(screen.getByRole('button', { name: 'Choose Template' }))

    await waitFor(() => {
      const daily = global.window.api.saveSnippet.mock.calls.find(
        ([snip]: any) => snip.folderId === 'DailyNotes'
      )
      expect(daily).toBeTruthy()
    })
    const daily = (global.window.api.saveSnippet.mock.calls.find(
      ([snip]: any) => snip.folderId === 'DailyNotes'
    ) as any)[0]
    expect(daily.title.startsWith(`${todayISO} - `)).toBe(true)
    expect(daily.code.startsWith(`# ${daily.title}`)).toBe(true)
  })

  it('creates a DailyNotes folder when a template is selected', async () => {
    render(<DailyNotes />)
    clickDaily()
    await waitFor(() => screen.getByTestId('template-modal'))

    fireEvent.click(screen.getByRole('button', { name: 'Choose Template' }))
    await waitFor(() => {
      expect(global.window.api.createFolder).toHaveBeenCalledWith('DailyNotes')
    })
  })

  it('sets the created note as selected after template selection', async () => {
    render(<DailyNotes />)
    clickDaily()
    await waitFor(() => screen.getByTestId('template-modal'))

    fireEvent.click(screen.getByRole('button', { name: 'Choose Template' }))
    await waitFor(() => {
      expect((useWorkspaceStore.getState() as any).selectedSnippet?.folderId).toBe('DailyNotes')
    })
  })

  it('uses "Note" as the title suffix for the blank template', async () => {
    render(<DailyNotes />)
    clickDaily()
    await waitFor(() => screen.getByTestId('template-modal'))

    fireEvent.click(screen.getByRole('button', { name: 'Choose Blank' }))
    await waitFor(() => {
      const daily = global.window.api.saveSnippet.mock.calls.find(
        ([snip]: any) => snip.folderId === 'DailyNotes'
      )
      expect(daily).toBeTruthy()
    })
    const daily = (global.window.api.saveSnippet.mock.calls.find(
      ([snip]: any) => snip.folderId === 'DailyNotes'
    ) as any)[0]
    expect(daily.title).toBe(`${todayISO} - Note`)
  })

  it('closes the modal without creating a note when canceled', async () => {
    render(<DailyNotes />)
    clickDaily()
    await waitFor(() => screen.getByTestId('template-modal'))

    fireEvent.click(screen.getByRole('button', { name: 'Close Modal' }))
    expect(screen.queryByTestId('template-modal')).not.toBeInTheDocument()
    const dailySaves = global.window.api.saveSnippet.mock.calls.filter(
      ([snip]: any) => snip.folderId === 'DailyNotes'
    )
    expect(dailySaves.length).toBe(0)
  })
})
