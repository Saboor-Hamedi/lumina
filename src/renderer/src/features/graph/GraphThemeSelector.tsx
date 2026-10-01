import React from 'react'
import { Layers } from 'lucide-react'
import { useSettingsStore } from '../../core/store/SettingStore'

export interface GraphThemeSelectorProps {
  variant?: 'button' | 'dropdown'
  size?: 'small' | 'medium' | 'large'
}

/**
 * GraphThemeSelector Component
 * Standalone theme switcher for graph visualization.
 */
export const GraphThemeSelector: React.FC<GraphThemeSelectorProps> = ({
  variant = 'button',
  size = 'medium'
}) => {
  const { settings, updateSetting } = useSettingsStore()
  const graphTheme = settings.graphTheme || 'default'

  const graphThemes = ['default', 'space', 'nebula', 'ocean', 'sunset', 'neural'] as const

  const rotateTheme = () => {
    const currentIndex = graphThemes.indexOf(graphTheme as any)
    const nextIndex = (currentIndex + 1) % graphThemes.length
    updateSetting('graphTheme', graphThemes[nextIndex])
  }

  const getThemeLabel = (theme: string): string => {
    const labels: Record<string, string> = {
      default: 'Default',
      space: 'Space',
      nebula: 'Nebula',
      ocean: 'Ocean',
      sunset: 'Sunset',
      neural: 'Neural'
    }
    return labels[theme] || theme
  }

  if (variant === 'dropdown') {
    return (
      <div className="graph-control-select">
        <select
          value={graphTheme}
          onChange={(e) => updateSetting('graphTheme', e.target.value)}
          className={`graph-select-${size}`}
          title="Switch Background Theme"
        >
          {graphThemes.map((theme) => (
            <option key={theme} value={theme}>
              {getThemeLabel(theme)}
            </option>
          ))}
        </select>
      </div>
    )
  }

  // Default: button variant - icon only, no label
  return (
    <button
      className={`graph-control-btn graph-theme-btn graph-btn-${size}`}
      onClick={rotateTheme}
      title={`Switch Theme (Current: ${getThemeLabel(graphTheme)})`}
    >
      <Layers size={size === 'small' ? 14 : size === 'large' ? 20 : 18} />
    </button>
  )
}

export default GraphThemeSelector
