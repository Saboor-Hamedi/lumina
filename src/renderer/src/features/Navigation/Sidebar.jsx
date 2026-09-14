import React, { memo } from 'react'
import FileExplorer from '../Explorer/FileExplorer'
import './css/sidebar.css'

const Sidebar = memo(() => {
  return (
    <div className="unified-sidebar">
      <div className="sidebar-scrollable-content">
        <FileExplorer isEmbedded={true} />
      </div>
    </div>
  )
})

Sidebar.displayName = 'Sidebar'
export default Sidebar
