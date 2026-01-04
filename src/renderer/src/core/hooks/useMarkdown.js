// markdownFormatter.js - Complete Markdown formatting utility

class MarkdownFormatter {
  constructor() {
    this.rules = [
      // Headers
      { pattern: /^###### (.+)$/gm, replacement: '<h6>$1</h6>' },
      { pattern: /^##### (.+)$/gm, replacement: '<h5>$1</h5>' },
      { pattern: /^#### (.+)$/gm, replacement: '<h4>$1</h4>' },
      { pattern: /^### (.+)$/gm, replacement: '<h3>$1</h3>' },
      { pattern: /^## (.+)$/gm, replacement: '<h2>$1</h2>' },
      { pattern: /^# (.+)$/gm, replacement: '<h1>$1</h1>' },

      // Bold and Italic
      { pattern: /\*\*\*(.*?)\*\*\*/g, replacement: '<strong><em>$1</em></strong>' },
      { pattern: /\*\*(.*?)\*\*/g, replacement: '<strong>$1</strong>' },
      { pattern: /\*(.*?)\*/g, replacement: '<em>$1</em>' },
      { pattern: /__(.*?)__/g, replacement: '<strong>$1</strong>' },
      { pattern: /_(.*?)_/g, replacement: '<em>$1</em>' },

      // Code and Code Blocks
      { pattern: /```([\s\S]*?)```/g, replacement: '<pre><code>$1</code></pre>' },
      { pattern: /``(.+?)``/g, replacement: '<code>$1</code>' },
      { pattern: /`(.+?)`/g, replacement: '<code>$1</code>' },

      // Links
      { pattern: /\[([^\]]+)\]\(([^)]+)\)/g, replacement: '<a href="$2">$1</a>' },

      // Images
      { pattern: /!\[([^\]]+)\]\(([^)]+)\)/g, replacement: '<img src="$2" alt="$1">' },

      // Lists
      { pattern: /^- (.+)$/gm, replacement: '<li>$1</li>' },
      { pattern: /^\* (.+)$/gm, replacement: '<li>$1</li>' },
      { pattern: /^\+ (.+)$/gm, replacement: '<li>$1</li>' },
      { pattern: /^(\d+)\. (.+)$/gm, replacement: '<li>$2</li>' },

      // Blockquotes
      { pattern: /^> (.+)$/gm, replacement: '<blockquote>$1</blockquote>' },

      // Horizontal Rule
      { pattern: /^---$/gm, replacement: '<hr>' },
      { pattern: /^\*\*\*$/gm, replacement: '<hr>' },
      { pattern: /^___$/gm, replacement: '<hr>' },

      // Line breaks
      { pattern: /  $/gm, replacement: '<br>' },

      // Tables (basic support)
      { pattern: /\|(.+)\|/g, replacement: '<table><tr><td>$1</td></tr></table>' },

      // Strikethrough
      { pattern: /~~(.+?)~~/g, replacement: '<del>$1</del>' },

      // Escaping special characters
      { pattern: /\\\*/g, replacement: '*' },
      { pattern: /\\_/g, replacement: '_' },
      { pattern: /\\`/g, replacement: '`' },
      { pattern: /\\\[/g, replacement: '[' },
      { pattern: /\\\]/g, replacement: ']' },
      { pattern: /\\\(/g, replacement: '(' },
      { pattern: /\\\)/g, replacement: ')' }
    ]

    this.symbolsMap = {
      // Basic formatting
      '**': 'bold',
      '*': 'italic',
      _: 'italic',
      __: 'bold',
      '~~': 'strikethrough',
      '`': 'inline code',
      '```': 'code block',

      // Headers
      '#': 'header 1',
      '##': 'header 2',
      '###': 'header 3',
      '####': 'header 4',
      '#####': 'header 5',
      '######': 'header 6',

      // Structural
      '>': 'blockquote',
      '-': 'list item',
      '* ': 'list item',
      '+ ': 'list item',
      '1.': 'numbered list',
      '---': 'horizontal rule',
      '***': 'horizontal rule',
      ___: 'horizontal rule',

      // Links and images
      '[]()': 'link',
      '![]()': 'image',

      // Escaping
      '\\': 'escape character'
    }
  }

  // Convert markdown text to HTML
  toHTML(markdownText) {
    if (!markdownText) return ''

    let html = markdownText

    // Apply all formatting rules
    this.rules.forEach((rule) => {
      html = html.replace(rule.pattern, rule.replacement)
    })

    // Wrap lists in ul/ol tags
    html = this.formatLists(html)

    // Wrap consecutive blockquotes
    html = this.formatBlockquotes(html)

    return html
  }

  // Format lists properly
  formatLists(text) {
    // Handle unordered lists
    text = text.replace(/(<li>.*<\/li>)(?=\s*<li>)/gs, '$1')
    text = text.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>')

    // Handle ordered lists (basic implementation)
    text = text.replace(/(<li>.*<\/li>)(?=\s*<li>)/gs, '$1')

    return text
  }

  // Format blockquotes
  formatBlockquotes(text) {
    return text.replace(/(<blockquote>[\s\S]*?<\/blockquote>)+/g, (match) => {
      return `<blockquote>${match.replace(/<blockquote>|<\/blockquote>/g, '')}</blockquote>`
    })
  }

  // Convert HTML back to markdown (basic implementation)
  toMarkdown(html) {
    let markdown = html

    // Headers
    markdown = markdown.replace(/<h1>(.*?)<\/h1>/g, '# $1\n')
    markdown = markdown.replace(/<h2>(.*?)<\/h2>/g, '## $1\n')
    markdown = markdown.replace(/<h3>(.*?)<\/h3>/g, '### $1\n')
    markdown = markdown.replace(/<h4>(.*?)<\/h4>/g, '#### $1\n')
    markdown = markdown.replace(/<h5>(.*?)<\/h5>/g, '##### $1\n')
    markdown = markdown.replace(/<h6>(.*?)<\/h6>/g, '###### $1\n')

    // Bold and Italic
    markdown = markdown.replace(/<strong><em>(.*?)<\/em><\/strong>/g, '***$1***')
    markdown = markdown.replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    markdown = markdown.replace(/<em>(.*?)<\/em>/g, '*$1*')

    // Code
    markdown = markdown.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, '```\n$1\n```')
    markdown = markdown.replace(/<code>(.*?)<\/code>/g, '`$1`')

    // Links
    markdown = markdown.replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)')

    // Images
    markdown = markdown.replace(/<img src="(.*?)" alt="(.*?)">/g, '![$2]($1)')

    // Lists
    markdown = markdown.replace(/<ul>([\s\S]*?)<\/ul>/g, '$1')
    markdown = markdown.replace(/<li>(.*?)<\/li>/g, '- $1\n')

    // Blockquotes
    markdown = markdown.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, '> $1\n')

    // Horizontal Rule
    markdown = markdown.replace(/<hr>/g, '---\n')

    // Line breaks
    markdown = markdown.replace(/<br>/g, '  \n')

    // Strikethrough
    markdown = markdown.replace(/<del>(.*?)<\/del>/g, '~~$1~~')

    return markdown.trim()
  }

