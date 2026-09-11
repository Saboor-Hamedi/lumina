import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Square, Copy, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import ToolTip from '../../components/atoms/ToolTip'
import SettingTab from './SettingTab'
import SettingLookAndFeel from './SettingLookAndFeel'
import SettingAssistant from './SettingAssistant'
import SettingMemory from './SettingMemory'
import SettingShortcuts from './SettingShortcuts'
import SettingAdvanced from './SettingAdvanced'
import './Settings.css'

const TAB_LABELS = {
  'look-and-feel': 'Look & Feel',
  shortcuts: 'Shortcuts',
  assistant: 'Lumina AI Assistant',
  memory: 'AI Memory',
  advanced: 'Advanced'
}

const Settings = ({ onClose, onOpenTheme, initialTab = 'look-and-feel' }) => {
  const mapInitialTab = (tab) => {
    if (tab === 'shortcuts') return 'shortcuts'
    if (['graph', 'advanced'].includes(tab)) return 'advanced'
    if (['ai', 'assistant'].includes(tab)) return 'assistant'
    if (['memory', 'ai-memory'].includes(tab)) return 'memory'
    if (['look-and-feel', 'appearance', 'type', 'general'].includes(tab)) return 'look-and-feel'
    return 'look-and-feel'
  }

  const [activeTab, setActiveTab] = useState(mapInitialTab(initialTab))
  const [isMaximized, setIsMaximized] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isDraggingModal, setIsDraggingModal] = useState(false)

  const containerRef = useRef(null)
  const modalPos = useRef({ x: 0, y: 0 })
  const dragStart = useRef({ x: 0, y: 0 })
  const rafId = useRef(null)

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev)
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  // Drag logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingModal || isMaximized) return

      const newX = e.clientX - dragStart.current.x
      const newY = e.clientY - dragStart.current.y
      modalPos.current = { x: newX, y: newY }

      if (rafId.current) cancelAnimationFrame(rafId.current)

      rafId.current = requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`
        }
      })
    }

    const handleMouseUp = () => {
      setIsDraggingModal(false)
      if (rafId.current) cancelAnimationFrame(rafId.current)
      if (containerRef.current && !isMaximized) {
        containerRef.current.style.transition = '0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [isMaximized, isDraggingModal])

  const handleModalHeaderMouseDown = useCallback(
    (e) => {
      if (isMaximized) return
      setIsDraggingModal(true)

      if (containerRef.current) {
        containerRef.current.style.transition = 'none'
      }

      dragStart.current = {
        x: e.clientX - modalPos.current.x,
        y: e.clientY - modalPos.current.y
      }
    },
    [isMaximized]
  )

  useKeyboardShortcuts({
    onEscape: () => {
      if (onClose) {
        onClose()
        return true
      }
      return false
    }
  })

  return (
    <div className="nexus-overlay preview-overlay-glass settings-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className={`modal-container settings-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          flexDirection: 'column',
          width: isMaximized ? '100vw' : '900px',
          height: isMaximized ? '100vh' : '76vh',
          maxWidth: isMaximized ? 'none' : '94vw',
          minHeight: isMaximized ? 'none' : '480px',
          maxHeight: isMaximized ? 'none' : '78vh',
          transform: isMaximized
            ? 'none'
            : `translate3d(${modalPos.current.x}px, ${modalPos.current.y}px, 0)`,
          transition: '0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          borderRadius: isMaximized ? '0' : '12px'
        }}
      >
        <div
          className="settings-modal-header"
          onMouseDown={handleModalHeaderMouseDown}
          style={{ cursor: isMaximized ? 'default' : 'grab' }}
        >
          <div className="settings-header-left">
            <ToolTip text={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'} position="bottom">
              <button
                className="settings-sidebar-toggle-btn"
                onClick={handleToggleSidebar}
                aria-label={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
              >
                {isSidebarOpen ? (
                  <PanelLeftClose size={15} strokeWidth={2} />
                ) : (
                  <PanelLeftOpen size={15} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
            <span className="settings-header-title">
              Settings
            </span>
            <span className="settings-header-divider">/</span>
            <span className="settings-header-subtitle">
              {TAB_LABELS[activeTab] || 'Preferences'}
            </span>
          </div>

          <div className="settings-header-right">
            <ToolTip text={isMaximized ? 'Restore Window' : 'Maximize Window'} position="bottom">
              <button
                className="settings-window-btn"
                onClick={handleToggleMaximize}
                aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
              >
                {isMaximized ? (
                  <Copy size={13} strokeWidth={2} />
                ) : (
                  <Square size={13} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
            <ToolTip text="Close (Esc)" position="bottom">
              <button
                className="settings-close-btn"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </ToolTip>
          </div>
        </div>

        <div className={`settings-layout ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <SettingTab activeTab={activeTab} setActiveTab={setActiveTab} isOpen={isSidebarOpen} />

          <main className="settings-body seamless-scrollbar">
            <div className="settings-content-wrap">
              {activeTab === 'look-and-feel' && <SettingLookAndFeel onOpenTheme={onOpenTheme} />}
              {activeTab === 'assistant' && <SettingAssistant />}
              {activeTab === 'memory' && <SettingMemory />}
              {activeTab === 'shortcuts' && <SettingShortcuts />}
              {activeTab === 'advanced' && <SettingAdvanced />}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default React.memo(Settings)
