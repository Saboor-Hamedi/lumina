import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type MouseEvent as ReactMouseEvent,
  type RefObject
} from 'react'
import { useSettingsStore } from '../store/SettingStore'

export interface ModalSize {
  width: number
  height: number
}

export type ResizeDirection = string | string[]

export interface UseResizableReturn {
  size: ModalSize
  handleResizeStart: (e: ReactMouseEvent | MouseEvent, direction: ResizeDirection) => void
}

export const useResizable = (
  modalRef: RefObject<HTMLElement | null>,
  initialWidth = 350,
  initialHeight = 500
): UseResizableReturn => {
  const { settings } = useSettingsStore()
  const [size, setSize] = useState<ModalSize>({
    width: (settings.explorerModalWidth as number | undefined) || initialWidth,
    height: (settings.explorerModalHeight as number | undefined) || initialHeight
  })

  const latestSize = useRef<ModalSize>(size)
  const startSize = useRef<ModalSize>({ width: 0, height: 0 })
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const isResizing = useRef(false)

  useEffect(() => {
    if (!isResizing.current && (settings.explorerModalWidth || settings.explorerModalHeight)) {
      const newSize: ModalSize = {
        width: (settings.explorerModalWidth as number | undefined) || size.width,
        height: (settings.explorerModalHeight as number | undefined) || size.height
      }
      setSize(newSize)
      latestSize.current = newSize
    }
  }, [settings.explorerModalWidth, settings.explorerModalHeight])

  const handleResizeStart = useCallback(
    (e: ReactMouseEvent | MouseEvent, direction: ResizeDirection): void => {
      e.preventDefault()
      e.stopPropagation()
      isResizing.current = true
      startPos.current = { x: e.clientX, y: e.clientY }
      startSize.current = { width: size.width, height: size.height }

      if (modalRef.current) {
        modalRef.current.style.transition = 'none'
      }

      const handleMouseMove = (moveEvent: MouseEvent): void => {
        const deltaX = moveEvent.clientX - startPos.current.x
        const deltaY = startPos.current.y - moveEvent.clientY

        let newWidth = startSize.current.width
        let newHeight = startSize.current.height

        if (direction.includes('top')) {
          newHeight = Math.max(300, Math.min(600, startSize.current.height + deltaY))
        }
        if (direction.includes('right')) {
          newWidth = Math.max(300, Math.min(600, startSize.current.width + deltaX * 2))
        }
        if (direction.includes('left')) {
          newWidth = Math.max(300, Math.min(600, startSize.current.width - deltaX * 2))
        }

        latestSize.current = { width: newWidth, height: newHeight }
        setSize(latestSize.current)
      }

      const handleMouseUp = (): void => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)

        if (modalRef.current) {
          modalRef.current.style.transition = ''
        }

        useSettingsStore.getState().updateSetting('explorerModalWidth', latestSize.current.width)
        useSettingsStore.getState().updateSetting('explorerModalHeight', latestSize.current.height)
        isResizing.current = false
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [size, modalRef]
  )

  return { size, handleResizeStart }
}
