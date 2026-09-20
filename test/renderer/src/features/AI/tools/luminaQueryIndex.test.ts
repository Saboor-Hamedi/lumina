import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  luminaQueryIndexTool,
  extractFrontmatter,
  extractHeadings,
  extractTags,
  buildWorkspaceIndexRecords
} from '../../../../../../src/renderer/src/features/AI/tools/luminaQueryIndex'
import {
  detectUserIntent,
  IntentCategory
} from '../../../../../../src/renderer/src/features/AI/services/intentRouter'
import { parseMessageBlocks } from '../../../../../../src/renderer/src/features/AI/services/chatMarkdownParser'
import { useWorkspaceStore } from '../../../../../../src/renderer/src/core/store/workspaceStore'

describe('Structured Workspace Index Query Tool (luminaQueryIndex)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useWorkspaceStore.setState({
      notes: [
        {
          id: 'note-1',
          title: 'Quantum Computing',
          fileName: 'Quantum Computing.md',
          code: `---
status: active
priority: high
tags: [physics, quantum]
---
# Quantum Computing Foundations
An introduction to qubits and superposition.
Tag: #research #physics/quantum

Points to [[Quantum Algorithms]] and [[Linear Algebra]].`,
          folderId: 'Science',
          timestamp: 1700000000000
        },
        {
          id: 'note-2',
          title: 'Quantum Algorithms',
          fileName: 'Quantum Algorithms.md',
          code: `---
status: draft
---
# Algorithms for Quantum
Shor's and Grover's algorithm details.
Tags: #algorithms #research

Backlink to [[Quantum Computing]].`,
          folderId: 'Science',
          timestamp: 1700000050000
        },
        {
          id: 'note-3',
          title: 'Linear Algebra',
          fileName: 'Linear Algebra.md',
          code: `# Matrix Operations
Matrices, eigenvalues, and vectors.
Tags: #math #foundations

No outgoing links.`,
          folderId: 'Math',
          timestamp: 1700000020000
        },
        {
          id: 'note-4',
          title: 'Orphan Notes',
          fileName: 'Orphan Notes.md',
          code: `Just an isolated note with color #ff0000 and hex code #38bdf8.`,
          folderId: '',
          timestamp: 1700000010000
        }
      ],
      snippets: [],
      folders: ['Science', 'Math']
    } as any)
  })

  describe('Helper parsers', () => {
    it('extracts YAML frontmatter correctly', () => {
      const content = `---
author: Alice
category: AI
draft: false
---
# Title
Body text.`
      const fm = extractFrontmatter(content)
      expect(fm).toBeDefined()
      expect(fm?.author).toBe('Alice')
      expect(fm?.category).toBe('AI')
      expect(fm?.draft).toBe(false)
    })

    it('returns null when frontmatter is not present', () => {
      const content = `# Just a title\nNo frontmatter here.`
      expect(extractFrontmatter(content)).toBeNull()
    })

    it('extracts markdown headings', () => {
      const content = `# Main Title\nIntro\n## Subheading 1\nContent\n### Subheading 1.1\nMore content`
      const headings = extractHeadings(content)
      expect(headings).toHaveLength(3)
      expect(headings[0]).toBe('Main Title')
      expect(headings[1]).toBe('Subheading 1')
      expect(headings[2]).toBe('Subheading 1.1')
    })

    it('extracts inline tags while ignoring hex color codes and markdown titles', () => {
      const content = `# Title\nHere is #ai and #machine-learning/deep-dive.\nColor: #ffffff and #38bdf8.\nAnother: #science.`
      const tags = extractTags(content)
      expect(tags).toContain('ai')
      expect(tags).toContain('machine-learning/deep-dive')
      expect(tags).toContain('science')
      expect(tags).not.toContain('ffffff')
      expect(tags).not.toContain('38bdf8')
      expect(tags).not.toContain('Title')
    })
  })

  describe('Tool execution & filtering', () => {
    it('queries notes by tag', async () => {
      const result: any = await (luminaQueryIndexTool.execute as any)({ tag: 'research' })
      expect(result.success).toBe(true)
      expect(result.totalMatched).toBe(2)
      const titles = result.notes.map((n: any) => n.title)
      expect(titles).toContain('Quantum Computing')
      expect(titles).toContain('Quantum Algorithms')
    })

    it('queries notes by folder', async () => {
      const result: any = await (luminaQueryIndexTool.execute as any)({ folder: 'Math' })
      expect(result.success).toBe(true)
      expect(result.totalMatched).toBe(1)
      expect(result.notes[0].title).toBe('Linear Algebra')
    })

    it('queries notes by outgoing link target (linksTo)', async () => {
      const result: any = await (luminaQueryIndexTool.execute as any)({ linksTo: 'Linear Algebra' })
      expect(result.success).toBe(true)
      expect(result.totalMatched).toBe(1)
      expect(result.notes[0].title).toBe('Quantum Computing')
    })

    it('queries notes with backlinks (backlinksFor)', async () => {
      // Linear Algebra is linked to by Quantum Computing
      const result: any = await (luminaQueryIndexTool.execute as any)({ backlinksFor: 'Linear Algebra' })
      expect(result.success).toBe(true)
      expect(result.totalMatched).toBe(1)
      expect(result.notes[0].title).toBe('Quantum Computing')
    })

    it('queries notes with specific frontmatter key', async () => {
      const result: any = await (luminaQueryIndexTool.execute as any)({ hasFrontmatter: 'priority' })
      expect(result.success).toBe(true)
      expect(result.totalMatched).toBe(1)
      expect(result.notes[0].title).toBe('Quantum Computing')
    })

    it('supports full-text / metadata search query', async () => {
      const result: any = await (luminaQueryIndexTool.execute as any)({ query: 'superposition' })
      expect(result.success).toBe(true)
      expect(result.totalMatched).toBe(1)
      expect(result.notes[0].title).toBe('Quantum Computing')
    })

    it('supports limit and sorting', async () => {
      const result: any = await (luminaQueryIndexTool.execute as any)({
        sortBy: 'title',
        sortOrder: 'asc',
        limit: 2
      })
      expect(result.success).toBe(true)
      expect(result.notes.length).toBe(2)
      expect(result.notes[0].title).toBe('Linear Algebra')
      expect(result.notes[1].title).toBe('Orphan Notes')
    })

    it('generates rich markdown summary with wikilinks', async () => {
      const result: any = await (luminaQueryIndexTool.execute as any)({ tag: 'physics' })
      expect(result.summaryMarkdown).toContain('[[Quantum Computing]]')
      expect(result.summaryMarkdown).toContain('Science')
      expect(result.summary).toContain('Found **1** matching notes')
    })
  })

  describe('Intent routing & parser integration', () => {
    it('classifies index queries to QUERY_INDEX intent', () => {
      expect(detectUserIntent('Find all notes with tag #research')).toBe(IntentCategory.QUERY_INDEX)
      expect(detectUserIntent('which notes link to [[Quantum Algorithms]]?')).toBe(IntentCategory.QUERY_INDEX)
      expect(detectUserIntent('show notes in folder Science')).toBe(IntentCategory.QUERY_INDEX)
      expect(detectUserIntent('query index for algorithms')).toBe(IntentCategory.QUERY_INDEX)
    })

    it('parses <lumina-index> blocks in chat markdown parser', () => {
      const content = `Let me look up the index for you.\n\n<lumina-index>\n{"totalWorkspaceNotes": 4, "totalMatched": 2, "notes": [{"title": "Note A"}]}\n</lumina-index>\n\nHere are your notes.`
      const blocks = parseMessageBlocks(content)
      expect(blocks).toHaveLength(3)
      expect(blocks[0].type).toBe('markdown')
      expect(blocks[1].type).toBe('index')
      expect(blocks[1].content).toContain('"totalMatched": 2')
      expect(blocks[2].type).toBe('markdown')
    })

    it('parses <<<LUMINA_INDEX_QUERY:...>>> markers as index blocks', () => {
      const content = `Index results:\n\n<<<LUMINA_INDEX_QUERY:{"totalWorkspaceNotes": 4, "totalMatched": 1, "notes": [{"title": "Note A"}]}>>>\n\nHope this helps!`
      const blocks = parseMessageBlocks(content)
      expect(blocks).toHaveLength(3)
      expect(blocks[0].type).toBe('markdown')
      expect(blocks[1].type).toBe('index')
      expect(blocks[1].content).toContain('<<<LUMINA_INDEX_QUERY:')
      expect(blocks[2].type).toBe('markdown')
    })
  })

  describe('Leaked XML Tool Parsing & Execution (DSML / Pseudo-Tags)', () => {
    it('thoroughly cleans raw leaked XML and dangling tag artifacts', async () => {
      const { cleanRawToolLeaks } = await import('../../../../../../src/renderer/src/features/AI/services/aiStreamRunner')
      const leaked = `I'll run a structured index query across your workspace to give you a full picture of shape.\n\nluminaQueryIndex"> <query></query> <sortBy>modified</sortBy> limit>100</limit> </luminaQueryIndex>`
      const cleaned = cleanRawToolLeaks(leaked)
      expect(cleaned).not.toContain('luminaQueryIndex')
      expect(cleaned).not.toContain('<query>')
      expect(cleaned).not.toContain('<sortBy>')
      expect(cleaned).not.toContain('limit>')
      expect(cleaned).toContain("I'll run a structured index query")
    })

    it('intercepts, executes, and cleans leaked luminaQueryIndex pseudo-XML', async () => {
      const { parseAndExecuteDSML } = await import('../../../../../../src/renderer/src/features/AI/services/aiStreamRunner')
      const leaked = `I will inspect your workspace notes.\n\nluminaQueryIndex"> <query>physics</query> <sortBy>modified</sortBy> limit>100</limit> </luminaQueryIndex>`
      const sdkTools = {
        luminaQueryIndex: luminaQueryIndexTool
      }
      const executedActions: string[] = []
      const { cleanedText, didExecute, toolOutputs } = await parseAndExecuteDSML(leaked, sdkTools, executedActions)

      expect(didExecute).toBe(true)
      expect(toolOutputs).toHaveLength(1)
      expect(toolOutputs[0].type).toBe('index')
      expect(toolOutputs[0].content).toContain('Quantum Computing')
      expect(cleanedText).not.toContain('luminaQueryIndex')
      expect(cleanedText).not.toContain('<query>')
      expect(cleanedText).toContain('I will inspect your workspace notes.')
    })
  })
})
