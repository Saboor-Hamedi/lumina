import { ThemeDefinition } from '../themeDefinitions'

export const cyberpunk: ThemeDefinition = {
  id: 'cyberpunk',
  name: 'Cyberpunk 2099',
  description: 'Midnight city dystopia with warm cyber-amber and balanced mint glow',
  colors: {
    '--bg-app': '#121520',
    '--bg-sidebar': '#0d1018',
    '--bg-activitybar': '#090b11',
    '--bg-panel': '#1a1f2e',
    '--bg-editor': '#121520',
    '--bg-active': 'rgba(56, 189, 248, 0.17)',
    '--bg-card': '#22283b',
    '--text-main': '#ecf0f8',
    '--text-muted': '#9ba9c6',
    '--text-faint': '#64728c',
    '--text-accent': '#38bdf8',
    '--text-accent-rgb': '56, 189, 248',
    '--border-dim': '#1e2436',
    '--border-subtle': '#29324a',
    '--border-main': '#3d4b6e',
    '--border-card': '#29324a',
    '--scroll-thumb': '#34405d',
    '--scroll-track': '#0d1018',
    '--icon-primary': '#38bdf8',
    '--icon-secondary': '#34d399',
    '--icon-tertiary': '#fbbf24',
    '--icon-danger': '#f87171',
    '--icon-love': '#f472b6',
    '--caret-width': '2px',
    '--caret-color': '#38bdf8',
    '--shadow-soft': 'rgba(0, 0, 0, 0.35)',
    '--glow-accent': 'rgba(56, 189, 248, 0.18)'
  }
}

export default cyberpunk;
