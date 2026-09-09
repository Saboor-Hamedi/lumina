import { useState, useEffect, useRef, useCallback } from 'react'
import { useSettingsStore } from '../../core/store/useSettingsStore'

const CLOSE_DRAG_THRESHOLD = 140
const MIN_LEFT_WIDTH = 180
const DEFAULT_LEFT_WIDTH = 260
const MAX_LEFT_WIDTH = 600

const MIN_RIGHT_WIDTH = 200
const DEFAULT_RIGHT_WIDTH = 300
const MAX_RIGHT_WIDTH = 750

export function useSidebarResize({
  appShellRef,
  isLeftSidebarOpen,
  isRightSidebarOpen,
  updateLeftSidebarOpen,
  handleCloseRightSidebar
}) {
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('lumina_left_sidebar_width')
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= MIN_LEFT_WIDTH && parsed <= MAX_LEFT_WIDTH) {
          return parsed
        }
      }
    }
    const storeVal = useSettingsStore.getState().settings?.sidebar?.width
    if (typeof storeVal === 'number' && storeVal >= MIN_LEFT_WIDTH && storeVal <= MAX_LEFT_WIDTH) {
      return storeVal
    }
    return DEFAULT_LEFT_WIDTH
  })

  const [rightWidth, setRightWidth] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('lumina_right_sidebar_width')
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (!isNaN(parsed) && parsed >= MIN_RIGHT_WIDTH && parsed <= MAX_RIGHT_WIDTH) {
          return parsed
        }
      }
    }
    const storeVal = useSettingsStore.getState().settings?.rightSidebar?.width
    if (typeof storeVal === 'number' && storeVal >= MIN_RIGHT_WIDTH && storeVal <= MAX_RIGHT_WIDTH) {
      return storeVal
    }
    return DEFAULT_RIGHT_WIDTH
  })

  const widthRef = useRef({ left: leftWidth, right: rightWidth })
  const initialWidthRef = useRef({ left: leftWidth, right: rightWidth })
  const shellRectRef = useRef({
    left: 0,
    right: typeof window !== 'undefined' ? window.innerWidth : 1200,
    width: 1200
  })
  const resizingSideRef = useRef(null)

  // Synchronize CSS custom properties and storage when leftWidth state updates
  useEffect(() => {
    widthRef.current.left = leftWidth
    initialWidthRef.current.left = leftWidth
    const contentWidth = Math.max(MIN_LEFT_WIDTH, leftWidth)
    if (appShellRef.current) {
      appShellRef.current.style.setProperty('--left-sidebar-width', `${leftWidth}px`)
      appShellRef.current.style.setProperty('--left-sidebar-content-width', `${contentWidth}px`)
    }
    document.documentElement.style.setProperty('--left-sidebar-width', `${leftWidth}px`)
    document.documentElement.style.setProperty('--left-sidebar-content-width', `${contentWidth}px`)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lumina_left_sidebar_width', String(leftWidth))
    }
  }, [leftWidth, appShellRef])

  // Synchronize CSS custom properties and storage when rightWidth state updates
  useEffect(() => {
    widthRef.current.right = rightWidth
    initialWidthRef.current.right = rightWidth
    const contentWidth = Math.max(MIN_RIGHT_WIDTH, rightWidth)
    if (appShellRef.current) {
      appShellRef.current.style.setProperty('--right-sidebar-width', `${rightWidth}px`)
      appShellRef.current.style.setProperty('--right-sidebar-content-width', `${contentWidth}px`)
    }
    document.documentElement.style.setProperty('--right-sidebar-width', `${rightWidth}px`)
    document.documentElement.style.setProperty('--right-sidebar-content-width', `${contentWidth}px`)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lumina_right_sidebar_width', String(rightWidth))
    }
  }, [rightWidth, appShellRef])

  const handleStartResize = useCallback(
    (side, e) => {
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

      const currentWidth = side === 'left' ? leftWidth : rightWidth
      initialWidthRef.current[side] = currentWidth
      widthRef.current[side] = currentWidth

      const onMouseMove = (moveEvent) => {
        const activeSide = resizingSideRef.current
        if (!activeSide) return

        const shell = appShellRef.current
        if (!shell) return

        const rect = shellRectRef.current
        const clientX = moveEvent.clientX

        if (activeSide === 'left') {
          const rawWidth = clientX - rect.left
          widthRef.current.left = rawWidth
          const outerWidth = Math.max(0, Math.min(MAX_LEFT_WIDTH, rawWidth))
          const contentWidth = Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, rawWidth))
          shell.style.setProperty('--left-sidebar-width', `${outerWidth}px`)
          shell.style.setProperty('--left-sidebar-content-width', `${contentWidth}px`)
          document.documentElement.style.setProperty('--left-sidebar-width', `${outerWidth}px`)
          document.documentElement.style.setProperty('--left-sidebar-content-width', `${contentWidth}px`)
        } else if (activeSide === 'right') {
          const rawWidth = rect.right - clientX
          widthRef.current.right = rawWidth
          const outerWidth = Math.max(0, Math.min(MAX_RIGHT_WIDTH, rawWidth))
          const contentWidth = Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, rawWidth))
          shell.style.setProperty('--right-sidebar-width', `${outerWidth}px`)
          shell.style.setProperty('--right-sidebar-content-width', `${contentWidth}px`)
          document.documentElement.style.setProperty('--right-sidebar-width', `${outerWidth}px`)
          document.documentElement.style.setProperty('--right-sidebar-content-width', `${contentWidth}px`)
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
            document.documentElement.style.setProperty('--left-sidebar-content-width', `${MIN_LEFT_WIDTH}px`)
            setTimeout(() => {
              setLeftWidth(restoreWidth)
              if (shell) {
                shell.style.setProperty('--left-sidebar-width', `${restoreWidth}px`)
                shell.style.setProperty('--left-sidebar-content-width', `${restoreWidth}px`)
              }
              document.documentElement.style.setProperty('--left-sidebar-width', `${restoreWidth}px`)
              document.documentElement.style.setProperty('--left-sidebar-content-width', `${restoreWidth}px`)
            }, 250)
          } else {
            const finalWidth = Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, Math.round(raw)))
            setLeftWidth(finalWidth)
            if (shell) {
              shell.style.setProperty('--left-sidebar-width', `${finalWidth}px`)
              shell.style.setProperty('--left-sidebar-content-width', `${finalWidth}px`)
            }
            document.documentElement.style.setProperty('--left-sidebar-width', `${finalWidth}px`)
            document.documentElement.style.setProperty('--left-sidebar-content-width', `${finalWidth}px`)
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
            document.documentElement.style.setProperty('--right-sidebar-content-width', `${MIN_RIGHT_WIDTH}px`)
            setTimeout(() => {
              setRightWidth(restoreWidth)
              if (shell) {
                shell.style.setProperty('--right-sidebar-width', `${restoreWidth}px`)
                shell.style.setProperty('--right-sidebar-content-width', `${restoreWidth}px`)
              }
              document.documentElement.style.setProperty('--right-sidebar-width', `${restoreWidth}px`)
              document.documentElement.style.setProperty('--right-sidebar-content-width', `${restoreWidth}px`)
            }, 250)
          } else {
            const finalWidth = Math.max(MIN_RIGHT_WIDTH, Math.min(MAX_RIGHT_WIDTH, Math.round(raw)))
            setRightWidth(finalWidth)
            if (shell) {
              shell.style.setProperty('--right-sidebar-width', `${finalWidth}px`)
              shell.style.setProperty('--right-sidebar-content-width', `${finalWidth}px`)
            }
            document.documentElement.style.setProperty('--right-sidebar-width', `${finalWidth}px`)
            document.documentElement.style.setProperty('--right-sidebar-content-width', `${finalWidth}px`)
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

  const handleResetSidebar = useCallback(
    (side) => {
      if (side === 'left') {
        const defaultLeft = DEFAULT_LEFT_WIDTH
        widthRef.current.left = defaultLeft
        initialWidthRef.current.left = defaultLeft
        setLeftWidth(defaultLeft)
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('lumina_left_sidebar_width', String(defaultLeft))
        }
        if (appShellRef.current) {
          appShellRef.current.style.setProperty('--left-sidebar-width', `${defaultLeft}px`)
          appShellRef.current.style.setProperty('--left-sidebar-content-width', `${defaultLeft}px`)
        }
        document.documentElement.style.setProperty('--left-sidebar-width', `${defaultLeft}px`)
        document.documentElement.style.setProperty('--left-sidebar-content-width', `${defaultLeft}px`)
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
        if (appShellRef.current) {
          appShellRef.current.style.setProperty('--right-sidebar-width', `${defaultRight}px`)
          appShellRef.current.style.setProperty('--right-sidebar-content-width', `${defaultRight}px`)
        }
        document.documentElement.style.setProperty('--right-sidebar-width', `${defaultRight}px`)
        document.documentElement.style.setProperty('--right-sidebar-content-width', `${defaultRight}px`)
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
