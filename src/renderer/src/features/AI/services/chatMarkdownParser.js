/**
 * chatMarkdownParser.js
 * Specialized parsers for Lumina chat message markdown, wikilinks, reasoning blocks,
 * and background activity stream tokens.
 */

/**
 * Normalizes wikilinks, file reads, and ASCII tree lines in raw markdown.
 *
 * @param {string} raw
 * @returns {string}
 */
export const processMarkdownContent = (raw) => {
  if (!raw) return ''
  let processed = raw.replace(/<readFile>([\s\S]*?)<\/readFile>/g, (match, inner) => {
    const titleMatch = inner.match(/title:\s*"([^"]+)"/)
    const fileName = titleMatch ? titleMatch[1] : 'File'
    return `\n> 📄 **Reading:** ${fileName}\n`
  })

  // If backticks wrap a wikilink like `[[Title]]`, unwrap the backticks first
  processed = processed.replace(/`(\[\[.*?\]\])`/g, '$1')

  processed = processed.replace(/\[\[(.*?)\]\]/g, (match, inner) => {
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
 *
 * @param {string} l
 * @returns {boolean}
 */
const isActionLine = (l) => {
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
 *
 * @param {string} content
 * @returns {Array<{ type: 'think' | 'activity' | 'markdown', content: string }>}
 */
export const parseMessageBlocks = (content) => {
  if (!content || typeof content !== 'string') return []

  const stripDSML = (txt) =>
    (txt || '')
      .replace(/<[^>]*[｜|][^>]*>/g, '')
      .replace(/<[^>]*(?:DSML|tool_calls?)[^>]*>/gi, '')
      .trim()

  const blocks = []
  const tagRegex = /(?:<think>([\s\S]*?)(?:<\/think>|$))|(?:<lumina-activity>([\s\S]*?)(?:<\/lumina-activity>|$))|(?:<lumina-memory>([\s\S]*?)(?:<\/lumina-memory>|$))/gi
  let lastIndex = 0
  let match

  while ((match = tagRegex.exec(content)) !== null) {
    const textBefore = content.slice(lastIndex, match.index)
    const cleanBefore = stripDSML(textBefore).replace(/<\/?(?:think|lumina-activity|lumina-memory)>/gi, '').trim()
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
    }

    lastIndex = tagRegex.lastIndex
  }

  const trailingText = content.slice(lastIndex)
  const cleanTrailing = stripDSML(trailingText).replace(/<\/?(?:think|lumina-activity|lumina-memory)>/gi, '').trim()
  if (cleanTrailing) {
    blocks.push({ type: 'markdown', content: cleanTrailing })
  }

  // Fallback for raw action lines without <lumina-activity> tags
  if (blocks.length === 1 && blocks[0].type === 'markdown') {
    const lines = blocks[0].content.split('\n')
    const actionLines = []
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
      const fallbackBlocks = []
      if (before) fallbackBlocks.push({ type: 'markdown', content: before })
      fallbackBlocks.push({ type: 'activity', content: actionLines.join('\n') })
      if (after) fallbackBlocks.push({ type: 'markdown', content: after })
      return fallbackBlocks
    }
  }

  // Consolidate all think blocks into a single top think block
  const thinkBlocks = blocks.filter((b) => b.type === 'think')
  const nonThinkBlocks = blocks.filter((b) => b.type !== 'think')

  if (thinkBlocks.length > 0) {
    const mergedThink = thinkBlocks.map((b) => b.content).filter(Boolean).join('\n\n')
    return [{ type: 'think', content: mergedThink }, ...nonThinkBlocks]
  }

  return blocks
}

/**
 * Parses a raw assistant message into structured segments (legacy compatibility).
 *
 * @param {string} content
 * @returns {{ thinkContent: string, beforeContent: string, activityContent: string, afterContent: string }}
 */
export const parseMessageSections = (content) => {
  if (!content) {
    return { thinkContent: '', beforeContent: '', activityContent: '', afterContent: '' }
  }

  const blocks = parseMessageBlocks(content)
  const thinks = []
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
