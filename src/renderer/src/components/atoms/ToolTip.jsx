import React, { useState, useRef, cloneElement, useMemo } from 'react'
import { createPortal } from 'react-dom'
import './ToolTip.css'

/**
 * Enhanced ToolTip component with speech bubble arrow knob and shortcut badge support.
 */
const ToolTip = ({ text, children, position = 'top', delay = 200 }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, right: 'auto' })
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
    timeoutRef.current = setTimeout(() => {
      if (childRef.current) {
        const rect = childRef.current.getBoundingClientRect()
        let top = 0
        let left = 'auto'
        let right = 'auto'

        const gap = 8

        if (position === 'top') {
          top = rect.top - gap
          left = rect.left + rect.width / 2
        } else if (position === 'bottom') {
          top = rect.bottom + gap
          left = rect.left + rect.width / 2
        } else if (position === 'bottom-right') {
          top = rect.bottom + gap
          left = 'auto'
          right = window.innerWidth - rect.right
        } else if (position === 'left') {
          top = rect.top + rect.height / 2
          left = rect.left - gap
        } else if (position === 'right') {
          top = rect.top + rect.height / 2
          left = rect.right + gap
        }

        setCoords({ top, left, right })
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
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onClick: handleClick
  })

  return (
    <>
      {clonedChild}
      {isVisible &&
        createPortal(
          <div
            className={`tooltip-portal tooltip-${position}`}
            style={{ top: coords.top, left: coords.left, right: coords.right }}
            role="tooltip"
          >
            {formattedContent}
            <div className="tooltip-arrow" />
          </div>,
          document.body
        )}
    </>
  )
}

export default React.memo(ToolTip)
