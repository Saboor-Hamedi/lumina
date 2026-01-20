import React from 'react'
import { WelcomePage } from '../welcomePage'

/**
 * Dashboard Component
 * Now delegates entirely to the focused WelcomePage when no note is active.
 */
const Dashboard = ({ onNew }) => {
  return <WelcomePage onNew={onNew} />
}

export default Dashboard

