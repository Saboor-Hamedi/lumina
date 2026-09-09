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
 * Parses a raw assistant message into structured segments:
 * - thinkContent: Deep reasoning inside <think>...</think>
 * - activityContent: File mutations inside <lumina-activity> or implicit action lines
 * - beforeContent / afterContent: Conversational markdown surrounding activities
 *
 * @param {string} content
 * @returns {{ thinkContent: string, beforeContent: string, activityContent: string, afterContent: string }}
 */
export const parseMessageSections = (content) => {
  if (!content) {
    return { thinkContent: '', beforeContent: '', activityContent: '', afterContent: '' }
  }

  let think = ''
  let remaining = content

  const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i)
  if (thinkMatch) {
    think = thinkMatch[1]
    remaining = remaining.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim()
  }

  let beforeText = ''
  let activityText = ''
  let afterText = ''

  const actMatches = [...remaining.matchAll(/<lumina-activity>([\s\S]*?)<\/lumina-activity>/gi)]
  if (actMatches.length > 0) {
    activityText = actMatches.map((m) => (m[1] || '').trim()).filter(Boolean).join('\n')
    const firstIdx = remaining.search(/<lumina-activity>/i)
    const lastIdx = remaining.toLowerCase().lastIndexOf('</lumina-activity>')
    beforeText = firstIdx !== -1 ? remaining.slice(0, firstIdx).trim() : ''
    afterText = lastIdx !== -1 ? remaining.slice(lastIdx + '</lumina-activity>'.length).trim() : ''
  } else {
    const partialAct = remaining.match(/([\s\S]*?)<lumina-activity>([\s\S]*)$/i)
    if (partialAct) {
      beforeText = (partialAct[1] || '').trim()
      activityText = (partialAct[2] || '').trim()
    } else {
      const lines = remaining.split('\n')
      const actionLines = []
      let firstActionIdx = -1
      let lastActionIdx = -1

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i].trim()
        if (!l) continue
        if (isActionLine(l)) {
          if (firstActionIdx === -1) firstActionIdx = i
          lastActionIdx = i
          actionLines.push(l)
        } else if (firstActionIdx !== -1) {
          break
        }
      }

      if (actionLines.length >= 1 && firstActionIdx !== -1) {
        activityText = actionLines.join('\n')
        beforeText = lines.slice(0, firstActionIdx).join('\n').trim()
        afterText = lines.slice(lastActionIdx + 1).join('\n').trim()
      } else {
        beforeText = remaining
      }
    }
  }

  beforeText = beforeText.replace(/<\/?lumina-activity>/gi, '').trim()
  afterText = afterText.replace(/<\/?lumina-activity>/gi, '').trim()

  return {
    thinkContent: think,
    beforeContent: beforeText,
    activityContent: activityText,
    afterContent: afterText
  }
}
