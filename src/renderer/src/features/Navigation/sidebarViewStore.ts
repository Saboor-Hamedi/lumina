import { create } from 'zustand'
import { useSettingsStore } from '../../core/store/SettingStore'

export type SidebarActiveView = 'files' | 'theme' | 'templates'
export type ActivityBarItemId =
  | SidebarActiveView
  | 'lumina'
  | 'graph'
  | 'canvas'
  | 'terminal'
  | 'docs'
  | 'guide'
  | null

interface SidebarViewState {
  activeView: SidebarActiveView
  activeActivityItem: ActivityBarItemId
  setActiveView: (view: SidebarActiveView) => void
  setActiveActivityItem: (item: ActivityBarItemId) => void
}

const isSidebarView = (item: ActivityBarItemId): item is SidebarActiveView =>
  item === 'files' || item === 'theme' || item === 'templates'

export const useSidebarViewStore = create<SidebarViewState>((set) => ({
  activeView: 'files',
  activeActivityItem: 'files',
  setActiveView: (view) => set({ activeView: view }),
  setActiveActivityItem: (item) => set({ activeActivityItem: item })
}))

export const openLeftSidebar = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('toggle-left-sidebar', { detail: { open: true } }))
  }
}

export const closeLeftSidebar = (): void => {
  useSidebarViewStore.setState((state) => ({
    activeActivityItem: isSidebarView(state.activeActivityItem) ? null : state.activeActivityItem
  }))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('toggle-left-sidebar', { detail: { open: false } }))
  }
}

export const openSidebarView = (view: SidebarActiveView): void => {
  useSidebarViewStore.setState({ activeView: view, activeActivityItem: view })
  openLeftSidebar()
}

export const toggleSidebarView = (view: SidebarActiveView): void => {
  const isLeftOpen = useSettingsStore.getState().settings?.sidebar?.isLeftOpen ?? true
  const currentView = useSidebarViewStore.getState().activeView

  if (isLeftOpen && currentView === view) {
    closeLeftSidebar()
  } else {
    openSidebarView(view)
  }
}

export const clearModalActivityItem = (item: ActivityBarItemId): void => {
  const state = useSidebarViewStore.getState()
  if (state.activeActivityItem !== item) return
  const isLeftOpen = useSettingsStore.getState().settings?.sidebar?.isLeftOpen ?? true
  useSidebarViewStore.setState({
    activeActivityItem: isLeftOpen ? state.activeView : null
  })
}
