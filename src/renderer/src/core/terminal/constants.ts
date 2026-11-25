// components/terminal/constants.ts
// Static config, default shells, Nerd Font + Ligature + Emoji font stack, and xterm.js theme.

import type { ITheme } from '@xterm/xterm'

const NERD_AND_LIGATURE_MONO_FONTS = [
  '"JetBrainsMono Nerd Font"',
  '"JetBrainsMono NF"',
  '"JetBrainsMono Nerd Font Mono"',
  '"CaskaydiaCove Nerd Font"',
  '"CaskaydiaCove NF"',
  '"Cascadia Code NF"',
  '"CascadiaCode NF"',
  '"Cascadia Code PL"',
  '"FiraCode Nerd Font"',
  '"FiraCode NF"',
  '"MesloLGS NF"',
  '"MesloLGM Nerd Font"',
  '"Hack Nerd Font"',
  '"Symbols Nerd Font Mono"',
  '"Symbols Nerd Font"',
  '"JetBrains Mono"',
  '"Fira Code"',
  '"Cascadia Code"',
  '"Cascadia Mono"',
  'Consolas'
]

const TERMINAL_EMOJI_FALLBACK = [
  '"Lumina Terminal Emoji"'
]

export const TERMINAL_FONT = [
  ...NERD_AND_LIGATURE_MONO_FONTS,
  ...TERMINAL_EMOJI_FALLBACK,
  'monospace'
].join(', ')

const MONO_FONT_HINT_RE =
  /\b(mono|code|consolas|menlo|monaco|courier|nerd|nf|meslo|hack|iosevka|inconsolata|cascadia|caskaydia|fira|jetbrains|0xproto|zed|source code)\b/i

/**
 * Maps a standard coding font name to its companion Nerd Font family names
 * so Powerline / Oh-My-Posh / Starship prompt icons ("bricks") resolve seamlessly
 * alongside OpenType programming ligatures.
 */
function companionNerdFamilies(primaryName: string): string[] {
  const lower = primaryName.toLowerCase()
  if (lower.includes('jetbrains')) {
    return ['"JetBrainsMono Nerd Font"', '"JetBrainsMono NF"', `"${primaryName}"`]
  }
  if (lower.includes('cascadia') || lower.includes('caskaydia')) {
    return [
      '"CaskaydiaCove Nerd Font"',
      '"CaskaydiaCove NF"',
      '"Cascadia Code NF"',
      '"Cascadia Code PL"',
      `"${primaryName}"`
    ]
  }
  if (lower.includes('fira')) {
    return ['"FiraCode Nerd Font"', '"FiraCode NF"', `"${primaryName}"`]
  }
  if (lower.includes('meslo')) {
    return ['"MesloLGS NF"', '"MesloLGM Nerd Font"', `"${primaryName}"`]
  }
  if (lower.includes('hack')) {
    return ['"Hack Nerd Font"', `"${primaryName}"`]
  }
  return [`"${primaryName}"`]
}

/**
 * Resolves the active terminal font family:
 * - Honors the user's selected monospace/coding font if one is configured, paired with its Nerd Font variants.
 * - Ignores proportional prose fonts (e.g. Inter, Segoe UI, Roboto) so terminal cells,
 *   Powerline prompt blocks, emojis, and ligatures never break.
 * - Places emoji fonts AFTER all Nerd/monospace fonts so emoji fonts never hijack ASCII or ligature glyphs.
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

    const firstSegment = raw
      .split(',')[0]
      ?.trim()
      .replace(/^['"]+|['"]+$/g, '')

    if (!firstSegment || !MONO_FONT_HINT_RE.test(firstSegment)) {
      return TERMINAL_FONT
    }

    const combined = [
      ...companionNerdFamilies(firstSegment),
      ...NERD_AND_LIGATURE_MONO_FONTS,
      ...TERMINAL_EMOJI_FALLBACK,
      'monospace'
    ]

    const seen = new Set<string>()
    return combined
      .filter((entry) => {
        const key = entry.replace(/['"]/g, '').toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .join(', ')
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
