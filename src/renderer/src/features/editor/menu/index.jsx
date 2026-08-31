/**
 * index.jsx (Editor Menu Configuration)
 * Maps the context menu UI options to the corresponding editor actions.
 */
import React from 'react'
import {
  Link, ExternalLink, Search, FileText, Bold, Italic, Strikethrough,
  Highlighter, Code, Sigma, MessageSquare, Eraser,
  List, ListOrdered, CheckSquare, Heading1, Heading2, Heading3,
  Heading4, Heading5, Heading6, AlignLeft, Quote,
  Footprints, Table2, Info, Minus, SquareCode, Diff,
  Database, Scissors, Copy, ClipboardPaste, ClipboardType, MousePointerSquareDashed
} from 'lucide-react'
import { toggleMark, clearFormatting } from './formatActions'
import { togglePrefix } from './paragraphActions'
import { insertSnippet } from './insertActions'
import { selectAll, cutText, copyText, pastePlainText } from './clipboardActions'

export const getEditorContextMenuOptions = (view) => {
  const selectedText = view ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to) : ''
  const hasSelection = selectedText.length > 0

  return [
    {
      id: 'add-link',
      label: 'Add link',
      icon: <Link size={14} />,
      action: () => toggleMark(view, '[[', ']]')
    },
    {
      id: 'add-external-link',
      label: 'Add external link',
      icon: <ExternalLink size={14} />,
      action: () => toggleMark(view, '[', ']()')
    },
    { divider: true },
    {
      id: 'search',
      label: hasSelection ? `Search for "${selectedText.slice(0, 20)}${selectedText.length > 20 ? '...' : ''}"` : 'Search...',
      icon: <Search size={14} />,
      disabled: !hasSelection,
      action: () => { /* implement search */ }
    },
    {
      id: 'extract',
      label: 'Extract current selection...',
      icon: <FileText size={14} />,
      disabled: !hasSelection,
      action: () => { /* implement extract */ }
    },
    { divider: true },
    {
      id: 'format',
      label: 'Format',
      icon: <Bold size={14} />,
      children: [
        { id: 'bold', label: 'Bold', icon: <Bold size={14} />, shortcut: '⌘B', action: () => toggleMark(view, '**') },
        { id: 'italic', label: 'Italic', icon: <Italic size={14} />, shortcut: '⌘I', action: () => toggleMark(view, '*') },
        { id: 'strikethrough', label: 'Strikethrough', icon: <Strikethrough size={14} />, action: () => toggleMark(view, '~~') },
        { id: 'highlight', label: 'Highlight', icon: <Highlighter size={14} />, action: () => toggleMark(view, '==') },
        { id: 'code', label: 'Code', icon: <Code size={14} />, action: () => toggleMark(view, '`') },
        { id: 'math', label: 'Math', icon: <Sigma size={14} />, action: () => toggleMark(view, '$') },
        { id: 'comment', label: 'Comment', icon: <MessageSquare size={14} />, action: () => toggleMark(view, '%%') },
        { divider: true },
        { id: 'clear', label: 'Clear formatting', icon: <Eraser size={14} />, action: () => clearFormatting(view) }
      ]
    },
    {
      id: 'paragraph',
      label: 'Paragraph',
      icon: <AlignLeft size={14} />,
      children: [
        { id: 'bullet', label: 'Bullet list', icon: <List size={14} />, action: () => togglePrefix(view, '- ') },
        { id: 'numbered', label: 'Numbered list', icon: <ListOrdered size={14} />, action: () => togglePrefix(view, '1. ') },
        { id: 'task', label: 'Task list', icon: <CheckSquare size={14} />, action: () => togglePrefix(view, '- [ ] ') },
        { divider: true },
        { id: 'h1', label: 'Heading 1', icon: <Heading1 size={14} />, action: () => togglePrefix(view, '# ') },
        { id: 'h2', label: 'Heading 2', icon: <Heading2 size={14} />, action: () => togglePrefix(view, '## ') },
        { id: 'h3', label: 'Heading 3', icon: <Heading3 size={14} />, action: () => togglePrefix(view, '### ') },
        { id: 'h4', label: 'Heading 4', icon: <Heading4 size={14} />, action: () => togglePrefix(view, '#### ') },
        { id: 'h5', label: 'Heading 5', icon: <Heading5 size={14} />, action: () => togglePrefix(view, '##### ') },
        { id: 'h6', label: 'Heading 6', icon: <Heading6 size={14} />, action: () => togglePrefix(view, '###### ') },
        { id: 'body', label: 'Body', icon: <AlignLeft size={14} />, action: () => togglePrefix(view, '') },
        { id: 'quote', label: 'Quote', icon: <Quote size={14} />, action: () => togglePrefix(view, '> ') },
      ]
    },
    {
      id: 'insert',
      label: 'Insert',
      icon: <Table2 size={14} />,
      children: [
        { id: 'footnote', label: 'Footnote', icon: <Footprints size={14} />, action: () => insertSnippet(view, '[^1]\n\n[^1]: Footnote here') },
        { id: 'table', label: 'Table', icon: <Table2 size={14} />, action: () => insertSnippet(view, '\n| Col 1 | Col 2 |\n|-------|-------|\n| Val 1 | Val 2 |\n') },
        { id: 'callout', label: 'Callout', icon: <Info size={14} />, action: () => insertSnippet(view, '\n> [!info] Title\n> Content\n') },
        { id: 'hr', label: 'Horizontal rule', icon: <Minus size={14} />, action: () => insertSnippet(view, '\n---\n') },
        { divider: true },
        { id: 'codeblock', label: 'Code block', icon: <SquareCode size={14} />, action: () => toggleMark(view, '```\n', '\n```') },
        { id: 'mathblock', label: 'Math block', icon: <Diff size={14} />, action: () => toggleMark(view, '$$\n', '\n$$') },
      ]
    },
    { divider: true },
    { id: 'cut', label: 'Cut', icon: <Scissors size={14} />, shortcut: '⌘X', action: () => cutText() },
    { id: 'copy', label: 'Copy', icon: <Copy size={14} />, shortcut: '⌘C', action: () => copyText() },
    { id: 'paste', label: 'Paste', icon: <ClipboardPaste size={14} />, shortcut: '⌘V', action: () => pastePlainText(view) },
    { id: 'paste-plain', label: 'Paste as plain text', icon: <ClipboardType size={14} />, shortcut: '⇧⌘V', action: () => pastePlainText(view) },
    { divider: true },
    { id: 'select-all', label: 'Select all', icon: <MousePointerSquareDashed size={14} />, shortcut: '⌘A', action: () => selectAll(view) }
  ]
}
