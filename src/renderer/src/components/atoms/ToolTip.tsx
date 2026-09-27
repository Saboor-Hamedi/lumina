/**
 * ============================================================================
 * Ultra-Smooth High-Precision ToolTip Component (`ToolTip.tsx`)
 * ============================================================================
 *
 * Architecture & Design Principles:
 * 1. Zero Layout Disruption (Portal Architecture):
 *    Renders into `document.body` via `createPortal`, preventing clipping by
 *    ancestor containers with `overflow: hidden`, `overflow: scroll`, or `contain`.
 *
 * 2. Real-Time Viewport Collision Detection & Edge Flipping:
 *    - Dynamically detects proximity to viewport edges (top, bottom, left, right).
 *    - Flips placement automatically (e.g., Top -> Bottom) when near boundaries.
 *    - Adjusts internal speech-bubble pointer (arrow knob) to precisely target
 *      the center of the trigger element, even when the tooltip container is clamped.
 *
 * 3. Shared Warm-up Tracker for Instant Hover Switching:
 *    Tracks the timestamp of the last active tooltip (`globalLastTooltipTimestamp`).
 *    If the user moves the pointer between adjacent tooltip targets within 450ms,
 *    the delay drops from 150ms to 25ms, delivering a snappy, native-feeling UI.
 *
 * 4. Flexible Content Projection:
 *    Accepts strings, JSX elements, or lazy evaluation functions `() => ReactNode`
 *    so heavy preview generation (thumbnails, canvas nodes, markdown parsing)
 *    only executes when the tooltip actually mounts/opens.
 *
 * 5. Strict TypeScript & React 18/19 Ref Safety:
 *    Safely clones trigger child element while preserving existing refs, event
 *    listeners (`onMouseEnter`, `onMouseLeave`, `onClick`), and accessibility attributes.
 * ============================================================================
 */

import React, {
  useState,
  useRef,
  cloneElement,
  useMemo,
  useLayoutEffect,
  ReactElement,
  ReactNode,
  CSSProperties,
  MouseEvent
} from 'react'
import { createPortal } from 'react-dom'
import './ToolTip.css'

/**
 * Global timestamp recording the dismissal time of the most recent tooltip.
 * Enables zero-delay "warm-up" hovering across sibling toolbar/list items.
 */
let globalLastTooltipTimestamp = 0

export type ToolTipPosition = 'top' | 'bottom' | 'left' | 'right'

export type ToolTipContent =
  | string
  | ReactNode
  | (() => ReactNode | string | null | undefined)
  | null
  | undefined

export interface ToolTipProps {
  /** Text, JSX content, or lazy function returning content */
  text?: ToolTipContent
  /** Single child element that triggers the tooltip on hover */
  children: ReactElement<any>
  /** Preferred placement relative to the trigger element */
  position?: ToolTipPosition
  /** Milliseconds before showing on cold hover (default: 150ms) */
  delay?: number
  /** Additional CSS class applied to the portal container */
  className?: string
  /** Custom max width override */
  maxWidth?: number | string
  /** Whether tooltip is disabled */
  disabled?: boolean
}

interface TooltipCoordinates {
  top: string
  bottom: string
  left: string
  right: string
  transform: string
  isTop: boolean
  isBottom: boolean
  isLeft: boolean
  isRight: boolean
  arrowPos: CSSProperties
}

