const EMAIL_NON_CONTENT_SELECTOR =
  'script, style, meta, link, base, noscript, template, iframe, object, embed, form, input, button'
const EMAIL_HIDDEN_SELECTOR =
  '[hidden], [aria-hidden="true"], [style*="display:none"], [style*="display: none"], [style*="visibility:hidden"], [style*="visibility: hidden"]'
const TRACKING_QUERY_PARAMETERS = /^(utm_|trk|mc_|mkt_|vero_|oly_|_hs|hs|ref|referrer|lipi|midToken|midSig|trkEmail|eid|otpToken)/i

export function cleanEmailText(content: string | null | undefined): string {
  if (!content) return ''

  const cleaned = content
    .replace(/[\u034F\u061C\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, '')
    .replace(/\\\|/g, '|')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return cleaned
}

function cleanEmailUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return null
    if (url.protocol === 'mailto:') return value

    Array.from(url.searchParams.keys()).forEach((key) => {
      if (TRACKING_QUERY_PARAMETERS.test(key)) url.searchParams.delete(key)
    })
    return url.toString()
  } catch {
    return value
  }
}

export function sanitizeRichEmailHtml(content: string): string {
  if (typeof DOMParser === 'undefined') return cleanEmailText(content)

  const document = new DOMParser().parseFromString(content, 'text/html')
  document.querySelectorAll(EMAIL_NON_CONTENT_SELECTOR).forEach((element) => element.remove())
  document.querySelectorAll(EMAIL_HIDDEN_SELECTOR).forEach((element) => element.remove())
  document.querySelectorAll('[id], [class]').forEach((element) => {
    const identity = `${element.id} ${element.className}`.toLowerCase()
    if (/preheader|tracking[-_ ]?pixel|email[-_ ]?hidden/.test(identity)) element.remove()
  })

  const walker = document.createTreeWalker(document.body, 128)
  const comments: Comment[] = []
  let currentNode = walker.nextNode()
  while (currentNode) {
    comments.push(currentNode as Comment)
    currentNode = walker.nextNode()
  }
  comments.forEach((comment) => comment.remove())

  document.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on') || name === 'srcset' || name === 'formaction') {
        element.removeAttribute(attribute.name)
      }
    })
  })

  document.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') || ''
    const cleanedUrl = cleanEmailUrl(href)
    if (cleanedUrl) anchor.setAttribute('href', cleanedUrl)
    else anchor.removeAttribute('href')
    anchor.setAttribute('rel', 'noopener noreferrer')
  })

  document.querySelectorAll('img').forEach((image) => {
    const width = Number.parseInt(image.getAttribute('width') || '', 10)
    const height = Number.parseInt(image.getAttribute('height') || '', 10)
    const style = image.getAttribute('style') || ''
    const isHidden = /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|max-height\s*:\s*0/i.test(style)
    const isTrackingPixel = (width > 0 && width <= 1) || (height > 0 && height <= 1)

    if (isHidden || isTrackingPixel) {
      image.remove()
      return
    }

    image.setAttribute('loading', 'lazy')
    image.setAttribute('decoding', 'async')
  })

  return cleanEmailText(document.body.innerHTML)
}

const NAV_ONLY_KEYWORDS = [
  'messaging',
  'my network',
  'notifications',
  'jobs',
  'unsubscribe',
  'view profile',
  'manage your job alerts',
  'see all jobs',
  'settings'
]

