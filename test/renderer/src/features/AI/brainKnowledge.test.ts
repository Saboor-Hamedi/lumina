import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getBrainDocuments,
  getBrainFile,
  retrieveRelevantKnowledge,
  getBrainSummaryList
} from '../../../../../src/renderer/src/features/AI/services/brainKnowledge'

describe('Brain Knowledge Service (Renderer)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (window as any).api
  })

  it('loads brain documents dynamically via glob', () => {
    const docs = getBrainDocuments()
    expect(Array.isArray(docs)).toBe(true)
    expect(docs.length).toBeGreaterThanOrEqual(10)

    const purposeDoc = docs.find((d) => d.name.toLowerCase() === 'purpose')
    expect(purposeDoc).toBeDefined()
    expect(purposeDoc?.content).toContain('Lumina')
  })

  it('retrieves brain file by filename or path', () => {
    const doc = getBrainFile('shortcuts')
    expect(doc).toBeDefined()
    expect(doc?.name.toLowerCase()).toContain('shortcut')

    const nullDoc = getBrainFile('non-existent-topic-xyz')
    expect(nullDoc).toBeNull()
  })

  it('uses IPC searchBrain when available', async () => {
    const mockSearchResults = [
      {
        id: 'brain:specs/vision-guide.md#canvas',
        relPath: 'specs/vision-guide.md',
        docTitle: 'Vision Guide',
        heading: 'Infinite Canvas Experience',
        breadcrumb: 'Vision Guide > Infinite Canvas Experience',
        text: 'The canvas enables spatial thinking with nodes and ports.',
        finalScore: 0.95
      }
    ]

    ;(window as any).api = {
      searchBrain: vi.fn().mockResolvedValue(mockSearchResults)
    }

    const results = await retrieveRelevantKnowledge('spatial thinking canvas', 2)
    expect((window as any).api.searchBrain).toHaveBeenCalledWith('spatial thinking canvas', {
      limit: 2,
      threshold: 0.22
    })
    expect(results.length).toBe(1)
    expect(results[0].title).toContain('Vision Guide > Infinite Canvas Experience')
    expect(results[0].content).toContain('spatial thinking')
  })

  it('falls back seamlessly to in-memory section-aware search when IPC is unavailable', async () => {
    // window.api is undefined
    const results = await retrieveRelevantKnowledge('purpose', 2)
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].content.length).toBeGreaterThan(0)
    // Section chunk should be focused, not the entire 82KB file
    expect(results[0].content.length).toBeLessThan(15000)
  })

  it('returns brain summary list for prompt builder', () => {
    const summary = getBrainSummaryList()
    expect(typeof summary).toBe('string')
    expect(summary).toContain('purpose')
    expect(summary).toContain('shortcuts')
  })
})
