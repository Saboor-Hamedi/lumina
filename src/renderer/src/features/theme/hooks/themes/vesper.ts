import { ThemeDefinition } from '../themeDefinitions'

export const vesper: ThemeDefinition = {
  id: 'vesper',
  name: 'Vesper',
  description: 'Warm minimalist dark with peachy accents and soft charcoal',
  colors: {
    '--bg-app': '#1a1a1a',
    '--bg-sidebar': '#141414',
    '--bg-activitybar': '#0f0f0f',
    '--bg-panel': '#202020',
    '--bg-editor': '#1a1a1a',
    '--bg-active': 'rgba(255, 199, 153, 0.14)',
    '--bg-card': '#262626',
    '--text-main': '#f0f0f0',
    '--text-muted': '#a0a0a0',
    '--text-faint': '#666666',
    '--text-accent': '#ffc799',
    '--text-accent-rgb': '255, 199, 153',
    '--border-dim': '#242424',
    '--border-subtle': '#303030',
    '--border-main': '#454545',
    '--border-card': '#303030',
    '--scroll-thumb': '#3a3a3a',
    '--scroll-track': '#141414',
    '--icon-primary': '#ffc799',
    '--icon-secondary': '#a0e0a0',
    '--icon-tertiary': '#ffd7a8',
    '--icon-danger': '#ff8080',
    '--icon-love': '#ffb3d9',
    '--caret-width': '2px',
    '--caret-color': '#ffc799',
    '--shadow-soft': 'rgba(0, 0, 0, 0.35)',
    '--glow-accent': 'rgba(255, 199, 153, 0.12)'
  }
}

export default vesper;
