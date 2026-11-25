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
        inlineMetadata: true
      }
    })
  })

  it('renders the Meta Menu title and description', () => {
    render(<SettingMeta />)
    expect(screen.getByText('Meta Menu')).toBeInTheDocument()
    expect(
      screen.getByText(/Configure the compact note action menu/i)
    ).toBeInTheDocument()
  })

  it('renders Enable Note Menu toggle setting', () => {
    render(<SettingMeta />)
    expect(screen.getByText('Enable Note Menu')).toBeInTheDocument()
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('updates inlineMetadata to false when toggle is unchecked', () => {
    render(<SettingMeta />)
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(useSettingsStore.getState().settings.inlineMetadata).toBe(false)
  })

  it('updates inlineMetadata back to true when toggle is checked', () => {
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        inlineMetadata: false
      }
    })
    render(<SettingMeta />)
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(useSettingsStore.getState().settings.inlineMetadata).toBe(true)
  })
})
