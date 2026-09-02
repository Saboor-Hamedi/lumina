import React, { useState, useRef, cloneElement, useMemo } from 'react'
import { createPortal } from 'react-dom'
import './ToolTip.css'

/**
 * Ultra-Smooth High-Precision ToolTip component with dynamic collision detection,
 * speech bubble arrow knob alignment, and zero-background shortcut styling.
 */
const ToolTip = ({ text, children, position = 'top', delay = 150 }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState(null)
  const childRef = useRef(null)
  const timeoutRef = useRef(null)

  const formattedContent = useMemo(() => {
    if (!text || typeof text !== 'string') return text
    const match = text.match(/^(.*?)(?:\s*\(([^)]+)\))?$/)
    if (match && match[2]) {
      return (
        <span className="tooltip-content-wrap">
          <span className="tooltip-label">{match[1]}</span>
          <kbd className="tooltip-kbd">{match[2]}</kbd>
        </span>
      )
    }
    return <span className="tooltip-label">{text}</span>
  }, [text])

  const handleMouseEnter = (e) => {
    if (children?.props?.onMouseEnter) {
      children.props.onMouseEnter(e)
    }
    clearTimeout(timeoutRef.current)
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
          arrowPos = { bottom: '-4px' }
        } else if (isBottom) {
          topStyle = `${Math.round(rect.bottom + gap)}px`
          arrowPos = { top: '-4px' }
        }

        const elemCenterX = rect.left + rect.width / 2

        if (isLeft) {
          topStyle = `${Math.round(rect.top + rect.height / 2)}px`
          rightStyle = `${Math.round(window.innerWidth - rect.left + gap)}px`
          transformStyle = 'translateY(-50%)'
          arrowPos = { right: '-4px', top: '50%', marginTop: '-3px' }
        } else if (isRight) {
          topStyle = `${Math.round(rect.top + rect.height / 2)}px`
          leftStyle = `${Math.round(rect.right + gap)}px`
          transformStyle = 'translateY(-50%)'
          arrowPos = { left: '-4px', top: '50%', marginTop: '-3px' }
        } else {
          // Horizontal alignment for Top & Bottom tooltips:
          // Check if hovering near right window edge (e.g. TitleBar close icon, Inspector toggles, StatusBar right items)
          if (elemCenterX > window.innerWidth - 130) {
            const rightPad = Math.max(8, window.innerWidth - rect.right)
            rightStyle = `${Math.round(rightPad)}px`
            transformStyle = 'none'
            // Align arrow knob right over the center of the hovered element
            const knobRight = Math.max(10, Math.round(rect.right - elemCenterX + 8))
            arrowPos.right = `${knobRight}px`
          } else if (elemCenterX < 130) {
            // Near left window edge
            const leftPad = Math.max(8, rect.left)
            leftStyle = `${Math.round(leftPad)}px`
            transformStyle = 'none'
            const knobLeft = Math.max(10, Math.round(elemCenterX - rect.left + 8))
            arrowPos.left = `${knobLeft}px`
          } else {
            // Centered
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
        setIsVisible(true)
      }
    }, delay)
  }

  const handleMouseLeave = (e) => {
    if (children?.props?.onMouseLeave) {
      children.props.onMouseLeave(e)
    }
    clearTimeout(timeoutRef.current)
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

  const clonedChild = cloneElement(children, {
    ref: (node) => {
      childRef.current = node
      const ref = children.props.ref
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    title: undefined,
    'aria-label': typeof text === 'string' ? text.replace(/\s*\([^)]+\)$/, '').trim() : undefined,
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