  // Get all supported markdown symbols
  getSupportedSymbols() {
    return this.symbolsMap
  }

  // Validate markdown syntax
  validateMarkdown(text) {
    const errors = []

    // Check for unclosed formatting
    const unclosedBold = (text.match(/\*\*/g) || []).length % 2 !== 0
    const unclosedItalic = (text.match(/\*/g) || []).length % 2 !== 0
    const unclosedCode = (text.match(/`/g) || []).length % 2 !== 0

    if (unclosedBold) errors.push('Unclosed bold formatting (**)')
    if (unclosedItalic) errors.push('Unclosed italic formatting (*)')
    if (unclosedCode) errors.push('Unclosed code formatting (`)')

    // Check for proper header syntax
    const invalidHeaders = text.match(/^#+[^#\s].*$/gm) || []
    invalidHeaders.forEach((header) => {
      if (!header.match(/^#+ .+$/)) {
        errors.push(`Invalid header syntax: "${header}"`)
      }
    })

    return {
      isValid: errors.length === 0,
      errors: errors
    }
  }

  // Sanitize markdown (remove potentially harmful content)
  sanitize(markdownText) {
    let sanitized = markdownText

    // Remove script tags
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

    // Remove potentially dangerous protocols from links
    sanitized = sanitized.replace(/\[.*?\]\(javascript:.*?\)/gi, '')
    sanitized = sanitized.replace(/\[.*?\]\(data:.*?\)/gi, '')

    return sanitized
  }

  // Preview markdown in real-time
  createPreviewer(targetElement, sourceElement) {
    if (!targetElement || !sourceElement) return

    const updatePreview = () => {
      const markdown = sourceElement.value
      const html = this.toHTML(markdown)
      targetElement.innerHTML = html
    }

    sourceElement.addEventListener('input', updatePreview)
    updatePreview() // Initial preview
  }

  // Export formatted markdown with syntax highlighting
  exportFormatted(markdownText, format = 'html') {
    switch (format) {
      case 'html':
        return this.toHTML(markdownText)
      case 'raw':
        return markdownText
      case 'pdf':
        // This would typically involve a PDF generation library
        console.log('PDF export would be implemented here')
        return this.toHTML(markdownText)
      default:
        return markdownText
    }
  }

  // Add custom formatting rule
  addCustomRule(pattern, replacement, name) {
    this.rules.push({ pattern, replacement })
    if (name) {
      this.symbolsMap[pattern.source] = name
    }
  }

  // Remove formatting rule
  removeRule(pattern) {
    this.rules = this.rules.filter((rule) => rule.pattern.source !== pattern)
    delete this.symbolsMap[pattern]
  }
}

// Utility functions
const MarkdownUtils = {
  // Escape special characters for regular expressions
  escapeRegExp: (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  },

  // Count markdown symbols in text
  countSymbols: (text) => {
    const symbols = {
      headers: (text.match(/#{1,6} /g) || []).length,
      bold: (text.match(/\*\*/g) || []).length / 2,
      italic: (text.match(/\*[^*]/g) || []).length,
      code: (text.match(/`/g) || []).length / 2,
      links: (text.match(/\[.*?\]\(.*?\)/g) || []).length,
      lists: (text.match(/^[-*+]\s/gm) || []).length
    }
    return symbols
  },

  // Extract all links from markdown
  extractLinks: (markdownText) => {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    const links = []
    let match

    while ((match = linkRegex.exec(markdownText)) !== null) {
      links.push({
        text: match[1],
        url: match[2],
        position: match.index
      })
    }

    return links
  },

  // Generate table of contents from headers
  generateTOC: (markdownText) => {
    const headerRegex = /^(#{1,6})\s+(.+)$/gm
    const toc = []
    let match

    while ((match = headerRegex.exec(markdownText)) !== null) {
      const level = match[1].length
      const title = match[2].trim()
      const slug = title.toLowerCase().replace(/[^\w]+/g, '-')

      toc.push({
        level: level,
        title: title,
        slug: slug,
        position: match.index
      })
    }

    return toc
  }
}

// Browser and Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MarkdownFormatter, MarkdownUtils }
} else {
  window.MarkdownFormatter = MarkdownFormatter
  window.MarkdownUtils = MarkdownUtils
}

// Example usage:
/*
const formatter = new MarkdownFormatter();

// Convert markdown to HTML
const markdown = "# Hello World\nThis is **bold** and *italic* text.";
const html = formatter.toHTML(markdown);
console.log(html);

// Validate markdown
const validation = formatter.validateMarkdown(markdown);
console.log(validation);

// Get all supported symbols
const symbols = formatter.getSupportedSymbols();
console.log(symbols);
*/
