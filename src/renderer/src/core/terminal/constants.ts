// components/terminal/constants.ts
// Static config, default shells, and xterm.js theme.

import type { ITheme } from '@xterm/xterm'

export const TERMINAL_FONT = '"JetBrains Mono", "Fira Code", "Cascadia Code", "Cascadia Mono", "Segoe UI Symbol", "Segoe UI Emoji", Consolas, monospace'

export const DEFAULT_FONT_SIZE = 13
export const DEFAULT_SCROLLBACK = 20_000

/** VSCode / Modern Windows Terminal-grade dark theme tuned for Lumina */
export const XTERM_THEME: ITheme = {
  background: '#0c0c0e',
  foreground: '#e4e4e7',
  cursor: '#e4e4e7',
  cursorAccent: '#0c0c0e',
  selectionBackground: '#3f3f46',
  black: '#18181b',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#e4e4e7',
  brightBlack: '#52525b',
  brightRed: '#fca5a5',
  brightGreen: '#86efac',
  brightYellow: '#fde68a',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#fafafa'
}

/** Picks a shell based on the host platform */
export function detectDefaultShell(): string {
  if (typeof navigator === 'undefined') return 'bash.exe'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'bash.exe'
  if (ua.includes('mac')) return '/bin/zsh'
  return '/bin/bash'
}

export const MAX_SESSIONS = 12
export const TAB_CLOSE_CONFIRM = false
