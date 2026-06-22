import React, { memo } from 'react'
import { Settings, Palette, ArrowUpCircle, RefreshCw } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { useUpdateStore } from '../../../core/store/useUpdateStore'

const SidebarFooter = memo(({ onThemeClick, onSettingsClick }) => {
  const { status, progress, download, install } = useUpdateStore()

  const handleUpdateClick = () => {
    if (status === 'available') download()
    if (status === 'ready') install()
  }

  return (
    <div className="sidebar-footer-section">
      <div className="sidebar-footer-actions">
        {(status === 'available' || status === 'downloading' || status === 'ready' || status === 'error' || status === 'checking') && (
          <ToolTip text={status === 'downloading' ? `Downloading... ${Math.round(progress?.percent || 0)}%` : 'Update Lumina'}>
            <button 
              className={`sidebar-icon-btn update-btn ${status === 'downloading' ? 'loading' : ''} ${status === 'error' ? 'error' : ''}`}
              onClick={status === 'error' ? () => useUpdateStore.getState().check() : handleUpdateClick}
            >
              {status === 'ready' || status === 'checking' ? (
                <RefreshCw size={14} className={status === 'checking' ? 'spin-slow checking-spin' : 'spin-slow'} />
              ) : (
                <ArrowUpCircle size={14} color={status === 'error' ? '#ef4444' : undefined} />
              )}
            </button>
          </ToolTip>
        )}

        <ToolTip text="Theme (Ctrl+T)">
          <button className="sidebar-icon-btn" onClick={onThemeClick}>
            <Palette size={14} />
          </button>
        </ToolTip>

        <ToolTip text="Settings (Ctrl+,)">
          <button className="sidebar-icon-btn" onClick={onSettingsClick}>
            <Settings size={14} />
          </button>
        </ToolTip>
      </div>
    </div>
  )
})

SidebarFooter.displayName = 'SidebarFooter'

export default SidebarFooter