const DECORATIVE_ALT_TEXT = /^(linkedin|apply|icon|logo|spacer|pixel|button)\b/i
const INVISIBLE_EMAIL_CHARACTERS = /[\u034F\u061C\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g

export interface EmailCleanupDiagnostics {
  bytesIn: number
  bytesOut: number
  removedCharacters: number
  removedImages: number
  removedLinks: number
  removedLines: number
  wasLarge: boolean
}

function stripBackslashEscapes(text: string): string {
  return text.replace(/\\+([|*_`~\[\]()#>.-])/g, '$1')
}

function stripDecorativeImages(text: string): string {
  return text.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_match, alt: string) => {
    const trimmedAlt = alt.trim()
    if (!trimmedAlt || DECORATIVE_ALT_TEXT.test(trimmedAlt)) return ''
    return trimmedAlt
  })
}

function stripDecorativeTableJunk(text: string): string {
  return text
    .replace(/(?:\|\s*(?:Apply|-{2,})?\s*){3,}/gi, ' ')
    .replace(/^\s*(?:\|\s*){2,}\s*$/gm, '')
    .replace(/^\s*[-|:\s]{3,}\s*$/gm, '')
    .replace(/^\s*(?:\|\s*)+$/gm, '')
}

function trimLineEdgeClutter(line: string): string {
  return line.replace(/^[\s|:-]+/, '').replace(/[\s|:-]+$/, '')
}

function unwrapJunkLinks(text: string): string {
  return text.replace(
    /\[([^\]]*)\]\(((?:https?:\/\/|mailto:)[^)\s]*)\)/g,
    (_match, label: string, url: string) => {
      const cleanLabel = label.replace(/[|*_\s-]+/g, ' ').trim()
      if (!cleanLabel) return ''
      const cleanedUrl = cleanEmailUrl(url)
      if (!cleanedUrl) return cleanLabel
      if (/linkedin\.com|licdn\.com/i.test(cleanedUrl)) return cleanLabel
      return cleanedUrl ? `[${cleanLabel}](${cleanedUrl})` : cleanLabel
    }
  )
}

function isNavOnlyLine(line: string): boolean {
  const bareText = line.replace(/[|>*_`#-]/g, '').trim().toLowerCase()
  return (
    bareText.length > 0 &&
    bareText.length < 40 &&
    NAV_ONLY_KEYWORDS.some((keyword) => bareText === keyword || bareText.startsWith(keyword))
  )
}

function isSeparatorLine(line: string): boolean {
  const withoutPipes = line.replace(/\\?\|/g, '').trim()
  return withoutPipes === '' || !/[a-z0-9]/i.test(withoutPipes)
}

export function cleanEmailMarkdown(content: string | null | undefined): string {
  return cleanEmailMarkdownWithDiagnostics(content).text
}

export function cleanEmailMarkdownWithDiagnostics(
  content: string | null | undefined
): { text: string; diagnostics: EmailCleanupDiagnostics } {
  if (!content) {
    return {
      text: '',
      diagnostics: {
        bytesIn: 0,
        bytesOut: 0,
        removedCharacters: 0,
        removedImages: 0,
        removedLinks: 0,
        removedLines: 0,
        wasLarge: false
      }
    }
  }

  const linesIn = content ? content.split('\n').length : 0
  const bytesIn = content.length
  const invisibleCharacters = content.match(INVISIBLE_EMAIL_CHARACTERS)?.length || 0
  let working = cleanEmailText(content)
  let removedImages = 0
  let removedLinks = 0
  let removedLines = 0

  working = stripBackslashEscapes(working)
  working = working.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_match, alt: string) => {
    const trimmedAlt = alt.trim()
    if (!trimmedAlt || DECORATIVE_ALT_TEXT.test(trimmedAlt)) {
      removedImages++
      return ''
    }
    return trimmedAlt
  })
  working = stripDecorativeTableJunk(working)
  working = working.replace(
    /\[([^\]]*)\]\(((?:https?:\/\/|mailto:)[^)\s]*)\)/g,
    (_match, label: string, url: string) => {
      const cleanLabel = label.replace(/[|*_\s-]+/g, ' ').trim()
      const cleanedUrl = cleanEmailUrl(url)
      if (!cleanLabel || !cleanedUrl || /linkedin\.com|licdn\.com/i.test(cleanedUrl)) {
        removedLinks++
        return cleanLabel
      }
      return `[${cleanLabel}](${cleanedUrl})`
    }
  )

  const lines = working
    .split('\n')
    .map((line) => trimLineEdgeClutter(line.replace(/\s{2,}/g, ' ').trim()))
    .filter((line) => {
      const keep = line.length > 0 && !isNavOnlyLine(line) && !isSeparatorLine(line)
      return keep
    })

  const text = lines
    .join('\n')
    .replace(/https?:\/\/[^\s)>]+/gi, (value) => {
      const trailing = value.match(/[.,;:!?]+$/)?.[0] || ''
      const base = trailing ? value.slice(0, -trailing.length) : value
      const cleaned = cleanEmailUrl(base) || base
      return `${cleaned}${trailing}`
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    text,
    diagnostics: {
      bytesIn,
      bytesOut: text.length,
      removedCharacters: Math.max(0, bytesIn - text.length),
      removedImages,
      removedLinks,
      removedLines: Math.max(0, linesIn - (text ? text.split('\n').length : 0)),
      wasLarge: bytesIn >= 1024 * 1024
    }
  }
}
