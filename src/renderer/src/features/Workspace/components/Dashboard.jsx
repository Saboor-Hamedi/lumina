import React from 'react'
import { WelcomePage } from '../welcomePage'
import StatusBar from './StatusBar'

/**
 * Dashboard Component
 * Now delegates entirely to the focused WelcomePage when no note is active.
 */
const Dashboard = ({ onNew, onToggleExplorerModal, onSettingsClick, onThemeClick, onGraphClick, onDailyNoteClick }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <WelcomePage onNew={onNew} />
      </div>
      <StatusBar 
        wordCount={0}
        onToggleExplorerModal={onToggleExplorerModal}
        onSettingsClick={onSettingsClick}
        onThemeClick={onThemeClick}
        onGraphClick={onGraphClick}
        onDailyNoteClick={onDailyNoteClick}
      />
    </div>
  )
}

export default Dashboard
