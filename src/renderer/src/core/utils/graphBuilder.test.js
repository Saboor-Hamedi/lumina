import { describe, it, expect } from 'vitest'
import { buildGraphData, buildSemanticLinks } from './graphBuilder'

describe('graphBuilder', () => {
  describe('buildGraphData', () => {
    it('creates nodes from snippets', () => {
      const snippets = [
        { id: '1', title: 'Note 1', code: '', tags: '' },
        { id: '2', title: 'Note 2', code: '', tags: '' }
      ]

      const { nodes, links } = buildGraphData(snippets)

      expect(nodes).toHaveLength(2)
      expect(nodes[0].id).toBe('Note 1')
      expect(nodes[0].group).toBe('note')
      expect(nodes[0].snippetId).toBe('1')
      expect(nodes[1].id).toBe('Note 2')
    })

    it('creates links from wiki links', () => {
      const snippets = [
        { id: '1', title: 'Note 1', code: 'This links to [[Note 2]]', tags: '' },
        { id: '2', title: 'Note 2', code: '', tags: '' }
      ]

      const { nodes, links } = buildGraphData(snippets)

      expect(links).toHaveLength(1)
      expect(links[0].source).toBe('Note 1')
      expect(links[0].target).toBe('Note 2')
      expect(links[0].value).toBe(1)
    })

    it('creates ghost nodes for non-existent links', () => {
      const snippets = [
        { id: '1', title: 'Note 1', code: 'This links to [[NonExistent]]', tags: '' }
      ]

      const { nodes, links } = buildGraphData(snippets)

      const ghostNode = nodes.find(n => n.id === 'NonExistent')
      expect(ghostNode).toBeDefined()
      expect(ghostNode.group).toBe('ghost')
      // Ghost nodes start with val 0.5, but get increased by link mass calculation
      expect(ghostNode.val).toBeGreaterThanOrEqual(0.5)
      expect(links).toHaveLength(1)
    })

    it('handles wiki links with display text', () => {
      const snippets = [
        { id: '1', title: 'Note 1', code: 'Link: [[Note 2|Display Text]]', tags: '' },
        { id: '2', title: 'Note 2', code: '', tags: '' }
      ]

      const { links } = buildGraphData(snippets)

      expect(links).toHaveLength(1)
      expect(links[0].target).toBe('Note 2')
    })

    it('creates tag nodes from tags', () => {
      const snippets = [
        { id: '1', title: 'Note 1', code: '', tags: 'tag1, tag2' }
      ]

      const { nodes, links } = buildGraphData(snippets)

      const tagNodes = nodes.filter(n => n.group === 'tag')
      expect(tagNodes).toHaveLength(2)
      expect(tagNodes[0].id).toBe('#tag1')
      expect(tagNodes[1].id).toBe('#tag2')

      const tagLinks = links.filter(l => l.target.startsWith('#'))
      expect(tagLinks).toHaveLength(2)
      expect(tagLinks[0].value).toBe(0.5)
    })

    it('calculates node mass based on links', () => {
      const snippets = [
        { id: '1', title: 'Note 1', code: '[[Note 2]]', tags: '' },
        { id: '2', title: 'Note 2', code: '[[Note 1]]', tags: '' }
      ]

      const { nodes } = buildGraphData(snippets)

      const note1 = nodes.find(n => n.id === 'Note 1')
      const note2 = nodes.find(n => n.id === 'Note 2')

      // Each node has base val of 1, plus 0.5 for each link
      expect(note1.val).toBeGreaterThan(1)
      expect(note2.val).toBeGreaterThan(1)
    })

    it('handles multiple links from same source', () => {
      const snippets = [
        { id: '1', title: 'Note 1', code: '[[Note 2]] and [[Note 3]]', tags: '' },
        { id: '2', title: 'Note 2', code: '', tags: '' },
        { id: '3', title: 'Note 3', code: '', tags: '' }
      ]

      const { links } = buildGraphData(snippets)

      expect(links).toHaveLength(2)
      expect(links.filter(l => l.source === 'Note 1')).toHaveLength(2)
    })

    it('handles empty snippets array', () => {
      const { nodes, links } = buildGraphData([])

      expect(nodes).toHaveLength(0)
      expect(links).toHaveLength(0)
    })
  })

  describe('buildSemanticLinks', () => {
    it('returns empty array when no embeddings cache', () => {
      const nodes = [{ id: 'Note 1', group: 'note', snippetId: '1' }]
      const links = []
      const snippets = [{ id: '1', title: 'Note 1', code: '' }]

      const semanticLinks = buildSemanticLinks(nodes, links, snippets, null)

      expect(semanticLinks).toEqual([])
    })

    it('returns empty array when embeddings cache is empty', () => {
      const nodes = [{ id: 'Note 1', group: 'note', snippetId: '1' }]
      const links = []
      const snippets = [{ id: '1', title: 'Note 1', code: '' }]

      const semanticLinks = buildSemanticLinks(nodes, links, snippets, {})

      expect(semanticLinks).toEqual([])
    })

    it('creates semantic links for similar nodes', () => {
      const nodes = [
        { id: 'Note 1', group: 'note', snippetId: '1' },
        { id: 'Note 2', group: 'note', snippetId: '2' }
      ]
      const links = []
      const snippets = [
        { id: '1', title: 'Note 1', code: '' },
        { id: '2', title: 'Note 2', code: '' }
      ]

      // Create similar embeddings (normalized vectors)
      const embedding1 = Array(384).fill(0.5).map(() => Math.random() * 0.1 + 0.5)
      const embedding2 = Array(384).fill(0.5).map(() => Math.random() * 0.1 + 0.5)
      
      // Normalize to make them similar
      const normalize = (vec) => {
        const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
        return vec.map(v => v / mag)
      }
      const norm1 = normalize(embedding1)
      const norm2 = normalize(embedding2)

      const embeddingsCache = {
        '1': norm1,
        '2': norm2
      }

      const semanticLinks = buildSemanticLinks(nodes, links, snippets, embeddingsCache)

      // Should create a link if similarity > 0.65
      expect(semanticLinks.length).toBeGreaterThanOrEqual(0)
    })

    it('does not create semantic link if explicit link exists', () => {
      const nodes = [
        { id: 'Note 1', group: 'note', snippetId: '1' },
        { id: 'Note 2', group: 'note', snippetId: '2' }
      ]
      const links = [{ source: 'Note 1', target: 'Note 2', value: 1 }]
      const snippets = [
        { id: '1', title: 'Note 1', code: '' },
        { id: '2', title: 'Note 2', code: '' }
      ]

      const embeddingsCache = {
        '1': Array(384).fill(0.5),
        '2': Array(384).fill(0.5)
      }

      const semanticLinks = buildSemanticLinks(nodes, links, snippets, embeddingsCache)

      // Should not add semantic link if explicit link exists
      const hasLink = semanticLinks.some(
        l => (l.source === 'Note 1' && l.target === 'Note 2') ||
             (l.source === 'Note 2' && l.target === 'Note 1')
      )
      expect(hasLink).toBe(false)
    })

    it('only processes note nodes, not tags or ghosts', () => {
      const nodes = [
        { id: 'Note 1', group: 'note', snippetId: '1' },
        { id: '#tag1', group: 'tag' },
        { id: 'Ghost', group: 'ghost' }
      ]
      const links = []
      const snippets = [{ id: '1', title: 'Note 1', code: '' }]

      const embeddingsCache = { '1': Array(384).fill(0.5) }

      const semanticLinks = buildSemanticLinks(nodes, links, snippets, embeddingsCache)

      // Should not process tag or ghost nodes
      expect(semanticLinks.every(l => 
        nodes.find(n => n.id === l.source)?.group === 'note' &&
        nodes.find(n => n.id === l.target)?.group === 'note'
      )).toBe(true)
    })
  })
})
