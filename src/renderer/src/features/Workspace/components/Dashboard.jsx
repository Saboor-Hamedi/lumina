import React from 'react'
import { WelcomePage } from '../welcomePage'

/**
 * Dashboard Component
 * Now delegates entirely to the focused WelcomePage when no note is active.
 */
const Dashboard = ({
  onNew,
  onToggleExplorerModal,
  onSettingsClick,
  onThemeClick,
  onGraphClick,
  onDailyNoteClick
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
      <WelcomePage onNew={onNew} />
    </div>
  )
}

export default Dashboard
