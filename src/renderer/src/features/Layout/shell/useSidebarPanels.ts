import { useState, useEffect, useCallback, useRef } from 'react'
import { RightSidebarTabId } from '../../Navigation/RightActivityBar'
import { useSettingsStore } from '../../../core/store/SettingStore'

export function useSidebarPanels() {
  const isLeftSidebarOpen = useSettingsStore(
    (state) => state.settings?.sidebar?.isLeftOpen ?? true
  )
  const isRightSidebarOpen = useSettingsStore(
    (state) => state.settings?.rightSidebar?.isRightOpen ?? false
  )

  const [rightSidebarTab, setRightSidebarTab] = useState<string>('details')
  const rightSidebarTabRef = useRef(rightSidebarTab)
  useEffect(() => {
    rightSidebarTabRef.current = rightSidebarTab
  }, [rightSidebarTab])

  const isZenModeEnabled = useSettingsStore((state) => state.settings?.zenMode?.enabled === true)
  const hideActivityBarInZen = useSettingsStore(
    (state) => state.settings?.zenMode?.hideActivityBar !== false
  )
  const hideRightActivityBarInZen = useSettingsStore(
    (state) => state.settings?.zenMode?.hideRightActivityBar !== false
  )
  const hideStatusBarInZen = useSettingsStore(
    (state) => state.settings?.zenMode?.hideStatusBar !== false
  )
  const isActivityBarVisible = useSettingsStore(
    (state) => state.settings?.activityBarVisible !== false
  )
  const isRightActivityBarVisible = useSettingsStore(
    (state) => state.settings?.rightActivityBarVisible !== false
  )
  const isStatusBarVisible = useSettingsStore((state) => state.settings?.statusBarVisible === true)
  const isTabsVisible = useSettingsStore((state) => state.settings?.tabsVisible !== false)
  const isBreadcrumbsVisible = useSettingsStore(
    (state) => state.settings?.breadcrumbsVisible !== false
  )

  const isLeftSidebarOpenRef = useRef(isLeftSidebarOpen)
  const isRightSidebarOpenRef = useRef(isRightSidebarOpen)

  useEffect(() => {
    isLeftSidebarOpenRef.current = isLeftSidebarOpen
  }, [isLeftSidebarOpen])

  useEffect(() => {
    isRightSidebarOpenRef.current = isRightSidebarOpen
  }, [isRightSidebarOpen])

  const updateLeftSidebarOpen = useCallback((valOrFn: boolean | ((prev: boolean) => boolean)) => {
    const current = useSettingsStore.getState().settings?.sidebar?.isLeftOpen ?? true
    const next = typeof valOrFn === 'function' ? valOrFn(current) : valOrFn
    isLeftSidebarOpenRef.current = next
    window.dispatchEvent(new CustomEvent('left-sidebar-toggle', { detail: { open: next } }))
    const currentSidebar = (useSettingsStore.getState().settings as any)?.sidebar || {}
    if (currentSidebar.isLeftOpen !== next) {
      useSettingsStore.getState().updateSettings({
        sidebar: {
          ...currentSidebar,
          isLeftOpen: next
        }
      } as any)
    }
  }, [])

  const updateRightSidebarOpen = useCallback((valOrFn: boolean | ((prev: boolean) => boolean)) => {
    const current = useSettingsStore.getState().settings?.rightSidebar?.isRightOpen ?? false
    const next = typeof valOrFn === 'function' ? valOrFn(current) : valOrFn
    isRightSidebarOpenRef.current = next
    const currentRSidebar = (useSettingsStore.getState().settings as any)?.rightSidebar || {}
    if (currentRSidebar.isRightOpen !== next) {
      useSettingsStore.getState().updateSettings({
        rightSidebar: {
          ...currentRSidebar,
          isRightOpen: next
        }
      } as any)
    }
  }, [])

  const handleToggleLeftSidebar = useCallback(() => {
    updateLeftSidebarOpen((prev) => !prev)
  }, [updateLeftSidebarOpen])

  const handleToggleRightSidebar = useCallback(() => {
    updateRightSidebarOpen((prev) => !prev)
  }, [updateRightSidebarOpen])

  const handleCloseRightSidebar = useCallback(() => {
    updateRightSidebarOpen(false)
  }, [updateRightSidebarOpen])

  const handleSelectRightSidebarTab = useCallback(
    (tab: RightSidebarTabId) => {
      if (!isRightSidebarOpenRef.current) {
        setRightSidebarTab(tab)
        updateRightSidebarOpen(true)
      } else if (rightSidebarTabRef.current !== tab) {
        setRightSidebarTab(tab)
      } else {
        updateRightSidebarOpen(false)
      }
    },
    [updateRightSidebarOpen]
  )

  const handleToggleInspector = useCallback(() => {
    updateRightSidebarOpen((prev) => !prev)
  }, [updateRightSidebarOpen])

  return {
    isLeftSidebarOpen,
    isRightSidebarOpen,
    isLeftSidebarOpenRef,
    isRightSidebarOpenRef,
    rightSidebarTab,
    setRightSidebarTab,
    rightSidebarTabRef,
    isZenModeEnabled,
    hideActivityBarInZen,
    hideRightActivityBarInZen,
    hideStatusBarInZen,
    isActivityBarVisible,
    isRightActivityBarVisible,
    isStatusBarVisible,
    isTabsVisible,
    isBreadcrumbsVisible,
    updateLeftSidebarOpen,
    updateRightSidebarOpen,
    handleToggleLeftSidebar,
    handleToggleRightSidebar,
    handleCloseRightSidebar,
    handleSelectRightSidebarTab,
    handleToggleInspector
  }
}
