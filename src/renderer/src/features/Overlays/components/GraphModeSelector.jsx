import React from 'react'
import { Globe, Focus, Atom } from 'lucide-react'
import './GraphControls.css'

/**
 * GraphModeSelector Component
 * Standalone mode switcher for graph visualization.
 * Switches between: universe, neighborhood, orb
 * 
 * @param {Object} props
 * @param {string} props.activeMode - Current active mode: 'universe' | 'neighborhood' | 'orb'
 * @param {Function} props.onModeChange - Callback when mode changes: (mode: string) => void
 * @param {string} [props.variant='tabs'] - Display variant: 'tabs' or 'dropdown'
 * @param {string} [props.size='medium'] - Size: 'small', 'medium', 'large'
 */
const GraphModeSelector = ({ activeMode, onModeChange, variant = 'tabs', size = 'medium' }) => {
  const modes = [
    { id: 'universe', label: 'Universe', icon: Globe },
    { id: 'neighborhood', label: 'Neighborhood', icon: Focus },
    { id: 'orb', label: 'The Orb', icon: Atom }
  ]
  
  if (variant === 'dropdown') {
    return (
      <div className="graph-control-select">
        <select
          value={activeMode}
          onChange={(e) => onModeChange(e.target.value)}
          className={`graph-select-${size}`}
          title="Switch Graph Mode"
        >
          {modes.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
      </div>
    )
  }
  
  // Default: tabs variant
  return (
    <div className={`graph-mode-tabs graph-tabs-${size}`}>
      {modes.map((mode) => {
        const Icon = mode.icon
        const isActive = activeMode === mode.id
        return (
          <button
            key={mode.id}
            className={`graph-mode-tab ${isActive ? 'active' : ''}`}
            onClick={() => onModeChange(mode.id)}
            title={mode.label}
          >
            <Icon size={size === 'small' ? 12 : size === 'large' ? 16 : 14} />
            <span className="graph-tab-label">{mode.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default GraphModeSelector
