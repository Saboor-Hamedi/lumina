import React from 'react'
import { Shapes, Spline, Grid, Camera } from 'lucide-react'
import { StudioTab } from './types'

export interface StudioTabsBarProps {
  activeTab: StudioTab
  onSelectTab: (tab: StudioTab) => void
}

export const StudioTabsBar: React.FC<StudioTabsBarProps> = React.memo(
  ({ activeTab, onSelectTab }) => {
    return (
      <div className="lumina-canvas-studio-tabs-bar">
        <button
          type="button"
          className={`studio-tab-item ${activeTab === 'shapes' ? 'active' : ''}`}
          onClick={() => onSelectTab('shapes')}
        >
          <Shapes size={12} />
          <span>Shapes</span>
        </button>
        <button
          type="button"
          className={`studio-tab-item ${activeTab === 'connectors' ? 'active' : ''}`}
          onClick={() => onSelectTab('connectors')}
        >
          <Spline size={12} />
          <span>Wires</span>
        </button>
        <button
          type="button"
          className={`studio-tab-item ${activeTab === 'grid' ? 'active' : ''}`}
          onClick={() => onSelectTab('grid')}
        >
          <Grid size={12} />
          <span>Layout</span>
        </button>
        <button
          type="button"
          className={`studio-tab-item ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => onSelectTab('export')}
        >
          <Camera size={12} />
          <span>Export</span>
        </button>
      </div>
    )
  }
)

StudioTabsBar.displayName = 'StudioTabsBar'
export default StudioTabsBar
