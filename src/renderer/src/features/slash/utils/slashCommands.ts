/**
 * @file slashCommands.ts
 * @description Declarative registry and execution handlers for all Editor Slash Commands in Lumina.
 * Designed with strict DRY principles, full TypeScript types, categorized icons, keywords, and safe ranges.
 * @module features/slash/utils/slashCommands
 */

import type { EditorView } from '@codemirror/view'

/**
 * Categorization constants for slash commands.
 */
export const SLASH_CATEGORIES = {
  BASIC: 'Basic Blocks',
  RICH: 'Media & Components',
  AI_TOOLS: 'AI & Automation'
} as const

export type SlashCategory = (typeof SLASH_CATEGORIES)[keyof typeof SLASH_CATEGORIES]

/**
 * Definition interface for an executable slash command.
 */
export interface SlashCommand {
  /** Unique command identifier */
  id: string
  /** Human-readable display label */
  label: string
  /** Searchable keywords and aliases */
  keywords: string[]
  /** Brief description explaining the command's effect */
  desc: string
  /** Lucide icon identifier mapped in EditorSlash */
  icon: string
  /** Group category for section headers */
  category: SlashCategory
  /** Execution callback modifying the CodeMirror editor state */
  execute: (view: EditorView, from: number, to: number) => void
}

/**
 * Clamps replacement bounds within the safe length of the document.
 *
 * @param view - Target CodeMirror EditorView instance
 * @param from - Desired starting index for replacement
 * @param to - Desired ending index for replacement
 * @returns Safe `{ from, to }` character offsets
 */
export function safeRange(view: EditorView, from: number, to: number): { from: number; to: number } {
  const len = view?.state?.doc?.length ?? 0
  const safeFrom = Math.max(0, Math.min(typeof from === 'number' ? from : len, len))
  const safeTo = Math.max(safeFrom, Math.min(typeof to === 'number' ? to : safeFrom, len))
  return { from: safeFrom, to: safeTo }
}

/**
 * Master catalog of all available slash commands in Lumina Editor.
 */
