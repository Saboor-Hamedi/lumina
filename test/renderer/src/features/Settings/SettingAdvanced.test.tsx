import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SettingAdvanced from '../../../../../src/renderer/src/features/Settings/SettingAdvanced'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/SettingStore'

const baseSettings = () => ({
  graphNodeSize: 1.5,
  graphShowTexts: true,
  graphNodeColor: '#40bafa',
  enableDevTools: true,
  launchOnStartup: false
})

describe('SettingAdvanced', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({ settings: baseSettings() as any })
  })

  const renderAdvanced = async () => {
    let result: ReturnType<typeof render>
    await act(async () => {
      result = render(<SettingAdvanced />)
    })
    return result!
  }

  it('renders advanced header and subtabs', async () => {
    await renderAdvanced()
    expect(screen.getByText('Advanced')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /System & Dev/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Graph/i })).toBeInTheDocument()
  })

  it('switches subtabs when clicked', async () => {
    await renderAdvanced()
    const graphTab = screen.getByRole('tab', { name: /Graph/i })
    fireEvent.click(graphTab)
    expect(graphTab).toHaveClass('active')
  })

  it('renders the graph visualization controls', async () => {
    await renderAdvanced()
    expect(screen.getByText('Graph Visualization')).toBeInTheDocument()
    expect(screen.getByText('Node Size')).toBeInTheDocument()
    expect(screen.getByText('Show Node Texts')).toBeInTheDocument()
  })

  it('toggles Show Node Texts', async () => {
    await renderAdvanced()
    const checkbox = screen
      .getByText('Show Node Texts')
      .closest('.settings-row')
      ?.querySelector('input')
    expect(checkbox).toBeDefined()
    if (checkbox) {
      fireEvent.click(checkbox)
      expect(useSettingsStore.getState().settings.graphShowTexts).toBe(false)
    }
  })

  it('updates graph node color when a swatch is clicked', async () => {
    const { container } = await renderAdvanced()
    const swatches = container.querySelectorAll('.color-picker-row > div')
    // swatch index 2 = #f59e0b
    fireEvent.click(swatches[2])
    expect(useSettingsStore.getState().settings.graphNodeColor).toBe('#f59e0b')
  })

  it('toggles Enable Developer Tools', async () => {
    await renderAdvanced()
    const checkbox = screen
      .getByText('Enable Developer Tools')
      .closest('.settings-row')
      ?.querySelector('input')
    expect(checkbox).toBeDefined()
    if (checkbox) {
      fireEvent.click(checkbox)
      expect(useSettingsStore.getState().settings.enableDevTools).toBe(false)
    }
  })
})
