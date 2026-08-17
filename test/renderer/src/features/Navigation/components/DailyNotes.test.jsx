import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DailyNotes from '../../../../../../src/renderer/src/features/Navigation/components/DailyNotes'
import { useVaultStore } from '../../../../../../src/renderer/src/core/store/useVaultStore'
import { defaultTemplates } from '../../../../../../src/renderer/src/features/Navigation/components/defaultTemplates'

vi.mock('../../../../../../src/renderer/src/features/Navigation/components/TemplateModal', () => ({
  default: ({ isOpen, onClose, templates, onSelectTemplate }) =>
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
    useVaultStore.setState({
      snippets: [],
      selectedSnippet: null,
      isLoading: false,
      searchQuery: '',
      dirtySnippetIds: [],
      openTabs: [],
      activeTabId: null,
      pinnedTabIds: []
    })
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

  it('seeds all default templates and opens the modal on first click', async () => {
    render(<DailyNotes />)
    clickDaily()

    await waitFor(() => {
      expect(global.window.api.createFolder).toHaveBeenCalledWith('Templates')
    })
    await waitFor(() => {
      expect(global.window.api.saveSnippet.mock.calls.length).toBeGreaterThan(0)
    })
    const templateSaves = global.window.api.saveSnippet.mock.calls.filter(
      ([snip]) => snip.folderId === 'Templates'
    )
    expect(templateSaves.length).toBe(TEMPLATE_COUNT)
    expect(templateSaves[0][0].language).toBe('markdown')
    expect(screen.getByTestId('template-modal')).toBeInTheDocument()
  })

  it('does not re-seed templates when all are already present', async () => {
    useVaultStore.setState({
      snippets: defaultTemplates.map((t, i) => ({
        id: `tpl-${i}`,
        title: t.title,
        code: t.code,
        folderId: 'Templates',
        timestamp: Date.now()
      }))
    })
    render(<DailyNotes />)
    clickDaily()

    await waitFor(() => {
      expect(screen.getByTestId('template-modal')).toBeInTheDocument()
    })
    const templateSaves = global.window.api.saveSnippet.mock.calls.filter(
      ([snip]) => snip.folderId === 'Templates'
    )
    expect(templateSaves.length).toBe(0)
  })

  it('seeds only the missing templates when the folder is partially populated', async () => {
    useVaultStore.setState({
      snippets: [
        {
          id: 'existing-template',
          title: defaultTemplates[0].title,
          code: '# l',
          folderId: 'Templates',
          timestamp: Date.now()
        }
      ]
    })
    render(<DailyNotes />)
    clickDaily()

    await waitFor(() => {
      expect(screen.getByTestId('template-modal')).toBeInTheDocument()
    })
    const templateSaves = global.window.api.saveSnippet.mock.calls.filter(
      ([snip]) => snip.folderId === 'Templates'
    )
    expect(templateSaves.length).toBe(TEMPLATE_COUNT - 1)
  })

  it('creates a titled note when a template is selected', async () => {
    render(<DailyNotes />)
    clickDaily()
    await waitFor(() => screen.getByTestId('template-modal'))

    fireEvent.click(screen.getByRole('button', { name: 'Choose Template' }))

    await waitFor(() => {
      const daily = global.window.api.saveSnippet.mock.calls.find(
        ([snip]) => snip.folderId === 'DailyNotes'
      )
      expect(daily).toBeTruthy()
    })
    const daily = global.window.api.saveSnippet.mock.calls.find(
      ([snip]) => snip.folderId === 'DailyNotes'
    )[0]
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
      expect(useVaultStore.getState().selectedSnippet?.folderId).toBe('DailyNotes')
    })
  })

  it('uses "Note" as the title suffix for the blank template', async () => {
    render(<DailyNotes />)
    clickDaily()
    await waitFor(() => screen.getByTestId('template-modal'))

    fireEvent.click(screen.getByRole('button', { name: 'Choose Blank' }))
    await waitFor(() => {
      const daily = global.window.api.saveSnippet.mock.calls.find(
        ([snip]) => snip.folderId === 'DailyNotes'
      )
      expect(daily).toBeTruthy()
    })
    const daily = global.window.api.saveSnippet.mock.calls.find(
      ([snip]) => snip.folderId === 'DailyNotes'
    )[0]
    expect(daily.title).toBe(`${todayISO} - Note`)
  })

  it('closes the modal without creating a note when canceled', async () => {
    render(<DailyNotes />)
    clickDaily()
    await waitFor(() => screen.getByTestId('template-modal'))

    fireEvent.click(screen.getByRole('button', { name: 'Close Modal' }))
    expect(screen.queryByTestId('template-modal')).not.toBeInTheDocument()
    const dailySaves = global.window.api.saveSnippet.mock.calls.filter(
      ([snip]) => snip.folderId === 'DailyNotes'
    )
    expect(dailySaves.length).toBe(0)
  })
})