export const ToolTip: React.FC<ToolTipProps> = ({
  text,
  children,
  position = 'top',
  delay = 150,
  className = '',
  maxWidth,
  disabled = false
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false)
  const [coords, setCoords] = useState<TooltipCoordinates | null>(null)
  const childRef = useRef<HTMLElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resolve lazy or raw content only when needed
  const rawText = useMemo(() => {
    if (!text || disabled) return null
    if (typeof text === 'function') {
      return isVisible ? text() : null
    }
    return text
  }, [text, isVisible, disabled])

  // Format string tooltips (handles "(Shortcut)" badge extraction cleanly)
  const formattedContent = useMemo(() => {
    if (!rawText) return null
    if (React.isValidElement(rawText)) return rawText
    if (typeof rawText !== 'string') return rawText

    const MAX_TOOLTIP_CHARS = 120
    const match = rawText.match(/^(.*?)(?:\s*\(([^)]+)\))?$/)
    if (match && match[2]) {
      const labelText =
        match[1].length > MAX_TOOLTIP_CHARS
          ? match[1].slice(0, MAX_TOOLTIP_CHARS - 1).trim() + '…'
          : match[1]
      return (
        <span className="tooltip-content-wrap">
          <span className="tooltip-label">{labelText}</span>
          <kbd className="tooltip-kbd">{match[2]}</kbd>
        </span>
      )
    }

    const displayText =
      rawText.length > MAX_TOOLTIP_CHARS
        ? rawText.slice(0, MAX_TOOLTIP_CHARS - 1).trim() + '…'
        : rawText

    return <span className="tooltip-label">{displayText}</span>
  }, [rawText])

  /**
   * Calculates anchor coordinates and boundary-safe positioning on hover.
   */
  const handleMouseEnter = (e: MouseEvent<HTMLElement>) => {
    const childProps = children?.props as any
    if (childProps?.onMouseEnter) {
      childProps.onMouseEnter(e)
    }
    if (disabled || !text) return

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    // Warm-up check: was another tooltip open less than 450ms ago?
    const isWarmedUp = Date.now() - globalLastTooltipTimestamp < 450
    const effectiveDelay = isWarmedUp ? 25 : delay

    timeoutRef.current = setTimeout(() => {
      if (!childRef.current) return

      const rect = childRef.current.getBoundingClientRect()
      const gap = 8

      let isTop = position.startsWith('top')
      let isBottom = position.startsWith('bottom')
      let isLeft = position === 'left'
      let isRight = position === 'right'

      if (!isTop && !isBottom && !isLeft && !isRight) {
        isTop = true
      }

      // Edge flipping: flip vertical placement if clipped by viewport boundaries
      if (isTop && rect.top < 40) {
        isTop = false
        isBottom = true
      } else if (isBottom && rect.bottom > window.innerHeight - 40) {
        isTop = true
        isBottom = false
      }

      let topStyle = 'auto'
      let bottomStyle = 'auto'
      let leftStyle = 'auto'
      let rightStyle = 'auto'
      let transformStyle = 'none'
      let arrowPos: CSSProperties = {}

      if (isTop) {
        bottomStyle = `${Math.round(window.innerHeight - rect.top + gap)}px`
        arrowPos = { bottom: '-3px' }
      } else if (isBottom) {
        topStyle = `${Math.round(rect.bottom + gap)}px`
        arrowPos = { top: '-3px' }
      }

      const elemCenterX = rect.left + rect.width / 2
      const elemCenterY = rect.top + rect.height / 2

      if (isLeft) {
        topStyle = `${Math.round(elemCenterY)}px`
        rightStyle = `${Math.round(window.innerWidth - rect.left + gap)}px`
        transformStyle = 'translateY(-50%)'
        arrowPos = { right: '-3px', top: '50%', marginTop: '-3px' }
      } else if (isRight) {
        // If nested within a sidebar container, dock to sidebar outer edge cleanly
        const sidebarContainer = childRef.current.closest(
          '.shell-sidebar-left, aside, .app-sidebar, .sidebar, .sidebar-body, .sidebar-nav, .file-explorer-sidebar, .left-sidebar, .unified-sidebar, .sidebar-scrollable-content'
        )
        const effectiveRight = sidebarContainer
          ? sidebarContainer.getBoundingClientRect().right
          : rect.right

        leftStyle = `${Math.round(effectiveRight + gap)}px`
        topStyle = `${Math.round(elemCenterY)}px`
        transformStyle = 'translateY(-50%)'
        arrowPos = { left: '-3px', top: '50%', marginTop: '-3px' }
      } else {
        // Top or bottom default center anchor
        leftStyle = `${Math.round(elemCenterX)}px`
        transformStyle = 'translateX(-50%)'
        arrowPos = { left: '50%', marginLeft: '-3px' }
      }

      setCoords({
        top: topStyle,
        bottom: bottomStyle,
        left: leftStyle,
        right: rightStyle,
        transform: transformStyle,
        isTop,
        isBottom,
        isLeft,
        isRight,
        arrowPos
      })
      globalLastTooltipTimestamp = Date.now()
      setIsVisible(true)
    }, effectiveDelay)
  }

  const handleMouseLeave = (e: MouseEvent<HTMLElement>) => {
    const childProps = children?.props as any
    if (childProps?.onMouseLeave) {
      childProps.onMouseLeave(e)
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (isVisible) {
      globalLastTooltipTimestamp = Date.now()
    }
    setIsVisible(false)
  }

  const handleClick = (e: MouseEvent<HTMLElement>) => {
    const childProps = children?.props as any
    if (childProps?.onClick) {
      childProps.onClick(e)
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsVisible(false)
  }

  /**
   * Post-render collision correction:
   * Keeps tooltip within viewport bounds and ensures the arrow pointer
   * stays aligned with the trigger center even when shifted.
   */
  useLayoutEffect(() => {
    if (!isVisible || !tooltipRef.current || !childRef.current || !coords) return

    const tooltipEl = tooltipRef.current
    const tooltipRect = tooltipEl.getBoundingClientRect()
    const targetRect = childRef.current.getBoundingClientRect()
    const arrowEl = tooltipEl.querySelector<HTMLElement>('.tooltip-arrow')
    const margin = 8

    if (coords.isTop || coords.isBottom) {
      const elemCenterX = targetRect.left + targetRect.width / 2
      const halfWidth = tooltipRect.width / 2
      const minCenter = margin + halfWidth
      const maxCenter = window.innerWidth - margin - halfWidth

      if (elemCenterX < minCenter) {
        tooltipEl.style.left = `${Math.round(minCenter)}px`
        if (arrowEl) {
          const arrowX = Math.max(6, Math.min(tooltipRect.width - 6, elemCenterX - margin))
          arrowEl.style.left = `${Math.round(arrowX)}px`
          arrowEl.style.marginLeft = '-3px'
        }
      } else if (elemCenterX > maxCenter) {
        tooltipEl.style.left = `${Math.round(maxCenter)}px`
        const tooltipLeft = maxCenter - halfWidth
        if (arrowEl) {
          const arrowX = Math.max(6, Math.min(tooltipRect.width - 6, elemCenterX - tooltipLeft))
          arrowEl.style.left = `${Math.round(arrowX)}px`
          arrowEl.style.marginLeft = '-3px'
        }
      }
    } else if (coords.isRight || coords.isLeft) {
      const elemCenterY = targetRect.top + targetRect.height / 2
      const halfHeight = tooltipRect.height / 2
      const minCenter = margin + halfHeight
      const maxCenter = window.innerHeight - margin - halfHeight

      if (elemCenterY < minCenter) {
        tooltipEl.style.top = `${Math.round(minCenter)}px`
        if (arrowEl) {
          const arrowY = Math.max(6, Math.min(tooltipRect.height - 6, elemCenterY - margin))
          arrowEl.style.top = `${Math.round(arrowY)}px`
          arrowEl.style.marginTop = '-3px'
        }
      } else if (elemCenterY > maxCenter) {
        tooltipEl.style.top = `${Math.round(maxCenter)}px`
        const tooltipTop = maxCenter - halfHeight
        if (arrowEl) {
          const arrowY = Math.max(6, Math.min(tooltipRect.height - 6, elemCenterY - tooltipTop))
          arrowEl.style.top = `${Math.round(arrowY)}px`
          arrowEl.style.marginTop = '-3px'
        }
      }
    }
  }, [isVisible, coords])

  if (!React.isValidElement(children) || !text || disabled) {
    return children
  }

  const childProps = children.props as any
  const ariaLabelVal =
    childProps?.['aria-label'] ||
    childProps?.title ||
    (typeof text === 'string' ? text.trim() : undefined)

  // In React 19, ref is a regular prop on props. Check childProps.ref first without triggering element.ref getter warning.
  let existingRef = childProps?.ref
  if (!existingRef && typeof children === 'object' && children !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(children, 'ref')
    if (descriptor && !descriptor.get) {
      existingRef = (children as any).ref
    }
  }

  const clonedChild = cloneElement(children as ReactElement<any>, {
    ref: (node: HTMLElement | null) => {
      childRef.current = node
      if (typeof existingRef === 'function') {
        existingRef(node)
      } else if (existingRef && typeof existingRef === 'object' && 'current' in existingRef) {
        existingRef.current = node
      }
    },
    title: undefined, // Suppress OS browser tooltip
    'aria-label': ariaLabelVal,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onClick: handleClick
  })

  return (
    <>
      {clonedChild}
      {isVisible &&
        coords &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`tooltip-portal ${
              coords.isTop
                ? 'tooltip-pos-top'
                : coords.isBottom
                  ? 'tooltip-pos-bottom'
                  : coords.isLeft
                    ? 'tooltip-pos-left'
                    : 'tooltip-pos-right'
            } ${className}`.trim()}
            style={{
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              right: coords.right,
              transform: coords.transform,
              ...(maxWidth ? { maxWidth } : {})
            }}
            role="tooltip"
          >
            {formattedContent}
            <div className="tooltip-arrow" style={coords.arrowPos} />
          </div>,
          document.body
        )}
    </>
  )
}

export default React.memo(ToolTip)
