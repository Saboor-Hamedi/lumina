import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Settings as SettingsIcon, Square, Copy, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import ModalHeader from '../modals/ModalHeader'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import SettingTab from './SettingTab'
import SettingLookAndFeel from './SettingLookAndFeel'
import SettingAssistant from './SettingAssistant'
import SettingShortcuts from './SettingShortcuts'
import SettingAdvanced from './SettingAdvanced'
import '../preview/preview.css'
import './Settings.css'

const Settings = ({ onClose, onOpenTheme, initialTab = 'look-and-feel' }) => {
  const mapInitialTab = (tab) => {
    if (tab === 'shortcuts') return 'shortcuts'
    if (['graph', 'advanced'].includes(tab)) return 'advanced'
    if (['ai', 'assistant'].includes(tab)) return 'assistant'
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
        containerRef.current.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
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
    <div className="nexus-overlay preview-overlay-glass" onClick={onClose}>
      <div
        ref={containerRef}
        className={`nexus-container modal-container preview-modal-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          flexDirection: 'column',
          width: isMaximized ? '100vw' : '92vw',
          height: isMaximized ? '100vh' : '88vh',
          maxWidth: isMaximized ? 'none' : '1100px',
          maxHeight: isMaximized ? 'none' : '90vh',
          transform: isMaximized
            ? 'none'
            : `translate3d(${modalPos.current.x}px, ${modalPos.current.y}px, 0)`,
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          borderRadius: isMaximized ? '0' : '6px'
        }}
      >
        <ModalHeader
          title="Settings"
          icon={<SettingsIcon size={16} />}
          onClose={onClose}
          onMouseDown={handleModalHeaderMouseDown}
          style={{ cursor: isMaximized ? 'default' : 'grab' }}
          left={
            <button
              className="win-btn"
              onClick={handleToggleSidebar}
              title={isSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
              style={{ marginLeft: '-10px' }}
            >
              {isSidebarOpen ? (
                <PanelLeftClose size={12} strokeWidth={2} />
              ) : (
                <PanelLeftOpen size={12} strokeWidth={2} />
              )}
            </button>
          }
          right={
            <button
              className="win-btn"
              onClick={handleToggleMaximize}
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <Copy size={12} strokeWidth={2} />
              ) : (
                <Square size={12} strokeWidth={2} />
              )}
            </button>
          }
        />

        <div className="settings-layout">
          {isSidebarOpen && <SettingTab activeTab={activeTab} setActiveTab={setActiveTab} />}

          <main className="settings-body seamless-scrollbar">
            <div className="settings-content-wrap">
              {activeTab === 'look-and-feel' && <SettingLookAndFeel onOpenTheme={onOpenTheme} />}
              {activeTab === 'assistant' && <SettingAssistant />}
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
