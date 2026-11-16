import React, { memo } from 'react'
import { Calendar } from 'lucide-react'
import ToolTip from '../../../components/atoms/ToolTip'
import { useSettingsStore } from '../../../core/store/SettingStore'
import { useSidebarViewStore, toggleSidebarView } from '../sidebarViewStore'

export interface DailyNotesProps {
  isActivityBar?: boolean
}

const DailyNotes: React.FC<DailyNotesProps> = memo(({ isActivityBar = false }) => {
  const isLeftOpen = useSettingsStore((s: any) => s.settings?.sidebar?.isLeftOpen ?? true)
  const activeSidebarView = useSidebarViewStore((s) => s.activeView)
  const isTemplatesActive = isLeftOpen && activeSidebarView === 'templates'

  const handleDailyNote = () => {
    toggleSidebarView('templates')
  }

  return (
    <ToolTip text="Daily Note" position={isActivityBar ? 'right' : 'bottom'}>
      <button
        type="button"
        className={
          isActivityBar ? `activity-bar-btn ${isTemplatesActive ? 'active' : ''}` : 'new-note-btn'
        }
        onClick={handleDailyNote}
        style={isActivityBar ? undefined : { flex: 1, minWidth: 0, justifyContent: 'center' }}
        aria-label="Daily Note"
      >
        <Calendar size={isActivityBar ? 16 : 13} style={{ flexShrink: 0 }} />
        {!isActivityBar && (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Daily
          </span>
        )}
      </button>
    </ToolTip>
  )
})

DailyNotes.displayName = 'DailyNotes'

export default DailyNotes
