import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  auditWikilinksTool,
  extractWikilinks
} from '../../../../../../src/renderer/src/features/AI/tools/auditWikilinks'
import {
  detectUserIntent,
  IntentCategory
} from '../../../../../../src/renderer/src/features/AI/services/intentRouter'
import { buildSystemPrompt } from '../../../../../../src/renderer/src/features/AI/services/aiPromptBuilder'
import { getAIMode } from '../../../../../../src/renderer/src/features/AI/modes/index'
import { useWorkspaceStore } from '../../../../../../src/renderer/src/core/store/workspaceStore'

describe('Conversational Link & Orphan Audit Tool (auditWikilinks)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useWorkspaceStore.setState({
      notes: [
        {
          id: 'note-1',
          title: 'Architecture',
          fileName: 'Architecture.md',
          code: '# System Overview\nConnects to [[System Design]] and points to [[Missing Component]].',
          folderId: 'Core'
        },
        {
          id: 'note-2',
          title: 'System Design',
          fileName: 'System Design.md',
          code: '# Detailed Architecture\nRefers back to [[Architecture]].',
          folderId: 'Core'
        },
        {
          id: 'note-3',
          title: 'Standalone Idea',
          fileName: 'Standalone Idea.md',
          code: '# An isolated thought\nNo links here at all.',
          folderId: 'Notes'
        }
      ],
      snippets: [],
      folders: ['Core', 'Notes']
    } as any)
  })

  it('extracts wikilinks accurately, handling aliases and anchors', () => {
    const markdown = 'See [[Note A]] and [[Note B|Custom Label]] and [[Note C#Section Header]].'
    const links = extractWikilinks(markdown)
    expect(links).toEqual(['Note A', 'Note B', 'Note C'])
  })

  it('ignores code blocks and Python double-bracket list literals', () => {
    const markdown = `
Here is a real link to [[Deep Learning]].
\`\`\`python
tensors = [[1.0, 2.0], [3.0, 4.0]]
cmd = [["pytest", "-q"], "python", "script.py"]
\`\`\`
Also an inline code sample: \`[[raw_data]]\`
And another genuine link: [[Pandas Advanced]].
`
    const links = extractWikilinks(markdown)
    expect(links).toEqual(['Deep Learning', 'Pandas Advanced'])
  })

  it('accurately identifies broken links, healthy connections, and orphan notes', async () => {
    const result = await auditWikilinksTool.execute({})

    expect(result.success).toBe(true)
    const data = result.result as any

    expect(data.totalNotesScanned).toBe(3)
    expect(data.totalLinksFound).toBe(3)
    expect(data.brokenLinksCount).toBe(1)
    expect(data.brokenLinks[0].targetNote).toBe('Missing Component')
    expect(data.brokenLinks[0].sourceNote).toBe('Architecture')

    expect(data.orphanNotesCount).toBe(1)
    expect(data.orphanNotes).toContain('Standalone Idea')

    expect(data.healthyLinksCount).toBe(2)

    // Summary formatting checks
    expect(result.summary).toContain('Workspace Link Audit Report')
    expect(result.summary).toContain('Broken / Missing Links')
    expect(result.summary).toContain('Orphan Notes')
    expect(result.summary).toContain('Missing Component')
    expect(result.summary).toContain('Standalone Idea')

    // Zero technical jargon
    expect(result.summary).not.toContain('CodeMirror')
    expect(result.summary).not.toContain('IPC')
    expect(result.summary).not.toContain('AST')
  })

  it('routes natural conversational questions to AUDIT_WIKILINKS intent', () => {
    // The exact query the user asked Lumina in bugs.md
    expect(detectUserIntent('do you know how many files do not have wikilink or broken?')).toBe(
      IntentCategory.AUDIT_WIKILINKS
    )
    expect(detectUserIntent('how many files do not have wikilink or broken')).toBe(
      IntentCategory.AUDIT_WIKILINKS
    )
    expect(detectUserIntent('check my wikilinks')).toBe(IntentCategory.AUDIT_WIKILINKS)
    expect(detectUserIntent('find broken links in workspace')).toBe(IntentCategory.AUDIT_WIKILINKS)
    expect(detectUserIntent('which notes are orphans?')).toBe(IntentCategory.AUDIT_WIKILINKS)
    expect(detectUserIntent('audit wikilinks')).toBe(IntentCategory.AUDIT_WIKILINKS)
    expect(detectUserIntent('how many orphan notes do I have?')).toBe(IntentCategory.AUDIT_WIKILINKS)
  })

  it('injects mandatory execution directive in system prompt for AUDIT_WIKILINKS', async () => {
    const modeCfg = getAIMode('Plan')
    const prompt = await buildSystemPrompt({
      modeCfg,
      detectedIntent: IntentCategory.AUDIT_WIKILINKS
    })

    expect(prompt).toContain('CRITICAL MANDATORY WIKILINK AUDIT INSTRUCTION')
    expect(prompt).toContain('auditWikilinks')
    expect(prompt).toContain(
      'Do NOT claim that you cannot inspect files or cannot scan the workspace.'
    )
  })

  it('parses <lumina-audit> blocks in parseMessageBlocks for UI badge rendering', async () => {
    const { parseMessageBlocks } = await import(
      '../../../../../../src/renderer/src/features/AI/services/chatMarkdownParser'
    )

    const rawMessage = `Here is your scan report:
<lumina-audit>
{"totalNotesScanned":3114,"totalLinksFound":4200,"healthyLinksCount":4180,"brokenLinksCount":20,"orphanNotesCount":5,"isScanning":false}
</lumina-audit>
Everything looks well organized!`

    const blocks = parseMessageBlocks(rawMessage)
    expect(blocks.length).toBe(3)
    expect(blocks[0].type).toBe('markdown')
    expect(blocks[0].content).toContain('Here is your scan report:')
    expect(blocks[1].type).toBe('audit')
    expect(blocks[1].content).toContain('"totalNotesScanned":3114')
    expect(blocks[2].type).toBe('markdown')
    expect(blocks[2].content).toContain('Everything looks well organized!')
  })

  it('buildRealtimeDisplay emits <lumina-audit> for audit timeline segments', async () => {
    const { buildRealtimeDisplay } = await import(
      '../../../../../../src/renderer/src/features/AI/services/aiStreamRunner'
    )

    const timeline = [
      { type: 'think', content: 'Scanning graph connections...' },
      { type: 'audit', content: JSON.stringify({ isScanning: true }), isExecuting: true }
    ]

    const display = buildRealtimeDisplay({ timeline })
    expect(display).toContain('<think>\nScanning graph connections...\n</think>')
    expect(display).toContain('<lumina-audit>\n{"isScanning":true}\n</lumina-audit>')
  })
})
