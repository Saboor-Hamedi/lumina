import { ThemeDefinition } from '../themeDefinitions'

export const retroTerminal: ThemeDefinition = {
  id: 'retroTerminal',
  name: 'Retro Terminal',
  description: 'Classic CRT monitor with phosphor green glow and warm scanlines',
  colors: {
    '--bg-app': '#0d0f0d',
    '--bg-sidebar': '#0a0c0a',
    '--bg-activitybar': '#070907',
    '--bg-panel': '#121512',
    '--bg-editor': '#0d0f0d',
    '--bg-active': 'rgba(74, 222, 128, 0.14)',
    '--bg-card': '#181c18',
    '--text-main': '#c8e6c8',
    '--text-muted': '#7aa87a',
    '--text-faint': '#4a6a4a',
    '--text-accent': '#4ade80',
    '--text-accent-rgb': '74, 222, 128',
    '--border-dim': '#161a16',
    '--border-subtle': '#202620',
    '--border-main': '#344034',
    '--border-card': '#202620',
    '--scroll-thumb': '#2a342a',
    '--scroll-track': '#0a0c0a',
    '--icon-primary': '#4ade80',
    '--icon-secondary': '#22d3ee',
    '--icon-tertiary': '#facc15',
    '--icon-danger': '#f87171',
    '--icon-love': '#f472b6',
    '--caret-width': '2px',
    '--caret-color': '#4ade80',
    '--shadow-soft': 'rgba(0, 0, 0, 0.4)',
    '--glow-accent': 'rgba(74, 222, 128, 0.12)'
  }
}

export default retroTerminal;
