import { describe, it, expect } from 'vitest'
import { resolveTargetFolder } from '../../../../../../src/renderer/src/features/AI/services/summarizeNotes'

const note = (folderId: string) => ({ id: folderId || 'root', title: 'Note', code: '', folderId })

describe('resolveTargetFolder', () => {
  it('returns empty for a note at the workspace root', () => {
    expect(resolveTargetFolder([note('')])).toBe('')
  })

  it('returns the note folder for a single note inside a folder', () => {
    expect(resolveTargetFolder([note('Projects')])).toBe('Projects')
  })

  it('normalises backslashes and leading/trailing slashes', () => {
    expect(resolveTargetFolder([note('\\Projects\\Alpha\\')])).toBe('Projects/Alpha')
  })

  it('keeps notes sharing a folder together', () => {
    expect(resolveTargetFolder([note('Projects'), note('Projects')])).toBe('Projects')
  })

  it('resolves subfolder notes to their common ancestor, never outside it', () => {
    expect(resolveTargetFolder([note('Projects/Alpha'), note('Projects/Beta')])).toBe('Projects')
  })

  it('keeps a folder summary inside the folder when it includes subfolder notes', () => {
    expect(resolveTargetFolder([note('Projects'), note('Projects/Alpha')])).toBe('Projects')
  })

  it('falls back to root when notes share no folder', () => {
    expect(resolveTargetFolder([note('Projects'), note('Archive')])).toBe('')
  })

  it('falls back to root when any note lives at the root', () => {
    expect(resolveTargetFolder([note(''), note('Projects/Alpha')])).toBe('')
  })

  it('handles empty input', () => {
    expect(resolveTargetFolder([])).toBe('')
  })
})
