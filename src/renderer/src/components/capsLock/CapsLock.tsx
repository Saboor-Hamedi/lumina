import React, { useState, useEffect, useCallback } from 'react'
import ToolTip from '../atoms/ToolTip'
import './capsLock.css'

export interface CapsLockProps {
  className?: string
  style?: React.CSSProperties
  showLabel?: boolean
}

/**
 * CapsLock Component
 *
 * Robust TypeScript indicator that monitors CapsLock state across the window.
 * When CapsLock is ON, it illuminates an organic glowing blob light styled with
 * the active accent color, soft ambient shadows, no background, and no border.
 * When CapsLock is OFF, the blob turns off.
 */
export const CapsLock: React.FC<CapsLockProps> = React.memo(
  ({ className = '', style, showLabel = false }) => {
    const [isCapsLockOn, setIsCapsLockOn] = useState<boolean>(false)
    const stateRef = React.useRef<boolean>(false)

    const checkCapsLock = useCallback((e: Event) => {
      if ('getModifierState' in e && typeof (e as KeyboardEvent).getModifierState === 'function') {
        const active = (e as KeyboardEvent).getModifierState('CapsLock')
        if (stateRef.current !== active) {
          stateRef.current = active
          setIsCapsLockOn(active)
        }
      }
    }, [])

    useEffect(() => {
      // Passive listeners on window for instant, non-blocking state updates
      const opts: AddEventListenerOptions = { passive: true, capture: true }

      const handleBlur = () => {
        if (stateRef.current) {
          stateRef.current = false
          setIsCapsLockOn(false)
        }
      }

      window.addEventListener('keydown', checkCapsLock, opts)
      window.addEventListener('keyup', checkCapsLock, opts)
      window.addEventListener('pointerdown', checkCapsLock, opts)
      window.addEventListener('blur', handleBlur, opts)

      return () => {
        window.removeEventListener('keydown', checkCapsLock, opts)
        window.removeEventListener('keyup', checkCapsLock, opts)
        window.removeEventListener('pointerdown', checkCapsLock, opts)
        window.removeEventListener('blur', handleBlur, opts)
      }
    }, [checkCapsLock])

    if (!isCapsLockOn) {
      return null
    }

    return (
      <ToolTip text="Caps Lock is ON" position="top">
        <div
          className={`caps-lock-blob-wrap ${className}`.trim()}
          style={style}
          aria-live="polite"
          role="status"
          aria-label="Caps Lock is active"
        >
          <span className="caps-lock-blob-light" />
          {showLabel && <span className="caps-lock-blob-text">CAPS</span>}
        </div>
      </ToolTip>
    )
  }
)

CapsLock.displayName = 'CapsLock'
export default CapsLock
