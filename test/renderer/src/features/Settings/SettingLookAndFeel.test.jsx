import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SettingLookAndFeel from '../../../../../src/renderer/src/features/Settings/SettingLookAndFeel'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/useSettingsStore'

vi.mock('../../../../../src/renderer/src/core/hooks/useFontSettings', () => ({
  useFontSettings: () => ({
    caretWidth: '2px',
    caretColor: '',
    caretStyle: 'smooth',
    updateCaretWidth: vi.fn(),
    updateCaretColor: vi.fn(),
    updateCaretStyle: vi.fn(),
    editorFontFamily: 'Inter',
    editorFontSize: 14,
    updateEditorFontFamily: vi.fn(),
    updateEditorFontSize: vi.fn(),
    themeAccentColor: '',
    updateThemeAccentColor: vi.fn()
  })
}))

const baseSettings = () => ({
  fontFamily: 'Inter',
  fontSize: 14,
  mirrorMode: true,
  translucency: false,
  cursor: { useBorderLeft: true },
  typeSound: false,
  typeSoundVolume: 50,
  autoSave: true,
  inlineMetadata: true
})

describe('SettingLookAndFeel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({ settings: baseSettings() })
  })

  it('renders the Appearance section', () => {
    render(<SettingLookAndFeel />)
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Theme Gallery' })).toBeInTheDocument()
  })

  it('calls onOpenTheme when Theme Gallery is clicked', () => {
    const onOpenTheme = vi.fn()
    render(<SettingLookAndFeel onOpenTheme={onOpenTheme} />)
    fireEvent.click(screen.getByRole('button', { name: 'Theme Gallery' }))
    expect(onOpenTheme).toHaveBeenCalledTimes(1)
  })

  it('renders font controls with the saved values', () => {
    render(<SettingLookAndFeel />)
    expect(screen.getByDisplayValue('Inter (Default)')).toBeInTheDocument()
    expect(screen.getByText('14px')).toBeInTheDocument()
  })

  it('updates fontFamily via the store when changed', () => {
    render(<SettingLookAndFeel />)
    fireEvent.change(screen.getByDisplayValue('Inter (Default)'), {
      target: { value: 'Roboto' }
    })
    expect(useSettingsStore.getState().settings.fontFamily).toBe('Roboto')
  })

  it('renders the Caret & Cursor section', () => {
    render(<SettingLookAndFeel />)
    expect(screen.getByText('Caret & Cursor')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Smooth Line')).toBeInTheDocument()
  })

  it('renders the Interface & Behavior toggles', () => {
    render(<SettingLookAndFeel />)
    expect(screen.getByText('Active Line Left Border')).toBeInTheDocument()
    expect(screen.getByText('Mechanical Keyboard Sound')).toBeInTheDocument()
    expect(screen.getByText('Auto-Save')).toBeInTheDocument()
    expect(screen.getByText('Inline Metadata')).toBeInTheDocument()
  })

  const switchInputFor = (labelText) =>
    screen.getByText(labelText).closest('.settings-row').querySelector('input')

  it('toggles Active Line Left Border in the store', () => {
    render(<SettingLookAndFeel />)
    const checkbox = switchInputFor('Active Line Left Border')
    expect(checkbox.checked).toBe(true)
    fireEvent.click(checkbox)
    expect(useSettingsStore.getState().settings.cursor.useBorderLeft).toBe(false)
  })

  it('toggles Mechanical Keyboard Sound in the store', () => {
    render(<SettingLookAndFeel />)
    const checkbox = switchInputFor('Mechanical Keyboard Sound')
    expect(checkbox.checked).toBe(false)
    fireEvent.click(checkbox)
    expect(useSettingsStore.getState().settings.typeSound).toBe(true)
  })

  it('toggles Auto-Save in the store', () => {
    render(<SettingLookAndFeel />)
    const checkbox = switchInputFor('Auto-Save')
    expect(checkbox.checked).toBe(true)
    fireEvent.click(checkbox)
    expect(useSettingsStore.getState().settings.autoSave).toBe(false)
  })

  it('shows the Typing Volume slider only when typeSound is enabled', () => {
    const { rerender } = render(<SettingLookAndFeel />)
    expect(screen.queryByText('Typing Volume')).not.toBeInTheDocument()

    act(() => {
      useSettingsStore.setState({ settings: { ...baseSettings(), typeSound: true } })
    })
    rerender(<SettingLookAndFeel />)
    expect(screen.getByText('Typing Volume')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('toggles the Active Line Left Border cursor setting', () => {
    render(<SettingLookAndFeel />)
    const checkbox = switchInputFor('Active Line Left Border')
    expect(checkbox.checked).toBe(true)
    fireEvent.click(checkbox)
    expect(useSettingsStore.getState().settings.cursor.useBorderLeft).toBe(false)
  })
})
