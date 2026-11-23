import { describe, it, expect } from 'vitest'
import {
  CURATED_LUCIDE_ICONS,
  getLucideIconByName
} from '../../../../../src/renderer/src/features/Icons/iconRegistry'
import { EMOJI_LIST } from '../../../../../src/renderer/src/features/Icons/icons'
import hljs from '../../../../../src/renderer/src/core/code/hljsCore'

describe('curated Lucide icon registry & hljsCore', () => {
  it('resolves every icon entry in EMOJI_LIST and file-type fallbacks', () => {
    const missing = EMOJI_LIST.filter((entry) => !getLucideIconByName(entry.char)).map(
      (entry) => entry.char
    )
    expect(missing).toEqual([])

    for (const extraName of ['File', 'FileJson', 'ImageIcon', 'BookText']) {
      expect(getLucideIconByName(extraName)).toBe(CURATED_LUCIDE_ICONS[extraName])
    }
  })

  it('rejects unknown names and prototype keys safely', () => {
    expect(getLucideIconByName(null)).toBeNull()
    expect(getLucideIconByName(undefined)).toBeNull()
    expect(getLucideIconByName('')).toBeNull()
    expect(getLucideIconByName('NonExistentIconXYZ')).toBeNull()
    expect(getLucideIconByName('toString')).toBeNull()
    expect(getLucideIconByName('constructor')).toBeNull()
    expect(getLucideIconByName('__proto__')).toBeNull()
    expect(getLucideIconByName('valueOf')).toBeNull()
  })

  it('highlights representative snippets for all curated languages and aliases', () => {
    const samples: ReadonlyArray<readonly [string, string]> = [
      ['ts', 'const count: number = 42'],
      ['tsx', 'export const Badge = ({ label }: { label: string }) => <span>{label}</span>'],
      ['js', 'function greet(name) { return `Hello ${name}` }'],
      ['py', 'def greet(name: str) -> str:\n    return f"hi {name}"'],
      ['rs', 'pub fn add(a: i32, b: i32) -> i32 { a + b }'],
      ['go', 'package main\nfunc main() { println("ok") }'],
      ['sql', 'SELECT id, title FROM notes WHERE pinned = 1;'],
      ['bash', 'if [ -f "notes.md" ]; then echo "ok"; fi'],
      ['json', '{"name": "lumina", "version": 2}'],
      ['html', '<div class="card">Hello</div>'],
      ['css', '.card { color: #8b5cf6; padding: 8px; }'],
      ['markdown', '# Heading\n\n- **Bold** item'],
      ['yaml', 'name: lumina\nversion: 2'],
      ['dockerfile', 'FROM node:20-alpine\nWORKDIR /app'],
      ['latex', '\\section{Intro} $E = mc^2$']
    ]

    for (const [lang, snippet] of samples) {
      expect(hljs.getLanguage(lang)).toBeDefined()
      const result = hljs.highlight(snippet, { language: lang })
      expect(result.value).toContain('<span class="hljs-')
    }
  })
})
