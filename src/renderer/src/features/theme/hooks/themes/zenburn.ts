import { ThemeDefinition } from '../themeDefinitions'

export const zenburn: ThemeDefinition = {
  id: 'zenburn',
  name: 'Zenburn',
  description: 'Low-contrast warm gray-green designed for prolonged coding comfort',
  colors: {
    '--bg-app': '#3f3f3f',
    '--bg-sidebar': '#383838',
    '--bg-activitybar': '#323232',
    '--bg-panel': '#464646',
    '--bg-editor': '#3f3f3f',
    '--bg-active': 'rgba(127, 159, 127, 0.18)',
    '--bg-card': '#4e4e4e',
    '--text-main': '#dcdccc',
    '--text-muted': '#9f9f9f',
    '--text-faint': '#7f7f7f',
    '--text-accent': '#7f9f7f',
    '--text-accent-rgb': '127, 159, 127',
    '--border-dim': '#484848',
    '--border-subtle': '#555555',
    '--border-main': '#666666',
    '--border-card': '#555555',
    '--scroll-thumb': '#5f5f5f',
    '--scroll-track': '#383838',
    '--icon-primary': '#7f9f7f',
    '--icon-secondary': '#7f9f7f',
    '--icon-tertiary': '#f0dfaf',
    '--icon-danger': '#cc9393',
    '--icon-love': '#dc8cc3',
    '--caret-width': '2px',
    '--caret-color': '#7f9f7f',
    '--shadow-soft': 'rgba(0, 0, 0, 0.25)',
    '--glow-accent': 'rgba(127, 159, 127, 0.12)'
  }
}

export default zenburn;
