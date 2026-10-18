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

import {
  resolveWorkspaceEntity,
  stripLeadingEntityEmoji,
  getWorkspaceEntityCacheVersion
} from './entityResolver'

const _markdownProcessCache = new Map<string, string>()
let _lastEntityCacheVersion = -1
const MAX_MARKDOWN_CACHE_SIZE = 250

const LIST_OR_HEADING_FAST_RE = /(?:^|\n)\s*(?:[-*•]|\d+\.|#{1,4}\s|\*\*(?:Inside|Folder|Contents of))/i
const LEADING_EMOJI_FAST_RE = /[📁📂📄📝📃🖼️📊📈📉🗂️📕📗📘📙📓📔]/u

/**
 * Normalizes wikilinks, @mentions, structured folder/file list items, file reads,
 * and ASCII tree lines in raw markdown while preserving fenced code blocks.
 * Uses an O(1) bounded LRU cache and fast-path guards to keep streaming CPU load near zero.
 */
export const processMarkdownContent = (raw?: string): string => {
  if (!raw) return ''

  const currentVersion = getWorkspaceEntityCacheVersion()
  if (currentVersion !== _lastEntityCacheVersion) {
    _markdownProcessCache.clear()
    _lastEntityCacheVersion = currentVersion
  }

  const cached = _markdownProcessCache.get(raw)
  if (cached !== undefined) {
    return cached
  }

  // Fast exit if the text contains no special tokens, links, mentions, emojis, or list structures
  if (
    !raw.includes('[[') &&
    !raw.includes('@') &&
    !raw.includes('```') &&
    !raw.includes('<readFile>') &&
    !raw.includes('├──') &&
    !raw.includes('└──') &&
    !LEADING_EMOJI_FAST_RE.test(raw) &&
    !LIST_OR_HEADING_FAST_RE.test(raw)
  ) {
    if (_markdownProcessCache.size >= MAX_MARKDOWN_CACHE_SIZE) {
      const oldestKey = _markdownProcessCache.keys().next().value
      if (oldestKey !== undefined) _markdownProcessCache.delete(oldestKey)
    }
    _markdownProcessCache.set(raw, raw)
    return raw
  }

  // Protect fenced code blocks so we never alter code inside ```...```
  const codeBlocks: string[] = []
  let processed = raw.includes('```')
    ? raw.replace(/```[\s\S]*?(?:```|$)/g, (match) => {
        const idx = codeBlocks.length
        codeBlocks.push(match)
        return `@@LUMINA_CODE_BLOCK_${idx}@@`
      })
    : raw

  if (processed.includes('<readFile>')) {
    processed = processed.replace(/<readFile>([\s\S]*?)<\/readFile>/g, (_match, inner) => {
      const titleMatch = inner.match(/title:\s*"([^"]+)"/)
      const fileName = titleMatch ? titleMatch[1] : 'File'
      return `\n> **Reading:** [[${fileName}]]\n`
    })
  }

  // If backticks wrap a wikilink like `[[Title]]`, unwrap the backticks first
  if (processed.includes('`[[')) {
    processed = processed.replace(/`(\[\[.*?\]\])`/g, '$1')
  }

  // Strip redundant literal file/folder emojis immediately preceding a wikilink or markdown link
  if (LEADING_EMOJI_FAST_RE.test(processed)) {
    processed = processed.replace(
      /(?:[📁📂📄📝📃🖼️📊📈📉🗂️📕📗📘📙📓📔]\s*)+(?=\[\[|\[[^\]]+\]\()/gu,
      ''
    )
  }

  // Convert [[target|alias]] and [[target]] to structured wikilink markdown links
  if (processed.includes('[[')) {
    processed = processed.replace(/\[\[(.*?)\]\]/g, (_match, inner) => {
      const [target, alias] = inner.split('|')
      const cleanTarget = stripLeadingEntityEmoji(target.trim())
      const displayText = stripLeadingEntityEmoji((alias || cleanTarget).trim()) || cleanTarget
      return `[${displayText}](wikilink:${encodeURIComponent(cleanTarget)})`
    })
  }

  // Convert explicit @[Entity] and @Entity mentions in assistant responses
  if (processed.includes('@')) {
    processed = processed.replace(/(^|[\s(])@\[([^\]]+)\]/gm, (_match, prefix, inner) => {
      const cleanTarget = stripLeadingEntityEmoji(inner.trim())
      if (!cleanTarget) return _match
      return `${prefix}[${cleanTarget}](wikilink:${encodeURIComponent(cleanTarget)})`
    })

    processed = processed.replace(
      /(^|[\s(])@([a-zA-Z0-9_\-./]+(?:\s+[a-zA-Z0-9_\-./]+){0,4})/gm,
      (fullMatch, prefix, candidate) => {
        const words = candidate.split(/\s+/)
        for (let len = words.length; len >= 1; len--) {
          const rawAttempt = words.slice(0, len).join(' ')
          const punctMatch = rawAttempt.match(/[.,!?:;)]+$/)
          const trailingPunc = punctMatch ? punctMatch[0] : ''
          const cleanAttempt = trailingPunc
            ? rawAttempt.slice(0, -trailingPunc.length).trim()
            : rawAttempt.trim()
          if (!cleanAttempt) continue

          const resolved = resolveWorkspaceEntity(cleanAttempt, undefined, { strictMatch: true })
          if (resolved.exists && resolved.type !== 'external') {
            const remaining = words.slice(len).join(' ')
            const scheme = resolved.type === 'folder' ? 'folder:' : 'wikilink:'
            const displayName = cleanAttempt.split('/').pop() || cleanAttempt
            const link = `[${displayName}](${scheme}${encodeURIComponent(resolved.relativePath || cleanAttempt)})`
            return `${prefix}${link}${trailingPunc}${remaining ? ` ${remaining}` : ''}`
          }
        }
        return fullMatch
      }
    )
  }

  // Only scan list items when list/heading markers exist
  if (LIST_OR_HEADING_FAST_RE.test(processed)) {
    const lines = processed.split('\n')
    const folderStack: Array<{ indent: number; folderPath: string }> = []

    const enhancedLines = lines.map((line) => {
      const trimmedStart = line.trimStart()
      if (!trimmedStart) return line
      const firstChar = trimmedStart[0]
      const isHeadingCandidate = firstChar === '#' || firstChar === '*'
      const isListCandidate =
        firstChar === '-' ||
        firstChar === '*' ||
        firstChar === '•' ||
        (firstChar >= '0' && firstChar <= '9')

      if (!isHeadingCandidate && !isListCandidate) return line

      if (isHeadingCandidate) {
        const headingFolderMatch = line.match(
          /^(?:#{1,4}|\*\*)\s*(?:Inside|Folder|Contents of)\s+(?:\[([^\]]+)\]\([^)]+\)|`?([^`*\n]+)`?)/i
        )
        if (headingFolderMatch) {
          const candidateFolder = (headingFolderMatch[1] || headingFolderMatch[2] || '').trim()
          const resolvedHeading = resolveWorkspaceEntity(candidateFolder, undefined, {
            preferFolder: true,
            strictMatch: true
          })
          if (resolvedHeading.exists && resolvedHeading.type === 'folder') {
            folderStack.length = 0
            folderStack.push({ indent: -1, folderPath: resolvedHeading.relativePath })
          }
        }
      }

      if (!isListCandidate) return line

      const listMatch = line.match(/^(\s*(?:[-*•]|\d+\.)\s+)(.+)$/)
      if (!listMatch) return line

      const [, listPrefix, rawRest] = listMatch
      const indent = line.length - trimmedStart.length

      while (folderStack.length > 0 && folderStack[folderStack.length - 1].indent >= indent) {
        folderStack.pop()
      }
      const activeContextFolder =
        folderStack.length > 0 ? folderStack[folderStack.length - 1].folderPath : undefined

      // If the list item already starts with a wikilink/folder link, track folder hierarchy and strip duplicate emojis
      if (rawRest.includes('](wikilink:') || rawRest.includes('](folder:')) {
        const existingLinkMatch = rawRest.match(
          /^(?:[📁📂📄📝📃🖼️📊📈📉🗂️📕📗📘📙📓📔]\s*)*(\*\*|_)?\[([^\]]+)\]\((wikilink:|folder:)([^)]+)\)(\1)?(.*)$/u
        )
        if (existingLinkMatch) {
          const [, wrap, label, scheme, encodedTarget, closeWrap, tail] = existingLinkMatch
          let decodedTarget = encodedTarget
          try {
            decodedTarget = decodeURIComponent(encodedTarget)
          } catch {
            decodedTarget = encodedTarget
          }
          const resolved = resolveWorkspaceEntity(decodedTarget, label, {
            contextFolder: activeContextFolder,
            preferFolder: scheme.toLowerCase() === 'folder:'
          })
          if (resolved.exists && resolved.type === 'folder') {
            folderStack.push({ indent, folderPath: resolved.relativePath })
          }
          const finalTarget = resolved.exists ? resolved.relativePath : decodedTarget
          const finalScheme = resolved.type === 'folder' ? 'folder:' : 'wikilink:'
          const cleanLabel = stripLeadingEntityEmoji(label) || label
          return `${listPrefix}${wrap || ''}[${cleanLabel}](${finalScheme}${encodeURIComponent(finalTarget)})${closeWrap || ''}${tail}`
        }
      }

      // Do not modify list items that already contain markdown links
      if (rawRest.includes('](')) return line

      const trimmedRest = rawRest.trim()
      const hadFolderHint = /^[📁📂🗂️]/u.test(trimmedRest) || trimmedRest.endsWith('/')
      const strippedRest = stripLeadingEntityEmoji(trimmedRest)

      // Case A: List item with title + description separator (e.g. `- **Introduction Mysql** — Overview...`)
      const splitMatch = strippedRest.match(
        /^(?:\*\*([^*\n]+)\*\*|`([^`\n]+)`|([A-Za-z0-9_.\-/ ]{2,60}?))(\s+(?:—|--|-|:)\s+.+)$/
      )
      if (splitMatch) {
        const candidateTitle = (splitMatch[1] || splitMatch[2] || splitMatch[3] || '')
          .trim()
          .replace(/\/+$/, '')
        const descriptionTail = splitMatch[4]
        if (candidateTitle) {
          const resolved = resolveWorkspaceEntity(candidateTitle, candidateTitle, {
            contextFolder: activeContextFolder,
            preferFolder: hadFolderHint,
            strictMatch: true
          })
          if (resolved.exists && resolved.type !== 'external') {
            if (resolved.type === 'folder') {
              folderStack.push({ indent, folderPath: resolved.relativePath })
            }
            const scheme = resolved.type === 'folder' ? 'folder:' : 'wikilink:'
            return `${listPrefix}[${resolved.displayName}](${scheme}${encodeURIComponent(resolved.relativePath)})${descriptionTail}`
          }
        }
      }

      // Case B: Standalone entity list item (e.g. `- 📁 MySql`, `- **Introduction Mysql**`, `  - Installing Mysql (2 notes)`)
      if (strippedRest.length <= 90) {
        const standaloneMatch = strippedRest.match(
          /^(?:\*\*([^*\n]+)\*\*|`([^`\n]+)`|([^(\n]+?))(?:\s*(\([^)\n]+\)))?$/
        )
        if (standaloneMatch) {
          const rawCandidate = (standaloneMatch[1] || standaloneMatch[2] || standaloneMatch[3] || '')
            .trim()
            .replace(/\/+$/, '')
          const countSuffix = standaloneMatch[4] ? ` ${standaloneMatch[4]}` : ''
          if (rawCandidate && rawCandidate.length <= 80) {
            const resolved = resolveWorkspaceEntity(rawCandidate, rawCandidate, {
              contextFolder: activeContextFolder,
              preferFolder: hadFolderHint,
              strictMatch: true
            })
            if (resolved.exists && resolved.type !== 'external') {
              if (resolved.type === 'folder') {
                folderStack.push({ indent, folderPath: resolved.relativePath })
              }
              const scheme = resolved.type === 'folder' ? 'folder:' : 'wikilink:'
              return `${listPrefix}[${resolved.displayName}](${scheme}${encodeURIComponent(resolved.relativePath)})${countSuffix}`
            }
          }
        }
      }

      return line
    })

    processed = enhancedLines.join('\n')
  }

  if (processed.includes('──')) {
    processed = processed.replace(/([^\n│├└─\s])\s*([├└]──)/g, '$1\n$2')
  }

  // Restore protected fenced code blocks
  if (codeBlocks.length > 0) {
    processed = processed.replace(/@@LUMINA_CODE_BLOCK_(\d+)@@/g, (_m, idx) => {
      return codeBlocks[Number(idx)] || ''
    })
  }

  if (_markdownProcessCache.size >= MAX_MARKDOWN_CACHE_SIZE) {
    const oldestKey = _markdownProcessCache.keys().next().value
    if (oldestKey !== undefined) _markdownProcessCache.delete(oldestKey)
  }
  _markdownProcessCache.set(raw, processed)

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
    l.startsWith('- 📁 *Creating') ||
    l.startsWith('- 📝 *Drafting') ||
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
