import { ThemeDefinition } from '../themeDefinitions'

export const monokai: ThemeDefinition = {
  id: 'monokai',
  name: 'Monokai Pro',
  description: 'Warm charcoal dark theme with soft, eye-comfort pastel tones',
  colors: {
    '--bg-app': '#222326',
    '--bg-sidebar': '#1a1b1d',
    '--bg-activitybar': '#151517',
    '--bg-panel': '#2a2b2f',
    '--bg-editor': '#222326',
    '--bg-active': 'rgba(255, 216, 102, 0.17)',
    '--bg-card': '#323439',
    '--text-main': '#f5f5f0',
    '--text-muted': '#bab9b4',
    '--text-faint': '#7a7772',
    '--text-accent': '#ffd866',
    '--text-accent-rgb': '255, 216, 102',
    '--border-dim': '#2d2e33',
    '--border-subtle': '#3c3d44',
    '--border-main': '#53545c',
    '--border-card': '#3c3d44',
    '--scroll-thumb': '#494a52',
    '--scroll-track': '#1a1b1d',
    '--icon-primary': '#ffd866',
    '--icon-secondary': '#a9dc76',
    '--icon-tertiary': '#fc9867',
    '--icon-danger': '#ff6188',
    '--icon-love': '#ab9df2',
    '--caret-width': '2px',
    '--caret-color': '#ffd866',
    '--shadow-soft': 'rgba(0, 0, 0, 0.3)',
    '--glow-accent': 'rgba(255, 216, 102, 0.15)'
  }
}

export default monokai;
