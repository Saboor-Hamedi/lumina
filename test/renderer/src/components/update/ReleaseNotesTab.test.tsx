import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import ReleaseNotesTab, {
  parseReleaseNotes
} from '../../../../../src/renderer/src/components/update/ReleaseNotesTab'
import UpdateButton from '../../../../../src/renderer/src/components/update/UpdateButton'
import { useUpdateStore } from '../../../../../src/renderer/src/core/store/UpdateSetting'
import {
  useWorkspaceStore,
  RELEASE_NOTES_TAB_ID
} from '../../../../../src/renderer/src/core/store/workspaceStore'

describe('ReleaseNotesTab & UnifiedUpdateButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUpdateStore.setState({
      status: 'idle',
      updateInfo: null,
      progress: null,
      error: null,
      releases: [],
      releasesLoading: false,
      selectedReleaseVersion: null
    })
    ;(window as any).api = {
      getVersion: vi.fn().mockResolvedValue('2.1.1'),
      getGithubReleases: vi.fn().mockResolvedValue({
        currentVersion: '2.1.1',
        latestVersion: '2.1.1',
        updateAvailable: false,
        fromCache: true,
        cachedAt: 1700000000,
        etag: 'W/"test"',
        releases: [
          {
            id: 211,
            tagName: 'v2.1.1',
            version: '2.1.1',
            name: 'Lumina 2.1.1',
            body: '### Features\n- ETag cached release notes tab',
            htmlUrl: 'https://github.com/Saboor-Hamedi/lumina/releases/tag/v2.1.1',
            publishedAt: '2026-04-20T00:00:00Z',
            prerelease: false,
            isLatest: true,
            isInstalled: true,
            isNewerThanCurrent: false,
            assets: [
              {
                name: 'Lumina_2.1.1_x64-setup.exe',
                browserDownloadUrl:
                  'https://github.com/Saboor-Hamedi/lumina/releases/download/v2.1.1/Lumina_2.1.1_x64-setup.exe',
                size: 10485760,
                downloadCount: 25,
                sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
              }
            ]
          },
          {
            id: 142,
            tagName: 'v1.4.2',
            version: '1.4.2',
            name: 'Lumina 1.4.2',
            body: '### Fixes\n- Previous stable build',
            htmlUrl: 'https://github.com/Saboor-Hamedi/lumina/releases/tag/v1.4.2',
            publishedAt: '2026-03-01T00:00:00Z',
            prerelease: false,
            isLatest: false,
            isInstalled: false,
            isNewerThanCurrent: false,
            assets: []
          }
        ]
      }),
      checkForUpdates: vi.fn().mockResolvedValue({ updateAvailable: false }),
      downloadUpdate: vi.fn().mockResolvedValue(undefined),
      quitAndInstall: vi.fn().mockResolvedValue(undefined),
      openExternal: vi.fn().mockResolvedValue(undefined)
    }
  })

  it('opens the release-notes virtual tab in workspaceStore without setting selectedNote', () => {
    useWorkspaceStore.setState({
      openTabs: [],
      activeTabId: null,
      selectedNote: null
    })

    useWorkspaceStore.getState().openReleaseNotesTab()
    const state = useWorkspaceStore.getState()
    expect(state.openTabs).toContain(RELEASE_NOTES_TAB_ID)
    expect(state.activeTabId).toBe(RELEASE_NOTES_TAB_ID)
    expect(state.selectedNote).toBeNull()
  })

  it('renders only Check for Updates in the header banner alongside release rail, markdown body, and collapsible assets', async () => {
    await act(async () => {
      render(<ReleaseNotesTab />)
    })

    expect(screen.getByTestId('release-notes-tab')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Check for Updates/i })).toBeInTheDocument()
    expect(screen.getByText(/ETag cached release notes tab/i)).toBeInTheDocument()

    // Switch release in the left rail
    const olderBtn = screen.getByTestId('release-rail-item-1.4.2')
    fireEvent.click(olderBtn)
    expect(screen.getByText(/Previous stable build/i)).toBeInTheDocument()

    // Switch back to 2.1.1 and expand assets
    fireEvent.click(screen.getByTestId('release-rail-item-2.1.1'))
    const assetsToggle = screen.getByRole('button', { name: /Release Assets & Checksums/i })
    fireEvent.click(assetsToggle)
    expect(screen.getByText('Lumina_2.1.1_x64-setup.exe')).toBeInTheDocument()
  })

  it('UpdateButton stays hidden when idle/up-to-date and handles download & restart when an update exists', () => {
    const check = vi.fn()
    const download = vi.fn()
    const install = vi.fn()
    const toastSpy = vi.fn()
    window.addEventListener('show-toast', toastSpy)

    useUpdateStore.setState({ status: 'idle', check, download, install })
    const { rerender } = render(<UpdateButton />)
    expect(screen.queryByTestId('unified-update-btn')).not.toBeInTheDocument()

    // Still hidden when up to date
    act(() => {
      useUpdateStore.setState({ status: 'not-available', check, download, install })
    })
    rerender(<UpdateButton />)
    expect(screen.queryByTestId('unified-update-btn')).not.toBeInTheDocument()

    // When update is available, shows button, dispatches toast, and downloads on click
    act(() => {
      useUpdateStore.setState({
        status: 'available',
        updateInfo: { version: '2.2.0' },
        check,
        download,
        install
      })
    })
    rerender(<UpdateButton />)
    expect(toastSpy).toHaveBeenCalled()
    expect(screen.getByText('v2.2.0')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('unified-update-btn'))
    expect(download).toHaveBeenCalledTimes(1)

    act(() => {
      useUpdateStore.setState({
        status: 'ready',
        updateInfo: { version: '2.2.0' },
        check,
        download,
        install
      })
    })
    rerender(<UpdateButton />)
    expect(screen.getByText('Restart')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('unified-update-btn'))
    expect(install).toHaveBeenCalledTimes(1)

    window.removeEventListener('show-toast', toastSpy)
  })

  it('parses HTML release notes cleanly without raw tags', () => {
    expect(parseReleaseNotes('')).toEqual([])
    const htmlNotes =
      '<h1>Version 91</h1>\n<p>This version has fixed most the critical issue.</p>'
    expect(parseReleaseNotes(htmlNotes)).toEqual([
      {
        title: 'Version 91',
        items: ['This version has fixed most the critical issue.']
      }
    ])
  })
})
