import React, { useState, useRef, cloneElement } from 'react'
import { createPortal } from 'react-dom'
import './ToolTip.css'

const ToolTip = ({ text, children, position = 'top', delay = 300 }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, right: 'auto' })
  const childRef = useRef(null)
  const timeoutRef = useRef(null)

  const handleMouseEnter = (e) => {
    if (children.props.onMouseEnter) {
      children.props.onMouseEnter(e)
    }
    timeoutRef.current = setTimeout(() => {
      if (childRef.current) {
        const rect = childRef.current.getBoundingClientRect()
        let top = 0
        let left = 'auto'
        let right = 'auto'
        
        // Add a slight gap
        const gap = 6
        
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
    if (children.props.onMouseLeave) {
      children.props.onMouseLeave(e)
    }
    clearTimeout(timeoutRef.current)
    setIsVisible(false)
  }

  const handleClick = (e) => {
    if (children.props.onClick) {
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
      {isVisible && createPortal(
        <div 
          className={`tooltip-portal tooltip-${position}`}
          style={{ top: coords.top, left: coords.left, right: coords.right }}
        >
          {text}
        </div>,
        document.body
      )}
    </>
  )
}

export default ToolTip
