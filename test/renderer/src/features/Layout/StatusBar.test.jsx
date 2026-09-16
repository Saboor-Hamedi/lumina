import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import StatusBar from '../../../../../src/renderer/src/features/Layout/StatusBar'
import { useWorkspaceStore } from '../../../../../src/renderer/src/core/store/workspaceStore'

describe('StatusBar.jsx', () => {
  const defaultProps = () => ({
    onToggleInspector: vi.fn(),
    onDocsClick: vi.fn(),
    onShortcutsClick: vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceStore.setState({ selectedSnippet: null })
  })

  it('renders left utility buttons', () => {
    render(<StatusBar {...defaultProps()} />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Details')).toBeInTheDocument()
    expect(screen.getByText('Docs')).toBeInTheDocument()
    expect(screen.getByText('Guide')).toBeInTheDocument()
    expect(screen.getByText('Shortcuts')).toBeInTheDocument()
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

  it('calls onToggleInspector when Details button is clicked', () => {
    const props = defaultProps()
    render(<StatusBar {...props} />)
    fireEvent.click(screen.getByText('Details'))
    expect(props.onToggleInspector).toHaveBeenCalled()
  })

  it('calls onDocsClick when Docs button is clicked', () => {
    const props = defaultProps()
    render(<StatusBar {...props} />)
    fireEvent.click(screen.getByText('Docs'))
    expect(props.onDocsClick).toHaveBeenCalled()
  })

  it('calls onShortcutsClick when Shortcuts button is clicked', () => {
    const props = defaultProps()
    render(<StatusBar {...props} />)
    fireEvent.click(screen.getByText('Shortcuts'))
    expect(props.onShortcutsClick).toHaveBeenCalled()
  })

  it('renders document statistics when a snippet is selected', () => {
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
    expect(screen.getByText(/1 min read/)).toBeInTheDocument()
    expect(screen.getByText('Markdown')).toBeInTheDocument()
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
})
