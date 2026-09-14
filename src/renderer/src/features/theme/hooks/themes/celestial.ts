import { ThemeDefinition } from '../themeDefinitions'

export const celestial: ThemeDefinition = {
  id: 'celestial',
  name: 'Celestial',
  description: 'Heavenly starlight with soft gold, ethereal blue, and cloud white',
  colors: {
    '--bg-app': '#12141e',
    '--bg-sidebar': '#0e1018',
    '--bg-activitybar': '#0a0c12',
    '--bg-panel': '#181c28',
    '--bg-editor': '#12141e',
    '--bg-active': 'rgba(250, 204, 21, 0.14)',
    '--bg-card': '#1e2232',
    '--text-main': '#e8e4d8',
    '--text-muted': '#a8a090',
    '--text-faint': '#686458',
    '--text-accent': '#facc15',
    '--text-accent-rgb': '250, 204, 21',
    '--border-dim': '#1c202c',
    '--border-subtle': '#262c3c',
    '--border-main': '#3c4458',
    '--border-card': '#262c3c',
    '--scroll-thumb': '#303850',
    '--scroll-track': '#0e1018',
    '--icon-primary': '#facc15',
    '--icon-secondary': '#93c5fd',
    '--icon-tertiary': '#f472b6',
    '--icon-danger': '#f87171',
    '--icon-love': '#c084fc',
    '--caret-width': '2px',
    '--caret-color': '#facc15',
    '--shadow-soft': 'rgba(0, 0, 0, 0.35)',
    '--glow-accent': 'rgba(250, 204, 21, 0.13)'
  }
}

export default celestial;
