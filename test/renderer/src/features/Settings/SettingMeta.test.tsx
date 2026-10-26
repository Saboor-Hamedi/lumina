import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingMeta from '../../../../../src/renderer/src/features/Settings/SettingMeta'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/SettingStore'

describe('SettingMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        inlineMetadata: true,
        metaPosition: 'bottom'
      }
    })
  })

  it('renders the Meta Bar title and description', () => {
    render(<SettingMeta />)
    expect(screen.getByText('Meta Bar')).toBeInTheDocument()
    expect(
      screen.getByText(/Configure the editor quick action bar/i)
    ).toBeInTheDocument()
  })

  it('renders position selection buttons', () => {
    render(<SettingMeta />)
    expect(screen.getByText('Float Bottom')).toBeInTheDocument()
    expect(screen.getByText('Float Top')).toBeInTheDocument()
    expect(screen.getByText('Inline')).toBeInTheDocument()
  })

  it('updates metaPosition to top when Float Top is clicked', () => {
    render(<SettingMeta />)
    fireEvent.click(screen.getByText('Float Top'))
    expect(useSettingsStore.getState().settings.metaPosition).toBe('top')
  })

  it('updates metaPosition to inline when Inline is clicked', () => {
    render(<SettingMeta />)
    fireEvent.click(screen.getByText('Inline'))
    expect(useSettingsStore.getState().settings.metaPosition).toBe('inline')
  })
})
