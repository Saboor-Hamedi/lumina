import React, { useState, useRef, cloneElement, useMemo } from 'react'
import { createPortal } from 'react-dom'
import './ToolTip.css'

// Shared warm-up tracker across all tooltips for instant hover switching
let globalLastTooltipTimestamp = 0

/**
 * Ultra-Smooth High-Precision ToolTip component with dynamic collision detection,
 * speech bubble arrow knob alignment, instant warm-up tracking, and zero-background shortcut styling.
 */
const ToolTip = ({ text, children, position = 'top', delay = 150 }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState(null)
  const childRef = useRef(null)
  const timeoutRef = useRef(null)

  const formattedContent = useMemo(() => {
    if (!text) return null
    if (React.isValidElement(text)) return text
    if (typeof text !== 'string') return text

    // Prevent absurdly long single-line titles by truncating if longer than 120 chars
    const MAX_TOOLTIP_CHARS = 120
    const match = text.match(/^(.*?)(?:\s*\(([^)]+)\))?$/)
    if (match && match[2]) {
      const labelText = match[1].length > MAX_TOOLTIP_CHARS
        ? match[1].slice(0, MAX_TOOLTIP_CHARS - 1).trim() + '…'
        : match[1]
      return (
        <span className="tooltip-content-wrap">
          <span className="tooltip-label">{labelText}</span>
          <kbd className="tooltip-kbd">{match[2]}</kbd>
        </span>
      )
    }

    const displayText = text.length > MAX_TOOLTIP_CHARS
      ? text.slice(0, MAX_TOOLTIP_CHARS - 1).trim() + '…'
      : text

    return <span className="tooltip-label">{displayText}</span>
  }, [text])

  const handleMouseEnter = (e) => {
    if (children?.props?.onMouseEnter) {
      children.props.onMouseEnter(e)
    }
    clearTimeout(timeoutRef.current)

    const isWarmedUp = Date.now() - globalLastTooltipTimestamp < 450
    const effectiveDelay = isWarmedUp ? 25 : delay

    timeoutRef.current = setTimeout(() => {
      if (childRef.current) {
        const rect = childRef.current.getBoundingClientRect()
        const gap = 8

        let isTop = position.startsWith('top')
        let isBottom = position.startsWith('bottom')
        let isLeft = position === 'left'
        let isRight = position === 'right'

        if (!isTop && !isBottom && !isLeft && !isRight) {
          isTop = true
        }

        // Screen boundary detection: Flip if near top/bottom screen edges
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
        let arrowPos = {}

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
          const sidebarContainer = childRef.current.closest(
            '.shell-sidebar-left, aside, .app-sidebar, .sidebar, .sidebar-body, .sidebar-nav, .start-menu-panel, .start-menu-left, .file-explorer-sidebar, .left-sidebar, .explorer-panel'
          )
          const effectiveRight = sidebarContainer
            ? sidebarContainer.getBoundingClientRect().right
            : rect.right

          leftStyle = `${Math.round(effectiveRight + gap)}px`

          if (elemCenterY < 80) {
            topStyle = '16px'
            transformStyle = 'none'
            const knobTop = Math.max(12, Math.round(elemCenterY - 16))
            arrowPos = { left: '-3px', top: `${knobTop}px` }
          } else if (elemCenterY > window.innerHeight - 100) {
            bottomStyle = '16px'
            topStyle = 'auto'
            transformStyle = 'none'
            const knobBottom = Math.max(12, Math.round(window.innerHeight - elemCenterY - 16))
            arrowPos = { left: '-3px', bottom: `${knobBottom}px` }
          } else {
            topStyle = `${Math.round(elemCenterY)}px`
            transformStyle = 'translateY(-50%)'
            arrowPos = { left: '-3px', top: '50%', marginTop: '-3px' }
          }
        } else {
          // Standard top or bottom positioning with viewport edge protection:
          // Estimate half-width buffer (170px for 320px max-width + margin)
          const halfWidthBuffer = 170
          if (elemCenterX + halfWidthBuffer > window.innerWidth) {
            rightStyle = '12px'
            transformStyle = 'none'
            const knobRight = Math.max(8, Math.min(300, Math.round(window.innerWidth - elemCenterX - 12)))
            arrowPos.right = `${knobRight}px`
          } else if (elemCenterX - halfWidthBuffer < 0) {
            leftStyle = '12px'
            transformStyle = 'none'
            const knobLeft = Math.max(8, Math.min(300, Math.round(elemCenterX - 12)))
            arrowPos.left = `${knobLeft}px`
          } else {
            leftStyle = `${Math.round(elemCenterX)}px`
            transformStyle = 'translateX(-50%)'
            arrowPos.left = '50%'
            arrowPos.marginLeft = '-3px'
          }
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
      }
    }, effectiveDelay)
  }

  const handleMouseLeave = (e) => {
    if (children?.props?.onMouseLeave) {
      children.props.onMouseLeave(e)
    }
    clearTimeout(timeoutRef.current)
    if (isVisible) {
      globalLastTooltipTimestamp = Date.now()
    }
    setIsVisible(false)
  }

  const handleClick = (e) => {
    if (children?.props?.onClick) {
      children.props.onClick(e)
    }
    clearTimeout(timeoutRef.current)
    setIsVisible(false)
  }

  if (!React.isValidElement(children) || !text) {
    return children
  }

  const ariaLabelVal = children.props['aria-label'] || children.props.title || (typeof text === 'string' ? text.trim() : undefined)

  const clonedChild = cloneElement(children, {
    ref: (node) => {
      childRef.current = node
      const ref = children.props.ref
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    title: undefined, // Suppress default browser tooltip so only our custom tooltip renders
    'aria-label': ariaLabelVal,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onClick: handleClick
  })

  return (
    <>
      {clonedChild}
      {isVisible && coords &&
        createPortal(
          <div
            className={`tooltip-portal ${coords.isTop ? 'tooltip-pos-top' : coords.isBottom ? 'tooltip-pos-bottom' : coords.isLeft ? 'tooltip-pos-left' : 'tooltip-pos-right'}`}
            style={{
              top: coords.top,
              bottom: coords.bottom,
              left: coords.left,
              right: coords.right,
              transform: coords.transform
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
