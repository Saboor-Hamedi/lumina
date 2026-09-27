/**
 * =========================================================================
 * Sidebar Resizing & Drag Hook (`resizeSidebar.ts`)
 * =========================================================================
 *
 * Provides smooth, high-performance curtain-drag resizing for both left
 * (Explorer/Navigation) and right (Inspector/Backlinks) sidebars.
 *
 * Key Capabilities:
 * - Direct CSS custom property updates (--left-sidebar-width, --right-sidebar-width)
 *   bypassing React re-renders during mousemove for 120 FPS buttery smooth drag.
 * - Hardware boundary clamps with minimum, maximum, and snap-to-close drag thresholds.
 * - LocalStorage persistence and synchronization with `useSettingsStore`.
 * - Double-click gutter resetting to default ergonomic widths.
 * - Robust cleanup on unmount or blur events.
 * =========================================================================
 */

import { useState, useEffect, useRef, useCallback, RefObject } from 'react'
import { useSettingsStore } from '../../core/store/SettingStore'

// Boundary Constants (in pixels)
export const CLOSE_DRAG_THRESHOLD = 140
export const MIN_LEFT_WIDTH = 180
export const DEFAULT_LEFT_WIDTH = 260
export const MAX_LEFT_WIDTH = 600

export const MIN_RIGHT_WIDTH = 200
export const DEFAULT_RIGHT_WIDTH = 300
export const MAX_RIGHT_WIDTH = 750

export type SidebarSide = 'left' | 'right'

export interface UseSidebarResizeParams {
  appShellRef: RefObject<HTMLElement | null>
  isLeftSidebarOpen: boolean
  isRightSidebarOpen: boolean
  updateLeftSidebarOpen: (isOpen: boolean) => void
  handleCloseRightSidebar: () => void
}

export interface UseSidebarResizeReturn {
  leftWidth: number
  rightWidth: number
  setLeftWidth: React.Dispatch<React.SetStateAction<number>>
  setRightWidth: React.Dispatch<React.SetStateAction<number>>
  handleStartResize: (side: SidebarSide, e: React.MouseEvent) => void
  handleResetSidebar: (side: SidebarSide) => void
}

/**
 * Reads initial width from LocalStorage or SettingsStore with boundary validation.
 */
function getInitialWidth(
  storageKey: string,
  minWidth: number,
  maxWidth: number,
  defaultWidth: number,
  storeWidth?: number
): number {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed = parseInt(saved, 10)
      if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
        return parsed
      }
    }
  }
  if (typeof storeWidth === 'number' && storeWidth >= minWidth && storeWidth <= maxWidth) {
    return storeWidth
  }
  return defaultWidth
}

/**
 * Applies CSS custom properties for a given sidebar to the container and root element.
 */
function applySidebarCssVars(
  shellEl: HTMLElement | null,
  side: SidebarSide,
  width: number,
  contentWidth: number
): void {
  const widthProp = `--${side}-sidebar-width`
  const contentWidthProp = `--${side}-sidebar-content-width`
  const widthVal = `${width}px`
  const contentWidthVal = `${contentWidth}px`

  if (shellEl) {
    shellEl.style.setProperty(widthProp, widthVal)
    shellEl.style.setProperty(contentWidthProp, contentWidthVal)
  }
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty(widthProp, widthVal)
    document.documentElement.style.setProperty(contentWidthProp, contentWidthVal)
  }
}

/**
 * Hook managing left and right sidebar dynamic drag resizing.
 */
