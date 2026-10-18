/** @vitest-environment jsdom */
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useWorkspaceStore } from '../../../../../../src/renderer/src/core/store/workspaceStore'
import {
  resolveWorkspaceEntity,
  navigateToWorkspaceEntity,
  classifySnippetEntityType
} from '../../../../../../src/renderer/src/features/AI/services/entityResolver'
import { LuminaEntityMention } from '../../../../../../src/renderer/src/features/AI/components/LuminaEntityMention'
import { MessageContent } from '../../../../../../src/renderer/src/features/AI/components/LuminaMessageContent'
import { buildSystemPrompt } from '../../../../../../src/renderer/src/features/AI/services/prompt/promptOrchestrator'

describe('Lumina Rich Entity Resolution, Icons & Structured Folder Rendering (bugs.md)', () => {
  const mockSetSelectedNote = vi.fn()
  const mockSetActiveTabId = vi.fn()
  const mockSetSelectedFolder = vi.fn()

  const sampleNotes = [
    {
      id: 'mysql-1',
      title: 'Introduction Mysql',
      fileName: 'Introduction Mysql.md',
      folderId: 'MySql',
      code: '# Introduction to MySQL',
      language: 'markdown'
    },
    {
      id: 'mysql-2',
      title: 'Installing Mysql',
      fileName: 'Installing Mysql.md',
      folderId: 'MySql',
      code: '# Installing MySQL',
      language: 'markdown'
    },
    {
      id: 'mysql-3',
      title: 'Joins Mysql',
      fileName: 'Joins Mysql.md',
      folderId: 'MySql/Advanced',
      code: '# SQL Joins',
      language: 'markdown'
    },
    {
      id: 'mysql-sql',
      title: 'schema.sql',
      fileName: 'schema.sql',
      folderId: 'MySql',
      code: 'CREATE TABLE users (id INT);',
      language: 'sql'
    },
    {
      id: 'asset-pdf',
      title: 'MySQL Reference Manual.pdf',
      fileName: 'MySQL Reference Manual.pdf',
      folderId: 'MySql',
      type: 'pdf',
      language: 'pdf'
    },
    {
      id: 'asset-img',
      title: 'ER-Schema.png',
      fileName: 'ER-Schema.png',
      folderId: 'MySql',
      type: 'image',
      language: 'image'
    },
    {
      id: 'asset-diag',
      title: 'Database Architecture.canvas',
      fileName: 'Database Architecture.canvas',
      folderId: 'MySql',
      language: 'canvas',
      code: '{"nodes":[]}'
    },
    {
      id: 'dup-mysql-intro',
      title: 'Introduction',
      fileName: 'Introduction.md',
      folderId: 'MySql',
      code: 'MySQL specific intro'
    },
    {
      id: 'dup-python-intro',
      title: 'Introduction',
      fileName: 'Introduction.md',
      folderId: 'Python',
      code: 'Python specific intro'
    }
  ]

  const sampleFolders = ['MySql', 'MySql/Advanced', 'Python', 'EmptyFolder']

  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceStore.setState({
      notes: sampleNotes as any,
      folders: sampleFolders,
      folderColors: { MySql: '#f59e0b' },
      setSelectedNote: mockSetSelectedNote,
      setActiveTabId: mockSetActiveTabId,
      setSelectedFolder: mockSetSelectedFolder
    } as any)
  })

  it('1 & 2. Renders folder mentions with folder icons and note mentions with document icons', () => {
    const { container: folderContainer } = render(<LuminaEntityMention target="MySql" />)
    const folderChip = folderContainer.querySelector('.chat-entity-mention')
    expect(folderChip).toBeTruthy()
    expect(folderChip?.getAttribute('data-entity-type')).toBe('folder')
    expect(folderContainer.querySelector('svg.folder-icon')).toBeTruthy()
    expect(folderChip?.textContent).toContain('MySql')

    const { container: noteContainer } = render(
      <LuminaEntityMention target="Introduction Mysql" />
    )
    const noteChip = noteContainer.querySelector('.chat-entity-mention')
    expect(noteChip).toBeTruthy()
    expect(noteChip?.getAttribute('data-entity-type')).toBe('note')
    expect(noteContainer.querySelector('svg.file-icon')).toBeTruthy()
    expect(noteChip?.textContent).toContain('Introduction Mysql')
  })

  it('3. Renders images, diagrams, PDFs, and code files with their correct semantic icons', () => {
    expect(classifySnippetEntityType(sampleNotes[3] as any)).toBe('code')
    expect(classifySnippetEntityType(sampleNotes[4] as any)).toBe('pdf')
    expect(classifySnippetEntityType(sampleNotes[5] as any)).toBe('image')
    expect(classifySnippetEntityType(sampleNotes[6] as any)).toBe('diagram')

    const { container: pdfC } = render(
      <LuminaEntityMention target="MySQL Reference Manual.pdf" />
    )
    expect(pdfC.querySelector('.entity-type-pdf svg.pdf-icon')).toBeTruthy()

    const { container: imgC } = render(<LuminaEntityMention target="ER-Schema.png" />)
    expect(imgC.querySelector('.entity-type-image svg.image-icon')).toBeTruthy()

    const { container: diagC } = render(
      <LuminaEntityMention target="Database Architecture.canvas" />
    )
    expect(diagC.querySelector('.entity-type-diagram svg.diagram-icon')).toBeTruthy()

    const { container: codeC } = render(<LuminaEntityMention target="schema.sql" />)
    expect(codeC.querySelector('.entity-type-code svg.code-icon')).toBeTruthy()
  })

  it('4, 5, 6, 7. Preserves folder hierarchy, mixed entity types, and nested folders in AI markdown responses', () => {
    const aiResponse = `**Inside [[MySql]]**

_6 items available_

**Course contents**

- [[MySql]]
  - [[MySql/Introduction Mysql|Introduction Mysql]]
  - [[MySql/Installing Mysql|Installing Mysql]]
  - [[MySql/MySQL Reference Manual.pdf|MySQL Reference Manual.pdf]]
  - [[MySql/ER-Schema.png|ER-Schema.png]]
  - [[MySql/Database Architecture.canvas|Database Architecture.canvas]]
  - [[MySql/schema.sql|schema.sql]]
  - [[MySql/Advanced|Advanced]]
    - [[MySql/Advanced/Joins Mysql|Joins Mysql]]`

    const { container } = render(<MessageContent content={aiResponse} />)

    // Verify nested ul hierarchy exists
    const nestedLists = container.querySelectorAll('ul ul')
    expect(nestedLists.length).toBeGreaterThanOrEqual(2)

    // Verify all entity types rendered with SVG icons
    expect(container.querySelectorAll('.entity-type-folder svg.folder-icon').length).toBeGreaterThanOrEqual(3)
    expect(container.querySelectorAll('.entity-type-note svg.file-icon').length).toBe(3)
    expect(container.querySelectorAll('.entity-type-pdf svg.pdf-icon').length).toBe(1)
    expect(container.querySelectorAll('.entity-type-image svg.image-icon').length).toBe(1)
    expect(container.querySelectorAll('.entity-type-diagram svg.diagram-icon').length).toBe(1)
    expect(container.querySelectorAll('.entity-type-code svg.code-icon').length).toBe(1)
  })

  it('8. Clicking a note or folder entity navigates to the correct destination', () => {
    const { container } = render(
      <div>
        <LuminaEntityMention target="MySql" />
        <LuminaEntityMention target="Installing Mysql" />
      </div>
    )

    const chips = container.querySelectorAll('.chat-entity-mention')
    fireEvent.click(chips[0])
    expect(mockSetSelectedFolder).toHaveBeenCalledWith('MySql')

    fireEvent.click(chips[1])
    expect(mockSetSelectedNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mysql-2', title: 'Installing Mysql' })
    )
    expect(mockSetActiveTabId).toHaveBeenCalledWith('mysql-2')
  })

  it('9. Duplicate names in different directories resolve accurately using path or folder context', () => {
    const mysqlIntro = resolveWorkspaceEntity('MySql/Introduction', 'Introduction')
    const pythonIntro = resolveWorkspaceEntity('Python/Introduction', 'Introduction')

    expect(mysqlIntro.id).toBe('dup-mysql-intro')
    expect(mysqlIntro.folderId).toBe('MySql')

    expect(pythonIntro.id).toBe('dup-python-intro')
    expect(pythonIntro.folderId).toBe('Python')

    // Also resolves via contextFolder option when only basename is given
    const contextualPython = resolveWorkspaceEntity('Introduction', 'Introduction', {
      contextFolder: 'Python'
    })
    expect(contextualPython.id).toBe('dup-python-intro')

    navigateToWorkspaceEntity(pythonIntro)
    expect(mockSetSelectedNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'dup-python-intro' })
    )
  })

  it('10. Missing or deleted entities display a graceful fallback without crashing', () => {
    const missing = resolveWorkspaceEntity('NonExistentNote')
    expect(missing.exists).toBe(false)
    expect(missing.displayName).toBe('NonExistentNote')

    const { container } = render(<LuminaEntityMention target="NonExistentNote" />)
    const chip = container.querySelector('.chat-entity-mention.is-unresolved')
    expect(chip).toBeTruthy()
    expect(chip?.querySelector('svg')).toBeTruthy()
  })

  it('11 & 12. Preserves ordinary Markdown formatting, external URLs, code blocks, and streaming stability', () => {
    const markdown = `Here is a normal paragraph with **bold**, *italic*, and an [External Docs](https://mysql.com) link.

Inline mention of @MySql and [[Introduction Mysql]] works seamlessly.

\`\`\`sql
SELECT * FROM [[NotALinkInsideCodeBlock]];
\`\`\``

    const { container, rerender } = render(
      <MessageContent content={markdown.slice(0, 120)} isStreaming={true} />
    )
    rerender(<MessageContent content={markdown} isStreaming={false} />)

    const externalLink = container.querySelector('a.chat-external-link')
    expect(externalLink?.getAttribute('href')).toBe('https://mysql.com')

    // @MySql and [[Introduction Mysql]] resolved as entities
    expect(container.querySelector('.entity-type-folder')).toBeTruthy()
    expect(container.querySelector('.entity-type-note')).toBeTruthy()
  })

  it('14 & 15. Handles large folder listings responsively and buildSystemPrompt runs without ReferenceError', async () => {
    const start = performance.now()
    for (let i = 0; i < 200; i++) {
      resolveWorkspaceEntity('MySql/Introduction Mysql')
      resolveWorkspaceEntity('MySql')
    }
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(100)

    const prompt = await buildSystemPrompt({
      modeCfg: {
        id: 'code',
        name: 'Code',
        description: 'Code mode',
        icon: 'Code',
        enableTools: true,
        systemAddon: ''
      } as any,
      allSnippets: sampleNotes,
      allFolders: sampleFolders
    })

    expect(prompt).toContain('4 folders')
    expect(prompt).toContain('[[MySql]]')
    expect(prompt).toContain('[PDF]')
    expect(prompt).toContain('[Image]')
    expect(prompt).toContain('[Diagram]')
  })
})
