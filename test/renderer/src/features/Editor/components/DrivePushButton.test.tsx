import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DrivePushButton } from '../../../../../../src/renderer/src/features/Editor/components/DrivePushButton'
import * as currentUserHook from '../../../../../../src/renderer/src/core/hooks/useCurrentUser'
import type { Snippet } from '../../../../../../src/renderer/src/core/editor/types'

describe('DrivePushButton', () => {
  const sampleSnippet = {
    id: 'note-123',
    title: 'My Architecture Spec',
    code: 'Notes body'
  } as unknown as Snippet

  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.window as any).api = {
      ...(global.window as any).api,
      backupFile: vi.fn(),
      cancelBackup: vi.fn(),
      saveSnippet: vi.fn()
    }
  })

  it('renders null when no snippet is provided', () => {
    const { container } = render(<DrivePushButton snippet={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders push button when snippet is provided', () => {
    render(<DrivePushButton snippet={sampleSnippet} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeInTheDocument()
    expect(screen.getByText('Push')).toBeInTheDocument()
  })

  it('notifies user to log in when not logged in', () => {
    vi.spyOn(currentUserHook, 'useCurrentUser').mockReturnValue({
      isLoggedIn: false,
      user: null
    } as any)

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    render(<DrivePushButton snippet={sampleSnippet} />)

    const btn = screen.getByRole('button')
    fireEvent.click(btn)

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'show-toast',
        detail: expect.objectContaining({
          message: 'Log in to Google Drive first'
        })
      })
    )
  })

  it('calls backupFile without crashing when logged in', async () => {
    vi.spyOn(currentUserHook, 'useCurrentUser').mockReturnValue({
      isLoggedIn: true,
      user: { name: 'Test User' }
    } as any)
    ;(global.window as any).api.backupFile.mockResolvedValue({ success: true })

    render(<DrivePushButton snippet={sampleSnippet} />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)

    await waitFor(() => {
      expect((global.window as any).api.backupFile).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'note-123',
          title: 'My Architecture Spec'
        })
      )
    })
  })
})
