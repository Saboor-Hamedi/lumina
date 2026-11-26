import React, { memo } from 'react'
import { Info, List as ListIcon, Link2, Network, LayoutDashboard } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import './css/activitybar.css'

export type RightSidebarTabId = 'details' | 'outline' | 'backlinks'

export interface RightActivityBarProps {
  isRightSidebarOpen: boolean
  activeTab: string
  onSelectTab: (tab: RightSidebarTabId) => void
  onToggleGraph?: () => void
  isGraphActive?: boolean
  onToggleCanvas?: () => void
  isCanvasActive?: boolean
  isZenHidden?: boolean
}

const RIGHT_TABS: ReadonlyArray<{
  id: RightSidebarTabId
  label: string
  icon: React.ComponentType<{ size?: number }>
}> = [
  { id: 'details', label: 'Note Details', icon: Info },
  { id: 'outline', label: 'Note Outline', icon: ListIcon },
  { id: 'backlinks', label: 'Backlinks', icon: Link2 }
]

export const RightActivityBar: React.FC<RightActivityBarProps> = memo(({
  isRightSidebarOpen,
  activeTab,
  onSelectTab,
  onToggleGraph,
  isGraphActive = false,
  onToggleCanvas,
  isCanvasActive = false,
  isZenHidden = false
}) => {
  const isMac =
    typeof navigator !== 'undefined' &&
    /mac/i.test(navigator.platform || navigator.userAgent)

  const handleCanvasClick = () => {
    if (onToggleCanvas) {
      onToggleCanvas()
    } else {
      window.dispatchEvent(new CustomEvent('trigger-new-canvas'))
    }
  }

  return (
    <aside
      className={`lumina-activity-bar lumina-activity-bar-right${isZenHidden ? ' zen-hidden' : ''}`}
      data-testid="right-activity-bar"
      aria-label="Right Activity Bar"
    >
      <div className="activity-bar-inner">
        <div className="activity-bar-top">
          {RIGHT_TABS.map(({ id, label, icon: Icon }) => {
            const isActive = isRightSidebarOpen && activeTab === id && !isGraphActive && !isCanvasActive
            return (
              <ToolTip key={id} text={label} position="left">
                <button
                  type="button"
                  className={`activity-bar-btn${isActive ? ' active' : ''}`}
                  onClick={() => onSelectTab(id)}
                  aria-label={label}
                  aria-pressed={isActive}
                >
                  <Icon size={16} />
                </button>
              </ToolTip>
            )
          })}

          {onToggleGraph && (
            <ToolTip text={`Knowledge Graph (${isMac ? '⌘G' : 'Ctrl+G'})`} position="left">
              <button
                type="button"
                className={`activity-bar-btn${isGraphActive ? ' active' : ''}`}
                onClick={onToggleGraph}
                aria-label="Knowledge Graph"
                aria-pressed={isGraphActive}
              >
                <Network size={16} />
              </button>
            </ToolTip>
          )}

          <ToolTip text="Canvas" position="left">
            <button
              type="button"
              className={`activity-bar-btn${isCanvasActive ? ' active' : ''}`}
              onClick={handleCanvasClick}
              aria-label="Canvas"
              aria-pressed={isCanvasActive}
            >
              <LayoutDashboard size={16} />
            </button>
          </ToolTip>
        </div>
      </div>
    </aside>
  )
})

RightActivityBar.displayName = 'RightActivityBar'
export default RightActivityBar
