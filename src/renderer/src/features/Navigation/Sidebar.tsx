/**
 * Sidebar.tsx
 * 
 * Primary Collapsible Left Sidebar for Lumina.
 * 
 * Architecture & Responsibilities:
 * - Hosts the embedded FileExplorer vault tree, tags, favorites, and quick workspace actions.
 * - Bridges layout resizing and curtain gestures between MainLayout and FileExplorer.
 * - Pure TypeScript with GPU-accelerated scroll containment (`.sidebar-scrollable-content`).
 */

import React, { memo } from 'react'
import FileExplorer from '../Explorer/FileExplorer'
import './css/sidebar.css'

export interface SidebarProps {
  className?: string
}

const Sidebar: React.FC<SidebarProps> = memo(() => {
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
