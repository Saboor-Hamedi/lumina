/**
 * index.tsx (Editor Menu Configuration)
 * Maps the context menu UI options to the corresponding editor actions.
 */
import React from 'react'
import type { EditorView } from '@codemirror/view'
import {
  Bold, Italic, Strikethrough,
  Highlighter, Code, Sigma, MessageSquare, Eraser,
  List, ListOrdered, CheckSquare, Heading1, Heading2, Heading3,
  Heading4, Heading5, Heading6, AlignLeft, Quote,
  Footprints, Table2, Info, Minus, SquareCode, Diff,
  Scissors, Copy, ClipboardPaste, ClipboardType, MousePointerSquareDashed,
  Sparkles
} from 'lucide-react'
import { toggleMark, clearFormatting } from './formatActions'
import { togglePrefix } from './paragraphActions'
import { toggleQuoteMark } from '../../../core/editor'
import { insertSnippet } from './insertActions'
import { selectAll, cutText, copyText, pastePlainText, pasteRichText } from './clipboardActions'

export interface EditorContextMenuDivider {
  divider: true
}

export interface EditorContextMenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  shortcut?: string
  className?: string
  disabled?: boolean
  action?: () => void
  children?: EditorContextMenuOption[]
}

export type EditorContextMenuOption = EditorContextMenuItem | EditorContextMenuDivider

export const getEditorContextMenuOptions = (
  view: EditorView | null | undefined
): EditorContextMenuOption[] => {
  const selectedText = view
    ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)
    : ''
  const hasSelection = selectedText.length > 0
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac')
  const mod = isMac ? '⌘' : 'Ctrl+'
  const shiftMod = isMac ? '⇧⌘' : 'Ctrl+Shift+'

  return [
    // 1. Lumina AI Assistant
    {
      id: 'ai-prompt',
      className: 'menu-item-ai',
      label: hasSelection ? 'Ask Lumina about selection...' : 'Ask Lumina AI...',
      icon: <Sparkles size={14} className="menu-ai-icon" />,
      shortcut: `${mod}K`,
      action: () => {
        window.dispatchEvent(new CustomEvent('open-inline-ai', { detail: { initialQuery: selectedText } }))
      }
    },
    { divider: true },

    // 2. Clipboard Operations
    {
      id: 'cut',
      label: 'Cut',
      icon: <Scissors size={14} />,
      shortcut: `${mod}X`,
      disabled: !hasSelection,
      action: () => {
        cutText()
      }
    },
    {
      id: 'copy',
      label: 'Copy',
      icon: <Copy size={14} />,
      shortcut: `${mod}C`,
      disabled: !hasSelection,
      action: () => {
        copyText()
      }
    },
    {
      id: 'paste',
      label: 'Paste',
      icon: <ClipboardPaste size={14} />,
      shortcut: `${mod}V`,
      action: () => {
        void pasteRichText(view)
      }
    },
    {
      id: 'paste-plain',
      label: 'Paste as plain text',
      icon: <ClipboardType size={14} />,
      shortcut: `${shiftMod}V`,
      action: () => {
        void pastePlainText(view)
      }
    },
    { divider: true },

    // 3. Formatting Submenu
    {
      id: 'format',
      label: 'Format',
      icon: <Bold size={14} />,
      children: [
        { id: 'bold', label: 'Bold', icon: <Bold size={14} />, shortcut: `${mod}B`, action: () => toggleMark(view, '**') },
        { id: 'italic', label: 'Italic', icon: <Italic size={14} />, shortcut: `${mod}I`, action: () => toggleMark(view, '*') },
        { id: 'strikethrough', label: 'Strikethrough', icon: <Strikethrough size={14} />, action: () => toggleMark(view, '~~') },
        { id: 'highlight', label: 'Highlight', icon: <Highlighter size={14} />, action: () => toggleMark(view, '==') },
        { id: 'code', label: 'Inline code', icon: <Code size={14} />, action: () => toggleMark(view, '`') },
        { id: 'math', label: 'Inline math', icon: <Sigma size={14} />, action: () => toggleMark(view, '$') },
        { id: 'comment', label: 'Comment', icon: <MessageSquare size={14} />, action: () => toggleMark(view, '%%') },
        { divider: true },
        { id: 'clear', label: 'Clear formatting', icon: <Eraser size={14} />, action: () => clearFormatting(view) }
      ]
    },

    // 4. Paragraph & Headings Submenu
    {
      id: 'paragraph',
      label: 'Paragraph',
      icon: <AlignLeft size={14} />,
      children: [
        { id: 'h1', label: 'Heading 1', icon: <Heading1 size={14} />, action: () => togglePrefix(view, '# ') },
        { id: 'h2', label: 'Heading 2', icon: <Heading2 size={14} />, action: () => togglePrefix(view, '## ') },
        { id: 'h3', label: 'Heading 3', icon: <Heading3 size={14} />, action: () => togglePrefix(view, '### ') },
        { id: 'h4', label: 'Heading 4', icon: <Heading4 size={14} />, action: () => togglePrefix(view, '#### ') },
        { id: 'h5', label: 'Heading 5', icon: <Heading5 size={14} />, action: () => togglePrefix(view, '##### ') },
        { id: 'h6', label: 'Heading 6', icon: <Heading6 size={14} />, action: () => togglePrefix(view, '###### ') },
        { divider: true },
        { id: 'bullet', label: 'Bullet list', icon: <List size={14} />, action: () => togglePrefix(view, '- ') },
        { id: 'numbered', label: 'Numbered list', icon: <ListOrdered size={14} />, action: () => togglePrefix(view, '1. ') },
        { id: 'task', label: 'Task list', icon: <CheckSquare size={14} />, action: () => togglePrefix(view, '- [ ] ') },
        {
          id: 'quote',
          label: 'Quote block',
          icon: <Quote size={14} />,
          action: () => {
            if (view) toggleQuoteMark(view)
          }
        },
        { id: 'body', label: 'Normal text', icon: <AlignLeft size={14} />, action: () => togglePrefix(view, '') }
      ]
    },

    // 5. Insert Submenu
    {
      id: 'insert',
      label: 'Insert',
      icon: <Table2 size={14} />,
      children: [
        { id: 'table', label: 'Table', icon: <Table2 size={14} />, action: () => insertSnippet(view, '\n| Column 1 | Column 2 |\n|----------|----------|\n| Item 1   | Item 2   |\n') },
        { id: 'callout', label: 'Callout block', icon: <Info size={14} />, action: () => insertSnippet(view, '\n> [!info] Note\n> Content goes here\n') },
        { id: 'codeblock', label: 'Code fence block', icon: <SquareCode size={14} />, action: () => toggleMark(view, '```\n', '\n```') },
        { id: 'mathblock', label: 'Display math block', icon: <Diff size={14} />, action: () => toggleMark(view, '$$\n', '\n$$') },
        { divider: true },
        { id: 'hr', label: 'Horizontal divider', icon: <Minus size={14} />, action: () => insertSnippet(view, '\n---\n') },
        { id: 'footnote', label: 'Footnote reference', icon: <Footprints size={14} />, action: () => insertSnippet(view, '[^1]\n\n[^1]: Footnote description') }
      ]
    },
    { divider: true },

    // 6. Select All
    {
      id: 'select-all',
      label: 'Select all',
      icon: <MousePointerSquareDashed size={14} />,
      shortcut: `${mod}A`,
      action: () => selectAll(view)
    }
  ]
}