export const EDITOR_SLASH_COMMANDS: SlashCommand[] = [
  // --- BASIC BLOCKS ---
  {
    id: 'h1',
    label: 'Heading 1',
    keywords: ['h1', 'heading', 'title', 'large'],
    desc: 'Large section heading',
    icon: 'Heading1',
    category: SLASH_CATEGORIES.BASIC,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: '# ' },
        selection: { anchor: range.from + 2 }
      })
      view.focus()
    }
  },
  {
    id: 'h2',
    label: 'Heading 2',
    keywords: ['h2', 'heading', 'subtitle', 'medium'],
    desc: 'Medium section heading',
    icon: 'Heading2',
    category: SLASH_CATEGORIES.BASIC,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: '## ' },
        selection: { anchor: range.from + 3 }
      })
      view.focus()
    }
  },
  {
    id: 'h3',
    label: 'Heading 3',
    keywords: ['h3', 'heading', 'small'],
    desc: 'Small subsection heading',
    icon: 'Heading3',
    category: SLASH_CATEGORIES.BASIC,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: '### ' },
        selection: { anchor: range.from + 4 }
      })
      view.focus()
    }
  },
  {
    id: 'bullet',
    label: 'Bullet List',
    keywords: ['bullet', 'list', 'unordered', 'point', '-'],
    desc: 'Simple bulleted list',
    icon: 'List',
    category: SLASH_CATEGORIES.BASIC,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: '- ' },
        selection: { anchor: range.from + 2 }
      })
      view.focus()
    }
  },
  {
    id: 'number',
    label: 'Numbered List',
    keywords: ['number', 'numbered', 'ordered', 'list', '1.'],
    desc: 'Sequential numbered list',
    icon: 'ListOrdered',
    category: SLASH_CATEGORIES.BASIC,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: '1. ' },
        selection: { anchor: range.from + 3 }
      })
      view.focus()
    }
  },
  {
    id: 'task',
    label: 'To-do / Task',
    keywords: ['todo', 'task', 'checkbox', 'check', '[]'],
    desc: 'Track tasks with checkboxes',
    icon: 'CheckSquare',
    category: SLASH_CATEGORIES.BASIC,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: '- [ ] ' },
        selection: { anchor: range.from + 6 }
      })
      view.focus()
    }
  },
  {
    id: 'quote',
    label: 'Quote',
    keywords: ['quote', 'blockquote', 'cite', '>'],
    desc: 'Capture a quote or highlight',
    icon: 'Quote',
    category: SLASH_CATEGORIES.BASIC,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: '> ' },
        selection: { anchor: range.from + 2 }
      })
      view.focus()
    }
  },
  {
    id: 'code',
    label: 'Code Block',
    keywords: ['code', 'snippet', 'syntax', 'programming', '```'],
    desc: 'Fenced code with syntax highlighting',
    icon: 'Code',
    category: SLASH_CATEGORIES.BASIC,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      const template = '```javascript\n\n```'
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: template },
        selection: { anchor: range.from + 14 }
      })
      view.focus()
    }
  },
  {
    id: 'divider',
    label: 'Divider',
    keywords: ['divider', 'line', 'hr', 'horizontal', 'separator', '---'],
    desc: 'Visually divide sections',
    icon: 'Minus',
    category: SLASH_CATEGORIES.BASIC,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: '\n---\n\n' },
        selection: { anchor: range.from + 6 }
      })
      view.focus()
    }
  },

  // --- MEDIA & RICH COMPONENTS ---
  {
    id: 'table',
    label: 'Table',
    keywords: ['table', 'grid', 'column', 'row', 'spreadsheet'],
    desc: 'Interactive table with horizontal scroll',
    icon: 'Table',
    category: SLASH_CATEGORIES.RICH,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      const tableTemplate =
        '| Column 1 | Column 2 | Column 3 |\n| :--- | :--- | :--- |\n| Item 1 | Details | Value |\n| Item 2 | Details | Value |\n'
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: tableTemplate },
        selection: { anchor: range.from + tableTemplate.length }
      })
      view.focus()
    }
  },
  {
    id: 'mermaid',
    label: 'Mermaid Diagram',
    keywords: ['mermaid', 'diagram', 'chart', 'flowchart', 'mindmap', 'graph'],
    desc: 'Render flowcharts & architecture diagrams',
    icon: 'GitFork',
    category: SLASH_CATEGORIES.RICH,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      const diagram = '```mermaid\ngraph TD;\n    A[Start] --> B[Process];\n    B --> C[Result];\n```\n'
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: diagram },
        selection: { anchor: range.from + diagram.length }
      })
      view.focus()
    }
  },
  {
    id: 'callout-info',
    label: 'Info Callout',
    keywords: ['callout', 'info', 'note', 'box', 'alert'],
    desc: 'Helpful information or notice',
    icon: 'Info',
    category: SLASH_CATEGORIES.RICH,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      const callout = '> [!NOTE]\n> '
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: callout },
        selection: { anchor: range.from + callout.length }
      })
      view.focus()
    }
  },
  {
    id: 'callout-warning',
    label: 'Warning Callout',
    keywords: ['warning', 'alert', 'caution', 'danger'],
    desc: 'Highlight critical information',
    icon: 'AlertTriangle',
    category: SLASH_CATEGORIES.RICH,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      const callout = '> [!WARNING]\n> '
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: callout },
        selection: { anchor: range.from + callout.length }
      })
      view.focus()
    }
  },
  {
    id: 'callout-tip',
    label: 'Tip Callout',
    keywords: ['tip', 'idea', 'success', 'hint'],
    desc: 'Helpful tips and suggestions',
    icon: 'Lightbulb',
    category: SLASH_CATEGORIES.RICH,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      const callout = '> [!TIP]\n> '
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: callout },
        selection: { anchor: range.from + callout.length }
      })
      view.focus()
    }
  },

  // --- AI & AUTOMATION ---
  {
    id: 'ai-inline',
    label: 'Ask Lumina AI',
    keywords: ['ai', 'ask', 'generate', 'write', 'summarize', 'spark'],
    desc: 'Generate or expand text with AI',
    icon: 'Sparkles',
    category: SLASH_CATEGORIES.AI_TOOLS,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      view.dispatch({ changes: { from: range.from, to: range.to, insert: '' } })
      view.focus()
      window.dispatchEvent(
        new CustomEvent('open-inline-lumina', {
          detail: { mode: 'generate' }
        })
      )
    }
  },
  {
    id: 'date',
    label: "Today's Date",
    keywords: ['date', 'today', 'now', 'day', 'calendar'],
    desc: 'Insert current YYYY-MM-DD',
    icon: 'Calendar',
    category: SLASH_CATEGORIES.AI_TOOLS,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      const d = new Date().toISOString().slice(0, 10)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: d },
        selection: { anchor: range.from + d.length }
      })
      view.focus()
    }
  },
  {
    id: 'time',
    label: 'Current Time',
    keywords: ['time', 'now', 'clock', 'timestamp'],
    desc: 'Insert current HH:MM',
    icon: 'Clock',
    category: SLASH_CATEGORIES.AI_TOOLS,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: t },
        selection: { anchor: range.from + t.length }
      })
      view.focus()
    }
  },
  {
    id: 'wikilink',
    label: 'Wikilink',
    keywords: ['link', 'wikilink', 'page', 'note', 'reference', '[['],
    desc: 'Link to another note',
    icon: 'Link',
    category: SLASH_CATEGORIES.AI_TOOLS,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: '[[]]' },
        selection: { anchor: range.from + 2 }
      })
      view.focus()
    }
  },
  {
    id: 'google',
    label: 'Google Login',
    keywords: ['google', 'login', 'auth', 'signin', 'account'],
    desc: 'Log in with Google Account or open auth',
    icon: 'Globe',
    category: SLASH_CATEGORIES.AI_TOOLS,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: '' },
        selection: { anchor: range.from }
      })
      if ((window as any).api?.loginWithGoogle) {
        ;(window as any).api.loginWithGoogle('736587690312-33s4trbiculu5dvctb92lkl6njgc14ae.apps.googleusercontent.com')
      } else {
        window.dispatchEvent(new CustomEvent('open-google-login'))
      }
    }
  },
  {
    id: 'email',
    label: 'Lumina Mail',
    keywords: ['email', 'mail', 'gmail', 'inbox', 'compose'],
    desc: 'Open Lumina Mail modal',
    icon: 'Mail',
    category: SLASH_CATEGORIES.AI_TOOLS,
    execute: (view, from, to) => {
      const range = safeRange(view, from, to)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: '' },
        selection: { anchor: range.from }
      })
      window.dispatchEvent(new CustomEvent('open-email'))
    }
  }
]

/**
 * Filters commands against user query based on labels, descriptions, and keywords.
 *
 * @param query - Raw query text typed immediately following the '/' prefix
 * @returns Filtered array of matching SlashCommand objects
 */
export function filterSlashCommands(query: string): SlashCommand[] {
  const q = (query || '').toLowerCase().trim()
  if (!q) return EDITOR_SLASH_COMMANDS

  return EDITOR_SLASH_COMMANDS.filter((cmd) => {
    const matchLabel = cmd.label.toLowerCase().includes(q)
    const matchDesc = cmd.desc.toLowerCase().includes(q)
    const matchKeywords = cmd.keywords?.some((k) => k.toLowerCase().includes(q))
    return matchLabel || matchDesc || matchKeywords
  })
}
