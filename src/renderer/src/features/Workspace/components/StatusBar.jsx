import React from 'react'
import { BookOpen, PanelRight, Keyboard } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import '../../../assets/statusbar.css'

const StatusBar = ({
  onToggleInspector,
  onDocsClick,
  onShortcutsClick
}) => {
  return (
    <div className="status-bar">
      {/* Left utility buttons */}
      <div className="status-bar-left">
        <ToolTip text="Toggle Details & Outline (Ctrl + \)" position="top">
          <button className="status-bar-btn" onClick={onToggleInspector}>
            <PanelRight size={12} />
            <span>Details</span>
          </button>
        </ToolTip>

        <span className="status-bar-divider" />

        <ToolTip text="Documentation (Ctrl + D)" position="top">
          <button className="status-bar-btn" onClick={onDocsClick}>
            <BookOpen size={12} />
            <span>Docs</span>
          </button>
        </ToolTip>

        <span className="status-bar-divider" />

        <ToolTip text="Keyboard Shortcuts (Ctrl + ? / Ctrl + /)" position="top">
          <button className="status-bar-btn" onClick={onShortcutsClick}>
            <Keyboard size={12} />
            <span>Shortcuts</span>
          </button>
        </ToolTip>
      </div>

      {/* Center & Right spacer */}
      <div className="status-bar-right" />
    </div>
  )
}

export default React.memo(StatusBar)
