import { ThemeDefinition } from '../themeDefinitions'

export const dracula: ThemeDefinition = {
  id: 'dracula',
  name: 'Dracula',
  description: 'Gothic night with warm purple-slate undertones and pastel accents',
  colors: {
    '--bg-app': '#21222c',
    '--bg-sidebar': '#191a21',
    '--bg-activitybar': '#14151a',
    '--bg-panel': '#282a36',
    '--bg-editor': '#21222c',
    '--bg-active': 'rgba(189, 147, 249, 0.18)',
    '--bg-card': '#2f3140',
    '--text-main': '#f8f8f2',
    '--text-muted': '#b8bbd0',
    '--text-faint': '#707896',
    '--text-accent': '#bd93f9',
    '--text-accent-rgb': '189, 147, 249',
    '--border-dim': 'rgba(255, 255, 255, 0.06)',
    '--border-subtle': 'rgba(189, 147, 249, 0.14)',
    '--border-main': 'rgba(189, 147, 249, 0.24)',
    '--border-card': 'rgba(255, 255, 255, 0.08)',
    '--scroll-thumb': '#44475a',
    '--scroll-track': '#191a21',
    '--icon-primary': '#bd93f9',
    '--icon-secondary': '#50fa7b',
    '--icon-tertiary': '#f1fa8c',
    '--icon-danger': '#ff5555',
    '--icon-love': '#ff79c6',
    '--caret-width': '2px',
    '--caret-color': '#bd93f9',
    '--shadow-soft': 'rgba(0, 0, 0, 0.35)',
    '--glow-accent': 'rgba(189, 147, 249, 0.18)'
  }
}

export default dracula
