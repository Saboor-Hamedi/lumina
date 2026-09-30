import { describe, it, expect } from 'vitest'
import {
  wrapPreviewDocument,
  themeVarsCss,
  isLightTheme,
  normalizeTheme,
  DEFAULT_THEME
} from '../../src/export/preview/themeTokens'

describe('preview themeTokens.wrapPreviewDocument', () => {
  it('includes a script that blocks link navigation inside previews', () => {
    const html = wrapPreviewDocument('body{}', '<a href="#">x</a>', 'T')
    expect(html).toContain("addEventListener('click'")
    expect(html).toContain("addEventListener('auxclick'")
    expect(html).toContain('preventDefault')
  })
})

describe('preview themeTokens.normalizeTheme', () => {
  it('falls back to defaults and rejects unknown/oversized values', () => {
    const t = normalizeTheme({ 'bg-app': '#abcdef', unknown: 'nope', 'text-main': 'x'.repeat(200) })
    expect(t['bg-app']).toBe('#abcdef')
    expect(t['text-main']).toBe(DEFAULT_THEME['text-main'])
    expect(t.unknown).toBeUndefined()
  })
})

describe('preview themeTokens.isLightTheme', () => {
  it('detects light and dark editor backgrounds', () => {
    expect(isLightTheme({ 'bg-editor': '#ffffff' })).toBe(true)
    expect(isLightTheme({ 'bg-editor': '#0e0f15' })).toBe(false)
  })
})

describe('preview themeTokens.themeVarsCss', () => {
  it('emits :root custom properties', () => {
    const css = themeVarsCss({ 'bg-app': '#123456' })
    expect(css).toContain(':root {')
    expect(css).toContain('--bg-app: #123456;')
  })
})
