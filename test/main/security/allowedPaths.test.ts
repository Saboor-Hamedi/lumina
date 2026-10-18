import { describe, it, expect, beforeEach } from 'vitest'
import path from 'path'
import {
  allowPath,
  allowPathsFromResult,
  isAllowedPath,
  clearAllowedPaths
} from '../../../src/main/security/allowedPaths'

describe('allowedPaths allowlist', () => {
  beforeEach(() => clearAllowedPaths())

  it('rejects unknown paths and non-strings', () => {
    expect(isAllowedPath('C:/Windows/System32/calc.exe')).toBe(false)
    expect(isAllowedPath('')).toBe(false)
    expect(isAllowedPath(null)).toBe(false)
    expect(isAllowedPath(undefined)).toBe(false)
    expect(isAllowedPath(42)).toBe(false)
  })

  it('allows an explicitly registered file', () => {
    const file = path.join('tmp', 'out', 'note.pdf')
    allowPath(file)
    expect(isAllowedPath(path.resolve(file))).toBe(true)
  })

  it('allows files inside a registered directory', () => {
    const dir = path.join('tmp', 'exports')
    allowPath(dir)
    expect(isAllowedPath(path.join(dir, 'a.md'))).toBe(true)
    expect(isAllowedPath(path.join(dir, 'nested', 'b.md'))).toBe(true)
  })

  it('does not allow a sibling that shares a name prefix', () => {
    const dir = path.join('tmp', 'exports')
    allowPath(dir)
    expect(isAllowedPath(path.join('tmp', 'exports-evil', 'x.md'))).toBe(false)
  })

  it('registers nested paths found in export results', () => {
    const outDir = path.join('tmp', 'batch')
    const filePath = path.join(outDir, 'clip.html')
    allowPathsFromResult({
      ok: true,
      outputDir: outDir,
      files: [{ filePath, name: 'clip' }]
    })
    expect(isAllowedPath(outDir)).toBe(true)
    expect(isAllowedPath(filePath)).toBe(true)
  })

  it('ignores string values under non-path keys', () => {
    allowPathsFromResult({ format: 'pdf', title: 'C:/not/registered.pdf', message: 'some/path.md' })
    expect(isAllowedPath('C:/not/registered.pdf')).toBe(false)
    expect(isAllowedPath('some/path.md')).toBe(false)
  })

  it('registers path-like keys added by future exporters', () => {
    const zipPath = path.join('tmp', 'archives', 'bundle.zip')
    const folderDirectory = path.join('tmp', 'combined')
    allowPathsFromResult({ zipPath, folderDirectory })
    expect(isAllowedPath(zipPath)).toBe(true)
    expect(isAllowedPath(folderDirectory)).toBe(true)
  })

  it('ignores empty and missing path values', () => {
    allowPathsFromResult({ filePath: '', bundleDir: null, assetsDir: undefined })
    expect(isAllowedPath('')).toBe(false)
  })

  it('handles cyclic results without infinite recursion', () => {
    const result: Record<string, unknown> = { outputDir: path.join('tmp', 'cyc') }
    result.self = result
    expect(() => allowPathsFromResult(result)).not.toThrow()
    expect(isAllowedPath(path.join('tmp', 'cyc'))).toBe(true)
  })
})