export function useSidebarResize({
  appShellRef,
  isLeftSidebarOpen,
  isRightSidebarOpen,
  updateLeftSidebarOpen,
  handleCloseRightSidebar
}: UseSidebarResizeParams): UseSidebarResizeReturn {
  const [leftWidth, setLeftWidth] = useState<number>(() =>
    getInitialWidth(
      'lumina_left_sidebar_width',
      MIN_LEFT_WIDTH,
      MAX_LEFT_WIDTH,
      DEFAULT_LEFT_WIDTH,
      useSettingsStore.getState().settings?.sidebar?.width
    )
  )

  const [rightWidth, setRightWidth] = useState<number>(() =>
    getInitialWidth(
      'lumina_right_sidebar_width',
      MIN_RIGHT_WIDTH,
      MAX_RIGHT_WIDTH,
      DEFAULT_RIGHT_WIDTH,
      useSettingsStore.getState().settings?.rightSidebar?.width
    )
  )

  const widthRef = useRef({ left: leftWidth, right: rightWidth })
  const initialWidthRef = useRef({ left: leftWidth, right: rightWidth })
  const shellRectRef = useRef({
    left: 0,
    right: typeof window !== 'undefined' ? window.innerWidth : 1200,
    width: 1200
  })
  const resizingSideRef = useRef<SidebarSide | null>(null)

  // Synchronize CSS custom properties and storage when leftWidth state updates
  useEffect(() => {
    widthRef.current.left = leftWidth
    initialWidthRef.current.left = leftWidth
    const contentWidth = Math.max(MIN_LEFT_WIDTH, leftWidth)
    applySidebarCssVars(appShellRef.current, 'left', leftWidth, contentWidth)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lumina_left_sidebar_width', String(leftWidth))
    }
  }, [leftWidth, appShellRef])

  // Synchronize CSS custom properties and storage when rightWidth state updates
  useEffect(() => {
    widthRef.current.right = rightWidth
    initialWidthRef.current.right = rightWidth
    const contentWidth = Math.max(MIN_RIGHT_WIDTH, rightWidth)
    applySidebarCssVars(appShellRef.current, 'right', rightWidth, contentWidth)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lumina_right_sidebar_width', String(rightWidth))
    }
  }, [rightWidth, appShellRef])

  /**
   * Begins curtain drag resizing on mouse down.
   */
  const handleStartResize = useCallback(
    (side: SidebarSide, e: React.MouseEvent) => {
      if (side === 'left' && !isLeftSidebarOpen) return
      if (side === 'right' && !isRightSidebarOpen) return

      e.preventDefault()
      e.stopPropagation()

      resizingSideRef.current = side

      const shellEl = appShellRef.current
      if (shellEl) {
        shellRectRef.current = shellEl.getBoundingClientRect()
        shellEl.classList.add('is-resizing')
      }
      document.body.classList.add('is-global-resizing')

      const startClientX = e.clientX
      let measuredStartWidth = side === 'left' ? leftWidth : rightWidth
      if (shellEl) {
        const sidebarEl =
          side === 'left'
            ? shellEl.querySelector('.shell-sidebar-left')
            : shellEl.querySelector('.shell-sidebar-right')
        if (sidebarEl) {
          const rect = sidebarEl.getBoundingClientRect()
          if (rect.width > 0) {
            measuredStartWidth = rect.width
          }
        }
      }
      const startWidth = measuredStartWidth
      initialWidthRef.current[side] = startWidth
      widthRef.current[side] = startWidth

      const onMouseMove = (moveEvent: MouseEvent) => {
        const activeSide = resizingSideRef.current
        if (!activeSide) return

        const shell = appShellRef.current
        if (!shell) return

        const deltaX = moveEvent.clientX - startClientX

        if (activeSide === 'left') {
          const rawWidth = startWidth + deltaX
          widthRef.current.left = rawWidth
          const outerWidth = rawWidth < 70 ? 0 : Math.max(0, Math.min(MAX_LEFT_WIDTH, rawWidth))
          const contentWidth = Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, rawWidth))
          applySidebarCssVars(shell, 'left', outerWidth, contentWidth)
        } else if (activeSide === 'right') {
          const rawWidth = startWidth - deltaX
          widthRef.current.right = rawWidth
          const outerWidth = rawWidth < 70 ? 0 : Math.max(0, Math.min(MAX_RIGHT_WIDTH, rawWidth))
          const contentWidth = Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, rawWidth))
          applySidebarCssVars(shell, 'right', outerWidth, contentWidth)
        }
      }

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        window.removeEventListener('blur', onMouseUp)

        const activeSide = resizingSideRef.current
        resizingSideRef.current = null

        const shell = appShellRef.current

        if (activeSide === 'left') {
          const raw = widthRef.current.left
          const initialLeft = initialWidthRef.current.left || DEFAULT_LEFT_WIDTH

          if (raw < CLOSE_DRAG_THRESHOLD) {
            updateLeftSidebarOpen(false)
            const restoreWidth = Math.max(MIN_LEFT_WIDTH, initialLeft)
            if (shell) {
              shell.style.setProperty('--left-sidebar-content-width', `${MIN_LEFT_WIDTH}px`)
            }
            document.documentElement.style.setProperty(
              '--left-sidebar-content-width',
              `${MIN_LEFT_WIDTH}px`
            )
            setTimeout(() => {
              setLeftWidth(restoreWidth)
              applySidebarCssVars(shell, 'left', restoreWidth, restoreWidth)
            }, 250)
          } else {
            const finalWidth = Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, Math.round(raw)))
            setLeftWidth(finalWidth)
            applySidebarCssVars(shell, 'left', finalWidth, finalWidth)
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('lumina_left_sidebar_open', 'true')
              localStorage.setItem('lumina_left_sidebar_width', String(finalWidth))
            }
            setTimeout(() => {
              const currentSidebar = useSettingsStore.getState().settings?.sidebar || {}
              useSettingsStore.getState().updateSettings({
                sidebar: {
                  ...currentSidebar,
                  width: finalWidth,
                  isLeftOpen: true
                }
              })
            }, 0)
          }
        } else if (activeSide === 'right') {
          const raw = widthRef.current.right
          const initialRight = initialWidthRef.current.right || DEFAULT_RIGHT_WIDTH

          if (raw < CLOSE_DRAG_THRESHOLD) {
            handleCloseRightSidebar()
            const restoreWidth = Math.max(MIN_RIGHT_WIDTH, initialRight)
            if (shell) {
              shell.style.setProperty('--right-sidebar-content-width', `${MIN_RIGHT_WIDTH}px`)
            }
            document.documentElement.style.setProperty(
              '--right-sidebar-content-width',
              `${MIN_RIGHT_WIDTH}px`
            )
            setTimeout(() => {
              setRightWidth(restoreWidth)
              applySidebarCssVars(shell, 'right', restoreWidth, restoreWidth)
            }, 250)
          } else {
            const finalWidth = Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, Math.round(raw)))
            setRightWidth(finalWidth)
            applySidebarCssVars(shell, 'right', finalWidth, finalWidth)
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('lumina_right_sidebar_open', 'true')
              localStorage.setItem('lumina_right_sidebar_width', String(finalWidth))
            }
            setTimeout(() => {
              const currentRSidebar = useSettingsStore.getState().settings?.rightSidebar || {}
              useSettingsStore.getState().updateSettings({
                rightSidebar: {
                  ...currentRSidebar,
                  width: finalWidth,
                  isRightOpen: true
                }
              })
            }, 0)
          }
        }

        document.body.classList.remove('is-global-resizing')
        if (shell) {
          shell.classList.remove('is-resizing')
        }
      }

      window.addEventListener('mousemove', onMouseMove, { passive: true })
      window.addEventListener('mouseup', onMouseUp)
      window.addEventListener('blur', onMouseUp)
    },
    [
      isLeftSidebarOpen,
      isRightSidebarOpen,
      leftWidth,
      rightWidth,
      updateLeftSidebarOpen,
      handleCloseRightSidebar,
      appShellRef
    ]
  )

  /**
   * Resets a sidebar to default widths (typically triggered via double clicking the gutter handle).
   */
  const handleResetSidebar = useCallback(
    (side: SidebarSide) => {
      if (side === 'left') {
        const defaultLeft = DEFAULT_LEFT_WIDTH
        widthRef.current.left = defaultLeft
        initialWidthRef.current.left = defaultLeft
        setLeftWidth(defaultLeft)
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('lumina_left_sidebar_width', String(defaultLeft))
        }
        applySidebarCssVars(appShellRef.current, 'left', defaultLeft, defaultLeft)
        setTimeout(() => {
          const currentSidebar = useSettingsStore.getState().settings?.sidebar || {}
          useSettingsStore.getState().updateSettings({
            sidebar: { ...currentSidebar, width: defaultLeft }
          })
        }, 0)
      } else {
        const defaultRight = DEFAULT_RIGHT_WIDTH
        widthRef.current.right = defaultRight
        initialWidthRef.current.right = defaultRight
        setRightWidth(defaultRight)
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('lumina_right_sidebar_width', String(defaultRight))
        }
        applySidebarCssVars(appShellRef.current, 'right', defaultRight, defaultRight)
        setTimeout(() => {
          const currentRSidebar = useSettingsStore.getState().settings?.rightSidebar || {}
          useSettingsStore.getState().updateSettings({
            rightSidebar: { ...currentRSidebar, width: defaultRight }
          })
        }, 0)
      }
    },
    [appShellRef]
  )

  useEffect(() => {
    return () => {
      document.body.classList.remove('is-global-resizing')
    }
  }, [])

  return {
    leftWidth,
    rightWidth,
    setLeftWidth,
    setRightWidth,
    handleStartResize,
    handleResetSidebar
  }
}

// Named alias matching hook file name
export const resizeSidebar = useSidebarResize
