import React, { memo } from 'react'
import { Plus, Network } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import DailyNotes from './components/DailyNotes'
import './css/activitybar.css'

export const ActivityBar = memo(({
  onToggleGraph
}) => {
  const handleNewNote = () => {
    window.dispatchEvent(new CustomEvent('trigger-new-note'))
  }

  return (
    <aside className="lumina-activity-bar" data-testid="activity-bar" aria-label="Activity Bar">
      <div className="activity-bar-top">
        <ToolTip text="New Note" position="right">
          <button
            type="button"
            className="activity-bar-btn"
            onClick={handleNewNote}
            aria-label="New Note"
          >
            <Plus size={16} />
          </button>
        </ToolTip>

        <DailyNotes isActivityBar={true} />

        <ToolTip text="Knowledge Graph" position="right">
          <button
            type="button"
            className="activity-bar-btn"
            onClick={onToggleGraph}
            aria-label="Knowledge Graph"
          >
            <Network size={16} />
          </button>
        </ToolTip>
      </div>
    </aside>
  )
})

ActivityBar.displayName = 'ActivityBar'
export default ActivityBar
