import { ThemeDefinition } from '../themeDefinitions'

export const githubDark: ThemeDefinition = {
  id: 'githubDark',
  name: 'GitHub Dimmed',
  description: 'Dark slate inspired by GitHub Dark Dimmed with relaxed contrast',
  colors: {
    '--bg-app': '#1c2128',
    '--bg-sidebar': '#161b22',
    '--bg-activitybar': '#12161c',
    '--bg-panel': '#22272e',
    '--bg-editor': '#1c2128',
    '--bg-active': 'rgba(88, 166, 255, 0.17)',
    '--bg-card': '#272d37',
    '--text-main': '#e6edf3',
    '--text-muted': '#9da6b2',
    '--text-faint': '#6a7584',
    '--text-accent': '#58a6ff',
    '--text-accent-rgb': '88, 166, 255',
    '--border-dim': '#272d37',
    '--border-subtle': '#373e48',
    '--border-main': '#49525f',
    '--border-card': '#373e48',
    '--scroll-thumb': '#3d4450',
    '--scroll-track': '#161b22',
    '--icon-primary': '#58a6ff',
    '--icon-secondary': '#3fb950',
    '--icon-tertiary': '#d29922',
    '--icon-danger': '#f85149',
    '--icon-love': '#db61a2',
    '--caret-width': '2px',
    '--caret-color': '#58a6ff',
    '--shadow-soft': 'rgba(0, 0, 0, 0.3)',
    '--glow-accent': 'rgba(88, 166, 255, 0.15)'
  }
}

export default githubDark;
