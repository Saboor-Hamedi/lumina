/**
 * Sidebar.tsx
 *
 * Primary Left Sidebar for Lumina.
 * Keeps Notes (FileExplorer), Themes, and Templates mounted as separate
 * independent view panes (VS Code style) so switching views never unmounts
 * or replaces the Notes tree state.
 */

import React, { memo, useEffect, useState } from 'react'
import FileExplorer from '../Explorer/FileExplorer'
import { useSettingsStore } from '../../core/store/SettingStore'
import {
  useSidebarViewStore,
  openSidebarView,
  closeLeftSidebar
} from './sidebarViewStore'
import './css/sidebar.css'

const Theme = React.lazy(() => import('../theme/Theme'))
const Template = React.lazy(() => import('../template/Template'))

export interface SidebarProps {
  className?: string
}

const Sidebar: React.FC<SidebarProps> = memo(() => {
  const activeView = useSidebarViewStore((s) => s.activeView)
  const isLeftOpen = useSettingsStore((s: any) => s.settings?.sidebar?.isLeftOpen ?? true)
  const [hasMountedTheme, setHasMountedTheme] = useState(() => activeView === 'theme')
  const [hasMountedTemplates, setHasMountedTemplates] = useState(() => activeView === 'templates')

  useEffect(() => {
    if (activeView === 'theme') setHasMountedTheme(true)
    if (activeView === 'templates') setHasMountedTemplates(true)
  }, [activeView])

  useEffect(() => {
    const handleOpenTheme = () => {
      openSidebarView('theme')
    }
    const handleOpenTemplate = () => {
      openSidebarView('templates')
    }

    window.addEventListener('open-theme-modal', handleOpenTheme)
    window.addEventListener('open-theme-sidebar', handleOpenTheme)
    window.addEventListener('open-template-modal', handleOpenTemplate)
    window.addEventListener('open-template-sidebar', handleOpenTemplate)

    return () => {
      window.removeEventListener('open-theme-modal', handleOpenTheme)
      window.removeEventListener('open-theme-sidebar', handleOpenTheme)
      window.removeEventListener('open-template-modal', handleOpenTemplate)
      window.removeEventListener('open-template-sidebar', handleOpenTemplate)
    }
  }, [])

  return (
    <div className="unified-sidebar">
      <div className="sidebar-scrollable-content">
        <div
          className="sidebar-view-pane"
          style={{
            display: activeView === 'files' ? 'flex' : 'none',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            minHeight: 0
          }}
        >
          <FileExplorer isEmbedded={true} />
        </div>

        <div
          className="sidebar-view-pane"
          style={{
            display: activeView === 'theme' ? 'flex' : 'none',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            minHeight: 0
          }}
        >
          {hasMountedTheme && (
            <React.Suspense fallback={null}>
              <Theme
                isEmbedded={true}
                isOpen={isLeftOpen && activeView === 'theme'}
                onClose={closeLeftSidebar}
              />
            </React.Suspense>
          )}
        </div>

        <div
          className="sidebar-view-pane"
          style={{
            display: activeView === 'templates' ? 'flex' : 'none',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            minHeight: 0
          }}
        >
          {hasMountedTemplates && (
            <React.Suspense fallback={null}>
              <Template
                isEmbedded={true}
                isOpen={isLeftOpen && activeView === 'templates'}
                onClose={closeLeftSidebar}
              />
            </React.Suspense>
          )}
        </div>
      </div>
    </div>
  )
})

Sidebar.displayName = 'Sidebar'
export default Sidebar
