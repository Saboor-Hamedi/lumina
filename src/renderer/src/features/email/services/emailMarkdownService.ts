/**
 * Email Markdown & Formatting Service
 * Handles rendering markdown and rich formatting for email display and outgoing drafts.
 */

import { MarkdownFormatter } from '../../../core/hooks/useMarkdown'
import { cleanEmailMarkdown, cleanEmailText, sanitizeRichEmailHtml } from './emailContentCleaner'

const formatter = new MarkdownFormatter()

export { cleanEmailMarkdown, cleanEmailText, sanitizeRichEmailHtml }

/**
 * Auto-links bare URLs in text that are not already enclosed in an <a> tag.
 */
export function autolinkUrls(content: string): string {
  if (!content) return ''

  // Regex to match URLs while avoiding URLs inside href="..." or src="..."
  const urlRegex = /(?<!href=["']|src=["'])(https?:\/\/[^\s<>"'\)]+)/gi
  return content.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  })
}

/**
 * Checks if a string contains significant HTML structure.
 */
export function isRichHtml(content: string): boolean {
  if (!content) return false
  // Check for common HTML container tags beyond just <br>
  return /<\/?(div|p|table|tbody|tr|td|th|ul|ol|li|h[1-6]|blockquote|pre|img|article|section)\b/i.test(content)
}

/**
 * Renders email content for viewing in the EmailDetailPane reader.
 * Converts markdown and autolinks plain text emails, while preserving rich HTML emails.
 */
export function renderEmailBody(content: string | undefined | null): string {
  if (!content) return '<p style="color: var(--text-faint); font-style: italic;">(No message content)</p>'

  // If the email already has full HTML formatting from the sender
  if (isRichHtml(content)) {
    return autolinkUrls(sanitizeRichEmailHtml(content))
  }

  // Plain text email: First normalize <br/> back to newlines if created by Gmail fetcher
  let plainText = cleanEmailMarkdown(content.replace(/<br\s*\/?>/gi, '\n'))

  // Convert markdown to clean HTML
  let html = formatter.toHTML(plainText)

  // Autolink bare URLs
  html = autolinkUrls(html)

  // If there are still simple newlines left outside HTML blocks, convert to <br/>
  html = html.replace(/\n/g, '<br/>')

  return html
}

/**
 * Converts a composer markdown draft into styled HTML for outgoing email delivery.
 */
export function compileDraftToHtml(markdownText: string, quotedHistory?: string): string {
  if (!markdownText && !quotedHistory) return ''

  let htmlBody = ''
  if (markdownText) {
    // Convert composer markdown to HTML
    htmlBody = formatter.toHTML(markdownText)
    htmlBody = autolinkUrls(htmlBody)
    htmlBody = htmlBody.replace(/\n/g, '<br/>')
  }

  if (quotedHistory) {
    const formattedQuote = quotedHistory.replace(/\n/g, '<br/>')
    htmlBody = `${htmlBody}<br/><br/><div style="border-left: 2px solid #cbd5e1; padding-left: 12px; color: #64748b; font-size: 12px; margin-top: 16px;">${formattedQuote}</div>`
  }

  return htmlBody
}

/**
 * Inserts markdown syntax around the current selection in a textarea.
 */
export function insertMarkdownSyntax(
  textarea: HTMLTextAreaElement | null,
  syntaxType: 'bold' | 'italic' | 'code' | 'quote' | 'list' | 'link' | 'heading',
  updateValue: (newVal: string) => void
): void {
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const selectedText = value.substring(start, end)

  let prefix = ''
  let suffix = ''
  let fallbackText = ''

  switch (syntaxType) {
    case 'bold':
      prefix = '**'
      suffix = '**'
      fallbackText = 'bold text'
      break
    case 'italic':
      prefix = '*'
      suffix = '*'
      fallbackText = 'italic text'
      break
    case 'code':
      if (selectedText.includes('\n')) {
        prefix = '```\n'
        suffix = '\n```'
        fallbackText = 'code block'
      } else {
        prefix = '`'
        suffix = '`'
        fallbackText = 'code'
      }
      break
    case 'quote':
      prefix = '> '
      fallbackText = 'quote'
      break
    case 'list':
      prefix = '- '
      fallbackText = 'list item'
      break
    case 'heading':
      prefix = '### '
      fallbackText = 'Heading'
      break
    case 'link':
      prefix = '['
      suffix = '](https://example.com)'
      fallbackText = 'link title'
      break
  }

  const replacement = prefix + (selectedText || fallbackText) + suffix
  const newValue = value.substring(0, start) + replacement + value.substring(end)
  updateValue(newValue)

  setTimeout(() => {
    textarea.focus()
    const cursorStart = start + prefix.length
    const cursorEnd = cursorStart + (selectedText ? selectedText.length : fallbackText.length)
    textarea.setSelectionRange(cursorStart, cursorEnd)
  }, 0)
}
