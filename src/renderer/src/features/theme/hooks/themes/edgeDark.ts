import { ThemeDefinition } from '../themeDefinitions'

export const edgeDark: ThemeDefinition = {
  id: 'edgeDark',
  name: 'Edge Dark',
  description: 'Minimalist dark theme with sharp contrast and neon green highlights',
  colors: {
    '--bg-app': '#0d0f12',
    '--bg-sidebar': '#0a0c0e',
    '--bg-activitybar': '#07080a',
    '--bg-panel': '#14171c',
    '--bg-editor': '#0d0f12',
    '--bg-active': 'rgba(80, 250, 123, 0.15)',
    '--bg-card': '#1a1e24',
    '--text-main': '#e8eaed',
    '--text-muted': '#9ca3af',
    '--text-faint': '#5f6774',
    '--text-accent': '#50fa7b',
    '--text-accent-rgb': '80, 250, 123',
    '--border-dim': '#181c22',
    '--border-subtle': '#242930',
    '--border-main': '#3a4048',
    '--border-card': '#242930',
    '--scroll-thumb': '#2e343c',
    '--scroll-track': '#0a0c0e',
    '--icon-primary': '#50fa7b',
    '--icon-secondary': '#8be9fd',
    '--icon-tertiary': '#f1fa8c',
    '--icon-danger': '#ff5555',
    '--icon-love': '#ff79c6',
    '--caret-width': '2px',
    '--caret-color': '#50fa7b',
    '--shadow-soft': 'rgba(0, 0, 0, 0.4)',
    '--glow-accent': 'rgba(80, 250, 123, 0.15)'
  }
}

export default edgeDark;
