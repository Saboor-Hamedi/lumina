import { ThemeDefinition } from '../themeDefinitions'

export const light: ThemeDefinition = {
  id: 'light',
  name: 'Minimal Light',
  description: 'Clean, Apple-inspired light theme with soft slate surfaces',
  colors: {
    '--bg-app': '#ffffff',
    '--bg-sidebar': '#f8fafc',
    '--bg-activitybar': '#f1f5f9',
    '--bg-panel': '#f1f5f9',
    '--bg-editor': '#ffffff',
    '--bg-active': 'rgba(2, 132, 199, 0.10)',
    '--bg-card': '#ffffff',
    '--text-main': '#0f172a',
    '--text-muted': '#475569',
    '--text-faint': '#94a3b8',
    '--text-accent': '#0284c7',
    '--text-accent-rgb': '2, 132, 199',
    '--border-dim': '#e2e8f0',
    '--border-subtle': '#cbd5e1',
    '--border-main': '#94a3b8',
    '--border-card': '#e2e8f0',
    '--scroll-thumb': '#cbd5e1',
    '--scroll-track': '#f8fafc',
    '--icon-primary': '#0284c7',
    '--icon-secondary': '#10b981',
    '--icon-tertiary': '#f59e0b',
    '--icon-danger': '#ef4444',
    '--icon-love': '#ec4899',
    '--caret-width': '2px',
    '--caret-color': '#0284c7',
    '--shadow-soft': 'rgba(15, 23, 42, 0.08)',
    '--glow-accent': 'rgba(2, 132, 199, 0.08)'
  }
}

export default light;
