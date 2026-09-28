/**
 * chatMarkdownParser.ts
 * Specialized parsers for Lumina chat message markdown, wikilinks, reasoning blocks,
 * and background activity stream tokens.
 */

export interface MessageBlock {
  type: 'think' | 'activity' | 'memory' | 'audit' | 'health' | 'index' | 'markdown'
  content: string
}

export interface MessageSections {
  thinkContent: string
  beforeContent: string
  activityContent: string
  afterContent: string
}

/**
 * Normalizes wikilinks, file reads, and ASCII tree lines in raw markdown.
 */
export const processMarkdownContent = (raw?: string): string => {
  if (!raw) return ''
  let processed = raw.replace(/<readFile>([\s\S]*?)<\/readFile>/g, (_match, inner) => {
    const titleMatch = inner.match(/title:\s*"([^"]+)"/)
    const fileName = titleMatch ? titleMatch[1] : 'File'
    return `\n> 📄 **Reading:** ${fileName}\n`
  })

  // If backticks wrap a wikilink like `[[Title]]`, unwrap the backticks first
  processed = processed.replace(/`(\[\[.*?\]\])`/g, '$1')

  processed = processed.replace(/\[\[(.*?)\]\]/g, (_match, inner) => {
    const [target, alias] = inner.split('|')
    const cleanTarget = target.trim()
    const displayText = (alias || cleanTarget).trim()
    return `[${displayText}](wikilink:${encodeURIComponent(cleanTarget)})`
  })

  processed = processed.replace(/([^\n│├└─\s])\s*([├└]──)/g, '$1\n$2')

  return processed
}

/**
 * Checks if a line represents a filesystem activity / mutation.
 */
