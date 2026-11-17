import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DailyNotes from '../../../../../../src/renderer/src/features/Navigation/components/DailyNotes'
import { useSidebarViewStore } from '../../../../../../src/renderer/src/features/Navigation/sidebarViewStore'
import { useSettingsStore } from '../../../../../../src/renderer/src/core/store/SettingStore'

const setSidebarOpen = (isLeftOpen: boolean) => {
  const settings = useSettingsStore.getState().settings as any
  useSettingsStore.setState({
    settings: { ...settings, sidebar: { ...settings.sidebar, isLeftOpen } }
  } as any)
}

describe('DailyNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSidebarOpen(true)
    useSidebarViewStore.setState({ activeView: 'files', activeActivityItem: 'files' })
  })

  const clickDaily = () => fireEvent.click(screen.getByRole('button', { name: /Daily/ }))

  it('renders the Daily button', () => {
    render(<DailyNotes />)
    expect(screen.getByRole('button', { name: /Daily/ })).toBeInTheDocument()
  })

  it('opens the templates sidebar view on click', () => {
    render(<DailyNotes />)
    clickDaily()

    expect(useSidebarViewStore.getState().activeView).toBe('templates')
    expect(useSidebarViewStore.getState().activeActivityItem).toBe('templates')
  })

  it('dispatches a toggle-left-sidebar open event when the sidebar is closed', () => {
    const events: any[] = []
    const listener = (e: Event) => events.push((e as CustomEvent).detail)
    window.addEventListener('toggle-left-sidebar', listener as any)

    render(<DailyNotes />)
    setSidebarOpen(false)
    clickDaily()

    window.removeEventListener('toggle-left-sidebar', listener as any)
    expect(events).toContainEqual({ open: true })
    expect(useSidebarViewStore.getState().activeView).toBe('templates')
  })

  it('closes the templates sidebar when clicked again while open', () => {
    render(<DailyNotes />)
    clickDaily()
    expect(useSidebarViewStore.getState().activeView).toBe('templates')

    clickDaily()
    expect(useSidebarViewStore.getState().activeActivityItem).toBeNull()
    expect(useSidebarViewStore.getState().activeView).toBe('templates')
  })

  it('reopens the templates view when the sidebar was closed', () => {
    useSidebarViewStore.setState({ activeView: 'templates', activeActivityItem: 'templates' })
    setSidebarOpen(false)

    render(<DailyNotes />)
    clickDaily()

    expect(useSidebarViewStore.getState().activeActivityItem).toBe('templates')
  })

  it('marks the activity bar button as active when the templates view is active', () => {
    useSidebarViewStore.setState({ activeView: 'templates', activeActivityItem: 'templates' })

    const { container } = render(<DailyNotes isActivityBar />)
    const btn = container.querySelector('.activity-bar-btn')
    expect(btn?.className).toContain('active')
  })

  it('renders only the icon in activity bar mode', () => {
    const { container } = render(<DailyNotes isActivityBar />)
    expect(container.querySelector('.activity-bar-btn')).toBeInTheDocument()
    expect(screen.queryByText('Daily')).not.toBeInTheDocument()
  })
})
