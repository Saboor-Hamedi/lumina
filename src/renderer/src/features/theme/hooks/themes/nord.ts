import { ThemeDefinition } from '../themeDefinitions'

export const nord: ThemeDefinition = {
  id: 'nord',
  name: 'Nord Frost',
  description: 'Arctic polar night with soothing twilight slate and icy-blue accents',
  colors: {
    '--bg-app': '#272d38',
    '--bg-sidebar': '#20252f',
    '--bg-activitybar': '#1a1e26',
    '--bg-panel': '#313847',
    '--bg-editor': '#272d38',
    '--bg-active': 'rgba(136, 192, 208, 0.18)',
    '--bg-card': '#384152',
    '--text-main': '#eceff4',
    '--text-muted': '#c6cddb',
    '--text-faint': '#7f8ca0',
    '--text-accent': '#88c0d0',
    '--text-accent-rgb': '136, 192, 208',
    '--border-dim': '#2f3745',
    '--border-subtle': '#3b4556',
    '--border-main': '#4c566a',
    '--border-card': '#3b4556',
    '--scroll-thumb': '#4c566a',
    '--scroll-track': '#20252f',
    '--icon-primary': '#88c0d0',
    '--icon-secondary': '#a3be8c',
    '--icon-tertiary': '#ebcb8b',
    '--icon-danger': '#bf616a',
    '--icon-love': '#b48ead',
    '--caret-width': '2px',
    '--caret-color': '#88c0d0',
    '--shadow-soft': 'rgba(0, 0, 0, 0.3)',
    '--glow-accent': 'rgba(136, 192, 208, 0.15)'
  }
}

export default nord;
