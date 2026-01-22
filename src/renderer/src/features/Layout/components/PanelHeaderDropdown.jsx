import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Settings, Trash2, Download, BarChart3, MoreVertical } from 'lucide-react'
import './PanelHeaderDropdown.css'

/**
 * PanelHeaderDropdown Component
 * Dropdown menu for panel header actions
 */
const PanelHeaderDropdown = ({ 
  onOpenSettings, 
  onClearChat, 
  onExportChat,
  onViewStats,
  chatMessagesCount = 0 
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false)
      }
    }

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('click', handleClickOutside)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('click', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleToggle = (e) => {
    e.stopPropagation()
    setIsOpen(!isOpen)
  }

  const handleMenuItemClick = (action) => {
    if (action) {
      action()
    }
    setIsOpen(false)
  }

  const menuItems = [
    {
      label: 'AI Settings',
      icon: <Settings size={14} />,
      onClick: onOpenSettings,
      shortcut: null
    },
    {
      type: 'divider'
    },
    {
      label: 'Clear Chat History',
      icon: <Trash2 size={14} />,
      onClick: onClearChat,
      disabled: chatMessagesCount === 0,
      danger: true
    },
    {
      label: 'Export Chat',
      icon: <Download size={14} />,
      onClick: onExportChat,
      disabled: chatMessagesCount === 0
    },
    {
      label: 'View Statistics',
      icon: <BarChart3 size={14} />,
      onClick: onViewStats,
      disabled: chatMessagesCount === 0
    }
  ]

  // Calculate menu position
  const getMenuPosition = () => {
    if (!buttonRef.current) return { top: 0, right: 0 }
    
    const rect = buttonRef.current.getBoundingClientRect()
    return {
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right
    }
  }

  const menuPosition = isOpen ? getMenuPosition() : { top: 0, right: 0 }

  return (
    <>
      <button
        ref={buttonRef}
        className="panel-header-dropdown-btn"
        onClick={handleToggle}
        title="More options"
        aria-label="More options"
        aria-expanded={isOpen}
      >
        <MoreVertical size={14} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="panel-header-dropdown-menu"
          style={menuPosition}
          onClick={(e) => e.stopPropagation()}
        >
          {menuItems.map((item, index) => {
            if (item.type === 'divider') {
              return <div key={index} className="dropdown-divider" />
            }

            return (
              <button
                key={index}
                className={`dropdown-item ${item.danger ? 'danger' : ''}`}
                onClick={() => handleMenuItemClick(item.onClick)}
                disabled={item.disabled}
              >
                <span className="dropdown-item-icon">{item.icon}</span>
                <span className="dropdown-item-label">{item.label}</span>
                {item.shortcut && (
                  <span className="dropdown-item-shortcut">{item.shortcut}</span>
                )}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}

export default PanelHeaderDropdown
