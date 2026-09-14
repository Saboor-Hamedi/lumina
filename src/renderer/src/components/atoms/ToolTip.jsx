import React, { useState, useRef, cloneElement, useMemo, useLayoutEffect } from 'react'
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
  const tooltipRef = useRef(null)
  const timeoutRef = useRef(null)

  const rawText = useMemo(() => {
    if (!text) return null
    if (typeof text === 'function') {
      return isVisible ? text() : null
    }
    return text
  }, [text, isVisible])

  const formattedContent = useMemo(() => {
    if (!rawText) return null
    if (React.isValidElement(rawText)) return rawText
    if (typeof rawText !== 'string') return rawText

    // Prevent absurdly long single-line titles by truncating if longer than 120 chars
    const MAX_TOOLTIP_CHARS = 120
    const match = rawText.match(/^(.*?)(?:\s*\(([^)]+)\))?$/)
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

    const displayText = rawText.length > MAX_TOOLTIP_CHARS
      ? rawText.slice(0, MAX_TOOLTIP_CHARS - 1).trim() + '…'
      : rawText

    return <span className="tooltip-label">{displayText}</span>
  }, [rawText])

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
            '.shell-sidebar-left, aside, .app-sidebar, .sidebar, .sidebar-body, .sidebar-nav, .start-menu-panel, .start-menu-left, .file-explorer-sidebar, .left-sidebar, .explorer-panel, .unified-sidebar, .sidebar-scrollable-content, .start-menu-modal, .start-menu-body'
          )
          const effectiveRight = sidebarContainer
            ? sidebarContainer.getBoundingClientRect().right
            : rect.right

          leftStyle = `${Math.round(effectiveRight + gap)}px`
          topStyle = `${Math.round(elemCenterY)}px`
          transformStyle = 'translateY(-50%)'
          arrowPos = { left: '-3px', top: '50%', marginTop: '-3px' }
        } else {
          // Standard top or bottom positioning centered on target element
          leftStyle = `${Math.round(elemCenterX)}px`
          transformStyle = 'translateX(-50%)'
          arrowPos.left = '50%'
          arrowPos.marginLeft = '-3px'
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

  useLayoutEffect(() => {
    if (!isVisible || !tooltipRef.current || !childRef.current) return

    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const targetRect = childRef.current.getBoundingClientRect()

    if (coords?.isTop || coords?.isBottom) {
      const elemCenterX = targetRect.left + targetRect.width / 2
      const halfWidth = tooltipRect.width / 2
      const minCenter = 8 + halfWidth
      const maxCenter = window.innerWidth - 8 - halfWidth

      if (elemCenterX < minCenter) {
        // Shift tooltip right so it stays on screen with 8px margin
        tooltipRef.current.style.left = `${Math.round(minCenter)}px`
        // Point arrow to target element center
        const arrowX = Math.max(6, Math.min(tooltipRect.width - 6, elemCenterX - 8))
        const arrowEl = tooltipRef.current.querySelector('.tooltip-arrow')
        if (arrowEl) {
          arrowEl.style.left = `${Math.round(arrowX)}px`
          arrowEl.style.marginLeft = '-3px'
        }
      } else if (elemCenterX > maxCenter) {
        // Shift tooltip left so it stays on screen with 8px margin
        tooltipRef.current.style.left = `${Math.round(maxCenter)}px`
        const tooltipLeft = maxCenter - halfWidth
        const arrowX = Math.max(6, Math.min(tooltipRect.width - 6, elemCenterX - tooltipLeft))
        const arrowEl = tooltipRef.current.querySelector('.tooltip-arrow')
        if (arrowEl) {
          arrowEl.style.left = `${Math.round(arrowX)}px`
          arrowEl.style.marginLeft = '-3px'
        }
      }
    } else if (coords?.isRight || coords?.isLeft) {
      const elemCenterY = targetRect.top + targetRect.height / 2
      const halfHeight = tooltipRect.height / 2
      const minCenter = 8 + halfHeight
      const maxCenter = window.innerHeight - 8 - halfHeight

      if (elemCenterY < minCenter) {
        // Shift tooltip down so top stays at 8px
        tooltipRef.current.style.top = `${Math.round(minCenter)}px`
        const arrowY = Math.max(6, Math.min(tooltipRect.height - 6, elemCenterY - 8))
        const arrowEl = tooltipRef.current.querySelector('.tooltip-arrow')
        if (arrowEl) {
          arrowEl.style.top = `${Math.round(arrowY)}px`
          arrowEl.style.marginTop = '-3px'
        }
      } else if (elemCenterY > maxCenter) {
        // Shift tooltip up so bottom stays at window.innerHeight - 8
        tooltipRef.current.style.top = `${Math.round(maxCenter)}px`
        const tooltipTop = maxCenter - halfHeight
        const arrowY = Math.max(6, Math.min(tooltipRect.height - 6, elemCenterY - tooltipTop))
        const arrowEl = tooltipRef.current.querySelector('.tooltip-arrow')
        if (arrowEl) {
          arrowEl.style.top = `${Math.round(arrowY)}px`
          arrowEl.style.marginTop = '-3px'
        }
      }
    }
  }, [isVisible, coords])

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
            ref={tooltipRef}
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
