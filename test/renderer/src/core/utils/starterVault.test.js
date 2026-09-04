import { describe, it, expect, vi } from 'vitest'
import { STARTER_NOTES, populateStarterVault } from '../../../../../src/renderer/src/core/utils/starterVault'

describe('starterVault', () => {
  it('contains at least 5 structured starter notes', () => {
    expect(STARTER_NOTES.length).toBeGreaterThanOrEqual(5)
    for (const note of STARTER_NOTES) {
      expect(note.id).toBeTruthy()
      expect(note.title).toBeTruthy()
      expect(note.fileName).toContain('.md')
      expect(note.code).toBeTruthy()
      expect(note.language).toBe('markdown')
    }
  })

  it('includes welcome, formatting, math, diagrams, and graph notes', () => {
    const titles = STARTER_NOTES.map((n) => n.title)
    expect(titles).toContain('Welcome to Lumina')
    expect(titles).toContain('Markdown & Formatting')
    expect(titles).toContain('Math & Formulas')
    expect(titles).toContain('Diagrams & Visuals')
    expect(titles).toContain('Graph & Wikilinks')
  })

  it('populates notes via saveSnippet function', async () => {
    const mockSave = vi.fn(async (snippet) => ({ ...snippet }))
    const result = await populateStarterVault(mockSave)

    expect(mockSave).toHaveBeenCalledTimes(STARTER_NOTES.length)
    expect(result.length).toBe(STARTER_NOTES.length)
    expect(result[0].id).toBe('starter-welcome')
  })

  it('returns empty array if saveSnippet is invalid', async () => {
    const result = await populateStarterVault(null)
    expect(result).toEqual([])
  })
})
