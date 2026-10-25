import { describe, it, expect } from 'vitest'
import { defaultTemplates } from '../../../../../../src/renderer/src/features/template/utils/defaultTemplates'

describe('defaultTemplates.ts', () => {
  it('exports an array of templates with title and code', () => {
    expect(Array.isArray(defaultTemplates)).toBe(true)
    expect(defaultTemplates.length).toBeGreaterThan(0)

    for (const item of defaultTemplates) {
      expect(item).toHaveProperty('title')
      expect(typeof item.title).toBe('string')
      expect(item).toHaveProperty('code')
      expect(typeof item.code).toBe('string')
    }
  })

  it('includes key templates such as Daily Log and Meeting Notes', () => {
    const titles = defaultTemplates.map((t) => t.title)
    expect(titles.some((t) => t.includes('Daily Log'))).toBe(true)
    expect(titles.some((t) => t.includes('Meeting Notes'))).toBe(true)
  })
})
