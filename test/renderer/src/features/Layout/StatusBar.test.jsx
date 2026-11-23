import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import StatusBar from '../../../../../src/renderer/src/features/Layout/StatusBar'
import { useWorkspaceStore } from '../../../../../src/renderer/src/core/store/workspaceStore'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/SettingStore'

describe('StatusBar.jsx', () => {
  const defaultProps = () => ({
    onToggleInspector: vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceStore.setState({ selectedSnippet: null })
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, statusBarItems: null }
    }))
  })

  it('renders only Settings on the left and omits redundant buttons', () => {
    render(<StatusBar {...defaultProps()} />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.queryByText('Details')).not.toBeInTheDocument()
    expect(screen.queryByText('Canvas')).not.toBeInTheDocument()
    expect(screen.queryByText('Docs')).not.toBeInTheDocument()
    expect(screen.queryByText('Guide')).not.toBeInTheDocument()
    expect(screen.queryByText('Shortcuts')).not.toBeInTheDocument()
  })

  it('toggles settings dropdown when Settings button is clicked', () => {
    const props = {
      ...defaultProps(),
      onSettingsClick: vi.fn(),
      onThemeClick: vi.fn()
    }
    render(<StatusBar {...props} />)
    const settingsBtn = screen.getByTestId('status-bar-settings-btn')
    fireEvent.click(settingsBtn)
    expect(screen.getByRole('button', { name: /Theme/i })).toBeInTheDocument()
  })

  it('renders document statistics when a snippet is selected without reading time or Markdown', () => {
    const note = {
      id: '1',
      title: 'Note',
      code: 'Hello world this is a test note'
    }
    useWorkspaceStore.setState({
      selectedNote: note,
      selectedSnippet: note
    })

    render(<StatusBar {...defaultProps()} />)
    expect(screen.getByText(/Ln 1, Col 1/)).toBeInTheDocument()
    expect(screen.getByText(/7 words/)).toBeInTheDocument()
    expect(screen.getByText(/31 chars/)).toBeInTheDocument()
    expect(screen.queryByText(/min read/)).not.toBeInTheDocument()
    expect(screen.queryByText('Markdown')).not.toBeInTheDocument()
    expect(screen.getByText('UTF-8')).toBeInTheDocument()
  })

  it('does NOT render Drive Synced in the status bar', () => {
    useWorkspaceStore.setState({
      selectedSnippet: {
        id: '1',
        title: 'Note',
        code: 'Sample'
      }
    })

    render(<StatusBar {...defaultProps()} />)
    expect(screen.queryByText(/Drive Synced/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Drive$/i)).not.toBeInTheDocument()
  })

  describe('right-click toggle menu', () => {
    it('opens a rich menu with sections and toggleable items', () => {
      render(<StatusBar {...defaultProps()} />)
      fireEvent.contextMenu(screen.getByTestId('status-bar'))

      expect(screen.getByText('Status Bar')).toBeInTheDocument()
      expect(screen.queryByText('Editor Mode')).not.toBeInTheDocument()
      expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument()
      expect(screen.queryByText('Reading Time')).not.toBeInTheDocument()
      expect(screen.queryByText('Language Mode')).not.toBeInTheDocument()
      expect(screen.getByText('Word Count')).toBeInTheDocument()
      expect(screen.queryByText('Reset to Defaults')).not.toBeInTheDocument()
    })

    it('toggles an item off and persists the value to settings', () => {
      render(<StatusBar {...defaultProps()} />)
      fireEvent.contextMenu(screen.getByTestId('status-bar'))
      fireEvent.click(screen.getByText('Word Count'))

      expect(useSettingsStore.getState().settings.statusBarItems).toEqual({ words: false })
    })

    it('hides a metric from the bar when toggled off', () => {
      useWorkspaceStore.setState({
        selectedSnippet: { id: '1', title: 'Note', code: 'Hello world this is a test note' }
      })

      render(<StatusBar {...defaultProps()} />)
      expect(screen.getByText(/7 words/)).toBeInTheDocument()

      fireEvent.contextMenu(screen.getByTestId('status-bar'))
      fireEvent.click(screen.getByText('Word Count'))

      expect(screen.queryByText(/7 words/)).not.toBeInTheDocument()
    })

    it('hides an element that a saved preference turned off', () => {
      useSettingsStore.setState((state) => ({
        settings: { ...state.settings, statusBarItems: { account: false } }
      }))

      render(<StatusBar {...defaultProps()} />)
      expect(screen.queryByText('Settings')).not.toBeInTheDocument()
    })

    it('toggles an item back on and appears in the status bar', () => {
      useWorkspaceStore.setState({
        selectedSnippet: { id: '1', title: 'Note', code: 'Hello world this is a test note' }
      })
      useSettingsStore.setState((state) => ({
        settings: { ...state.settings, statusBarItems: { words: false, encoding: false } }
      }))

      render(<StatusBar {...defaultProps()} />)
      expect(screen.queryByText(/words/)).not.toBeInTheDocument()
      expect(screen.queryByText('UTF-8')).not.toBeInTheDocument()

      fireEvent.contextMenu(screen.getByTestId('status-bar'))
      fireEvent.click(screen.getByText('Word Count'))
      fireEvent.click(screen.getByText('Encoding'))

      expect(useSettingsStore.getState().settings.statusBarItems.words).toBe(true)
      expect(useSettingsStore.getState().settings.statusBarItems.encoding).toBe(true)
      expect(screen.getByText(/7 words/)).toBeInTheDocument()
      expect(screen.getByText('UTF-8')).toBeInTheDocument()
    })
  })
})
