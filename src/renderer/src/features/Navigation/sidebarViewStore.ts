import { create } from 'zustand'
import { useSettingsStore } from '../../core/store/SettingStore'

export type SidebarActiveView = 'files' | 'theme' | 'templates'

interface SidebarViewState {
  activeView: SidebarActiveView
  setActiveView: (view: SidebarActiveView) => void
}

export const useSidebarViewStore = create<SidebarViewState>((set) => ({
  activeView: 'files',
  setActiveView: (view) => set({ activeView: view })
}))

export const openLeftSidebar = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('toggle-left-sidebar', { detail: { open: true } }))
  }
}

export const closeLeftSidebar = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('toggle-left-sidebar', { detail: { open: false } }))
  }
}

export const openSidebarView = (view: SidebarActiveView): void => {
  useSidebarViewStore.getState().setActiveView(view)
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
