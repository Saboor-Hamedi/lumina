// components/terminal/constants.ts
// Static config, default shells, and xterm.js theme.

import type { ITheme } from '@xterm/xterm'

const TERMINAL_EMOJI_FALLBACK = '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji"'

export const TERMINAL_FONT = `"JetBrains Mono", "Fira Code", "Cascadia Code", "Cascadia Mono", ${TERMINAL_EMOJI_FALLBACK}, Consolas, monospace`

/**
 * Resolves the active terminal font family from the unified Editor font CSS variables
 * (--editor-font-family / --font-editor), defaulting to JetBrains Mono with emoji/symbol
 * and monospace fallbacks so both ligatures and stickers/emojis render cleanly.
 */
export function getActiveTerminalFontFamily(): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return TERMINAL_FONT
  }

  try {
    const cs = window.getComputedStyle(document.documentElement)
    const raw = (
      cs.getPropertyValue('--editor-font-family').trim() ||
      cs.getPropertyValue('--font-editor').trim()
    )
    if (!raw) return TERMINAL_FONT

    const lower = raw.toLowerCase()
    const hasEmoji =
      lower.includes('segoe ui emoji') ||
      lower.includes('apple color emoji') ||
      lower.includes('noto color emoji')

    if (lower.includes('monospace')) {
      if (hasEmoji) return raw
      // Insert emoji/symbol fonts right before the generic monospace fallback
      return raw.replace(/,\s*monospace\b/i, `, ${TERMINAL_EMOJI_FALLBACK}, monospace`)
    }

    return hasEmoji ? `${raw}, monospace` : `${raw}, ${TERMINAL_FONT}`
  } catch {
    return TERMINAL_FONT
  }
}

export const DEFAULT_FONT_SIZE = 13
export const DEFAULT_SCROLLBACK = 10_000

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

/**
 * Dynamically resolves xterm.js theme colors from the active Lumina theme CSS variables.
 */
export function getActiveTerminalTheme(): ITheme {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return XTERM_THEME
  }

  const cs = window.getComputedStyle(document.documentElement)
  const bg = cs.getPropertyValue('--bg-editor').trim() || cs.getPropertyValue('--bg-app').trim() || '#0c0c0e'
  const fg = cs.getPropertyValue('--text-main').trim() || '#e4e4e7'
  const accent = cs.getPropertyValue('--text-accent').trim() || '#8b5cf6'
  const cursorColor = cs.getPropertyValue('--caret-color').trim() || accent
  const rgb = cs.getPropertyValue('--text-accent-rgb').trim()
  const selectionBg = rgb ? `rgba(${rgb}, 0.25)` : 'rgba(139, 92, 246, 0.25)'

  // Determine if active theme is light or dark based on background luminance
  const isLight = (() => {
    if (bg.startsWith('#') && (bg.length === 7 || bg.length === 4)) {
      const hex = bg.length === 4
        ? `${bg[1]}${bg[1]}${bg[2]}${bg[2]}${bg[3]}${bg[3]}`
        : bg.slice(1)
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      return luma > 140
    }
    return false
  })()

  if (isLight) {
    return {
      background: bg,
      foreground: fg,
      cursor: cursorColor,
      cursorAccent: bg,
      selectionBackground: selectionBg,
      scrollbarSliderBackground: 'rgba(60, 48, 34, 0.20)',
      scrollbarSliderHoverBackground: 'rgba(60, 48, 34, 0.38)',
      scrollbarSliderActiveBackground: 'rgba(60, 48, 34, 0.52)',
      black: '#2b2116',
      red: '#b91c1c',
      green: '#15803d',
      yellow: '#b45309',
      blue: '#1d4ed8',
      magenta: '#7e22ce',
      cyan: '#0e7490',
      white: '#f3f4f6',
      brightBlack: '#6b7280',
      brightRed: '#dc2626',
      brightGreen: '#16a34a',
      brightYellow: '#d97706',
      brightBlue: '#2563eb',
      brightMagenta: '#9333ea',
      brightCyan: '#0891b2',
      brightWhite: '#ffffff'
    }
  }

  return {
    background: bg,
    foreground: fg,
    cursor: cursorColor,
    cursorAccent: bg,
    selectionBackground: selectionBg,
    scrollbarSliderBackground: 'rgba(160, 160, 160, 0.22)',
    scrollbarSliderHoverBackground: 'rgba(160, 160, 160, 0.42)',
    scrollbarSliderActiveBackground: 'rgba(160, 160, 160, 0.55)',
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
}
