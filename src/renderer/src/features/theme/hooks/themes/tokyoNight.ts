import { ThemeDefinition } from '../themeDefinitions'

export const tokyoNight: ThemeDefinition = {
  id: 'tokyoNight',
  name: 'Tokyo Night',
  description: 'Tokyo storm night with velvety indigo and pastel neon glow',
  colors: {
    '--bg-app': '#1a1b26',
    '--bg-sidebar': '#16161e',
    '--bg-activitybar': '#121219',
    '--bg-panel': '#212537',
    '--bg-editor': '#1a1b26',
    '--bg-active': 'rgba(122, 162, 247, 0.18)',
    '--bg-card': '#282c40',
    '--text-main': '#c0caf5',
    '--text-muted': '#9aa5ce',
    '--text-faint': '#565f89',
    '--text-accent': '#7aa2f7',
    '--text-accent-rgb': '122, 162, 247',
    '--border-dim': '#23263a',
    '--border-subtle': '#292e42',
    '--border-main': '#3b4261',
    '--border-card': '#292e42',
    '--scroll-thumb': '#3b4261',
    '--scroll-track': '#16161e',
    '--icon-primary': '#7aa2f7',
    '--icon-secondary': '#9ece6a',
    '--icon-tertiary': '#e0af68',
    '--icon-danger': '#f7768e',
    '--icon-love': '#bb9af7',
    '--caret-width': '2px',
    '--caret-color': '#7aa2f7',
    '--shadow-soft': 'rgba(0, 0, 0, 0.35)',
    '--glow-accent': 'rgba(122, 162, 247, 0.15)'
  }
}

export default tokyoNight;