const isActionLine = (l: string): boolean => {
  return (
    l.startsWith('- Created') ||
    l.startsWith('Created folder') ||
    l.startsWith('Renamed folder') ||
    l.startsWith('Renamed note') ||
    l.startsWith('Renamed file') ||
    l.startsWith('- 📁') ||
    l.startsWith('- 📝') ||
    l.startsWith('📁 *Creating') ||
    l.startsWith('📝 *Drafting') ||
    /^(?:[-*•]\s*)?(?:Created|Renamed)\s+(?:folder|\*\*|\[\[|[a-zA-Z0-9_]+)/i.test(l)
  )
}

/**
 * Parses a raw assistant message into ordered sequential blocks:
 * - think: Deep reasoning inside <think>...</think> (can appear multiple times in sequence)
 * - activity: File mutations inside <lumina-activity> or implicit action lines
 * - markdown: Conversational text / walkthrough
 */
export const parseMessageBlocks = (content?: string): MessageBlock[] => {
  if (!content || typeof content !== 'string') return []

  const stripDSML = (txt: string) =>
    (txt || '')
      .replace(/<[｜|]{1,2}[\s\S]*?[｜|]{1,2}>/g, '')
      .replace(/<[^>]*(?:DSML|tool_calls?)[^>]*>/gi, '')
      .replace(
        /<\/?(?:tool_calls?|invoke|parameter|luminaQueryIndex|queryIndex|luminaDiagnoseSystem|diagnoseSystem|auditWikilinks)[^>]*>/gi,
        ''
      )
      .replace(
        /<(?:query|sortby|limit|tag|folder|linksTo|backlinksFor|hasFrontmatter|hasHeadings)>[\s\S]*?<\/(?:query|sortby|limit|tag|folder|linksTo|backlinksFor|hasFrontmatter|hasHeadings)>/gi,
        ''
      )
      .replace(/limit>\s*\d+\s*<\/limit>/gi, '')
      .replace(/(?:^|\s)[a-zA-Z0-9_-]+">\s*/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

  const blocks: MessageBlock[] = []
  const tagRegex = /(?:<think>([\s\S]*?)(?:<\/think>|$))|(?:<lumina-activity>([\s\S]*?)(?:<\/lumina-activity>|$))|(?:<lumina-memory>([\s\S]*?)(?:<\/lumina-memory>|$))|(?:<lumina-audit>([\s\S]*?)(?:<\/lumina-audit>|$))|(?:<lumina-health>([\s\S]*?)(?:<\/lumina-health>|$))|(?:<lumina-index>([\s\S]*?)(?:<\/lumina-index>|$))/gi
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(content)) !== null) {
    const textBefore = content.slice(lastIndex, match.index)
    const cleanBefore = stripDSML(textBefore).replace(/<\/?(?:think|lumina-activity|lumina-memory|lumina-audit|lumina-health|lumina-index)>/gi, '').trim()
    if (cleanBefore) {
      blocks.push({ type: 'markdown', content: cleanBefore })
    }

    if (match[1] !== undefined) {
      const thinkText = stripDSML(match[1])
      if (thinkText) {
        blocks.push({ type: 'think', content: thinkText })
      }
    } else if (match[2] !== undefined) {
      const actText = (match[2] || '').trim()
      if (actText) {
        blocks.push({ type: 'activity', content: actText })
      }
    } else if (match[3] !== undefined) {
      const memText = (match[3] || '').trim()
      if (memText) {
        blocks.push({ type: 'memory', content: memText })
      }
    } else if (match[4] !== undefined) {
      const auditText = (match[4] || '').trim()
      if (auditText) {
        blocks.push({ type: 'audit', content: auditText })
      }
    } else if (match[5] !== undefined) {
      const healthText = (match[5] || '').trim()
      if (healthText) {
        blocks.push({ type: 'health', content: healthText })
      }
    } else if (match[6] !== undefined) {
      const indexText = (match[6] || '').trim()
      if (indexText) {
        blocks.push({ type: 'index', content: indexText })
      }
    }

    lastIndex = tagRegex.lastIndex
  }

  const trailingText = content.slice(lastIndex)
  const cleanTrailing = stripDSML(trailingText).replace(/<\/?(?:think|lumina-activity|lumina-memory|lumina-audit|lumina-health|lumina-index)>/gi, '').trim()
  if (cleanTrailing) {
    blocks.push({ type: 'markdown', content: cleanTrailing })
  }

  // Fallback for raw action lines without <lumina-activity> tags
  if (blocks.length === 1 && blocks[0].type === 'markdown') {
    const lines = blocks[0].content.split('\n')
    const actionLines: string[] = []
    let firstActionIdx = -1
    let lastActionIdx = -1
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim()
      if (l && isActionLine(l)) {
        if (firstActionIdx === -1) firstActionIdx = i
        lastActionIdx = i
        actionLines.push(l)
      } else if (firstActionIdx !== -1) {
        break
      }
    }
    if (actionLines.length > 0 && firstActionIdx !== -1) {
      const before = lines.slice(0, firstActionIdx).join('\n').trim()
      const after = lines.slice(lastActionIdx + 1).join('\n').trim()
      const fallbackBlocks: MessageBlock[] = []
      if (before) fallbackBlocks.push({ type: 'markdown', content: before })
      fallbackBlocks.push({ type: 'activity', content: actionLines.join('\n') })
      if (after) fallbackBlocks.push({ type: 'markdown', content: after })
      return fallbackBlocks
    }
  }

  // Fallback for <<<LUMINA_INDEX_QUERY:...>>> markers without <lumina-index> tags
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type === 'markdown' && blocks[i].content.includes('<<<LUMINA_INDEX_QUERY:')) {
      const fullText = blocks[i].content
      const markerMatch = fullText.match(/<<<LUMINA_INDEX_QUERY:[\s\S]*?>>>/)
      if (markerMatch && markerMatch.index !== undefined) {
        const before = fullText.slice(0, markerMatch.index).trim()
        const indexContent = markerMatch[0]
        const after = fullText.slice(markerMatch.index + markerMatch[0].length).trim()

        const replacement: MessageBlock[] = []
        if (before) replacement.push({ type: 'markdown', content: before })
        replacement.push({ type: 'index', content: indexContent })
        if (after) replacement.push({ type: 'markdown', content: after })

        blocks.splice(i, 1, ...replacement)
        break
      }
    }
  }

  // Fallback for raw index query tables without <lumina-index> tags
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type === 'markdown' && blocks[i].content.includes('### 🔍 Workspace Index Query Results')) {
      const fullText = blocks[i].content
      const idx = fullText.indexOf('### 🔍 Workspace Index Query Results')
      const before = fullText.slice(0, idx).trim()
      const remainder = fullText.slice(idx)
      const tableEndMatch = remainder.match(/(?:\|[^\n]+\|\n?)(?:\n(?![|*]))/i)
      const endIdx = tableEndMatch && tableEndMatch.index !== undefined
        ? tableEndMatch.index + tableEndMatch[0].length
        : remainder.length
      const indexContent = remainder.slice(0, endIdx).trim()
      const after = remainder.slice(endIdx).trim()

      const replacement: MessageBlock[] = []
      if (before) replacement.push({ type: 'markdown', content: before })
      replacement.push({ type: 'index', content: indexContent })
      if (after) replacement.push({ type: 'markdown', content: after })

      blocks.splice(i, 1, ...replacement)
      break
    }
  }

  // A provider can render the same diagnostic result once from the native tool
  // stream and again from its final XML response. Keep the final badge only.
  const healthIndexes = blocks.reduce<number[]>((indexes, block, index) => {
    if (block.type === 'health') indexes.push(index)
    return indexes
  }, [])
  if (healthIndexes.length > 1) {
    for (const index of healthIndexes.slice(0, -1).reverse()) blocks.splice(index, 1)
  }

  const thinkBlocks = blocks.filter((b) => b.type === 'think')
  if (thinkBlocks.length > 0) {
    const mergedThink = thinkBlocks.map((b) => b.content).filter(Boolean).join('\n\n')
    const firstThinkIdx = blocks.findIndex((b) => b.type === 'think')
    const beforeFirstThink = blocks.slice(0, firstThinkIdx).filter((b) => b.type !== 'think')
    const afterFirstThink = blocks.slice(firstThinkIdx + 1).filter((b) => b.type !== 'think')
    return [...beforeFirstThink, { type: 'think', content: mergedThink }, ...afterFirstThink]
  }

  return blocks
}

/**
 * Parses a raw assistant message into structured segments (legacy compatibility).
 */
export const parseMessageSections = (content?: string): MessageSections => {
  if (!content) {
    return { thinkContent: '', beforeContent: '', activityContent: '', afterContent: '' }
  }

  const blocks = parseMessageBlocks(content)
  const thinks: string[] = []
  let beforeText = ''
  let activityText = ''
  let afterText = ''
  let foundActivity = false

  for (const block of blocks) {
    if (block.type === 'think') {
      thinks.push(block.content)
    } else if (block.type === 'activity') {
      activityText = activityText ? `${activityText}\n${block.content}` : block.content
      foundActivity = true
    } else if (block.type === 'markdown') {
      if (!foundActivity) {
        beforeText = beforeText ? `${beforeText}\n\n${block.content}` : block.content
      } else {
        afterText = afterText ? `${afterText}\n\n${block.content}` : block.content
      }
    }
  }

  return {
    thinkContent: thinks.join('\n\n'),
    beforeContent: beforeText,
    activityContent: activityText,
    afterContent: afterText
  }
}
