import React, { memo } from 'react'
import FileExplorer from '../Explorer/FileExplorer'
import SidebarHeader from './components/SidebarHeader'
import SidebarFooter from './components/SidebarFooter'
import './Sidebar.css'

const Sidebar = memo(({ onSettingsClick, onThemeClick, onToggleGraph, onToggleAIChat }) => {
  return (
    <div className="unified-sidebar">
      {/* Top Header Section */}
      <SidebarHeader 
        onToggleGraph={onToggleGraph} 
        onToggleAIChat={onToggleAIChat} 
      />

      {/* Middle Scrollable Section (FileExplorer) */}
      <div className="sidebar-scrollable-content">
        <FileExplorer isEmbedded={true} />
      </div>

      {/* Bottom Footer Section */}
      <SidebarFooter 
        onSettingsClick={onSettingsClick} 
        onThemeClick={onThemeClick} 
      />
    </div>
  )
})

Sidebar.displayName = 'Sidebar'

export default Sidebar
