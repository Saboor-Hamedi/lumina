import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ShortcutRenameBox, { normalizeCombo, findConflict, getMainKey } from '../../../../../src/renderer/src/core/shortcuts/components/ShortcutRenameBox'

describe('ShortcutRenameBox.tsx', () => {
  it('normalizes semicolon key combos accurately', () => {
    expect(normalizeCombo('Ctrl + Shift + ;')).toBe('ctrl+shift+;')
    expect(normalizeCombo('Ctrl + Shift + :')).toBe('ctrl+shift+;')
  })

  it('extracts semicolon and colon as semicolon key', () => {
    expect(getMainKey({ key: ';', code: 'Semicolon' } as any)).toBe(';')
    expect(getMainKey({ key: ':', code: 'Semicolon' } as any)).toBe(';')
  })

  it('detects conflicts for existing canvas shortcut', () => {
    const isConflict = findConflict('Ctrl + Shift + ;', 'otherId', [
      { id: 'canvasDrawer', label: 'Spatial Canvas', defaultKey: 'Ctrl + Shift + ;' } as any
    ])
    expect(isConflict).toBe(true)
  })

  it('differentiates Alt+G (Local Graph) from Ctrl+G (Graph View)', () => {
    expect(normalizeCombo('Alt + G')).toBe('alt+g')
    expect(normalizeCombo('Ctrl + G')).toBe('ctrl+g')
    // Alt + G does not conflict with Graph View (Ctrl + G)
    expect(findConflict('Alt + G', 'localGraph')).toBe(false)
    // Conflicting combo matches
    expect(findConflict('Alt + G', 'otherAction')).toBe(true)
  })

  it('renders modal when open', () => {
    const item = {
      id: 'canvasDrawer',
      label: 'Spatial Canvas',
      key: 'Ctrl + Shift + ;',
      defaultKey: 'Ctrl + Shift + ;'
    }
    render(
      <ShortcutRenameBox
        isOpen={true}
        onClose={vi.fn()}
        shortcutItem={item}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByText('Spatial Canvas')).toBeInTheDocument()
  })
})
