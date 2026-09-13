import React, { memo } from 'react'
import FileExplorer from '../Explorer/FileExplorer'
import SidebarHeader from './components/SidebarHeader'
import './css/sidebar.css'

const Sidebar = memo(({ onToggleGraph }) => {
  return (
    <div className="unified-sidebar">
      <SidebarHeader onToggleGraph={onToggleGraph} />

      <div className="sidebar-scrollable-content">
        <FileExplorer isEmbedded={true} />
      </div>
    </div>
  )
})

Sidebar.displayName = 'Sidebar'
export default Sidebar
