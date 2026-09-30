import type { ReactNode } from 'react'
import { Printer, FileText, FileCode, FileJson, FileType } from 'lucide-react'

/** Supported single-note export formats. */
export type ExportFormat = 'pdf' | 'html' | 'docs' | 'markdown' | 'text'

/** Placeholder tokens replaced in format descriptions. */
export interface FormatSpec {
  id: ExportFormat
  /** Short chip label, e.g. "PDF". */
  label: string
  /** Rich card title, e.g. "PDF Document". */
  title: string
  /** One-line explanation. */
  description: string
  icon: ReactNode
  /** window.api method used to perform the export. */
  apiKey: string
  /** Primary button label for this format. */
  acceptLabel: string
  /** Accent colour used for the icon + selected border. */
  accent: string
  /** Primary file extension including dot, e.g. ".pdf". */
  ext: string
}

/**
 * Single source of truth for export formats. Order here is the order shown in
 * the UI. PDF first because it is the most common choice.
 */
export const EXPORT_FORMATS: FormatSpec[] = [
  {
    id: 'pdf',
    label: 'PDF',
    title: 'PDF Document',
    description: 'Print-ready A4 with table of contents and diagrams.',
    icon: <Printer size={20} strokeWidth={1.75} />,
    apiKey: 'exportPDF',
    acceptLabel: 'Export PDF',
    accent: '#ef4444',
    ext: '.pdf'
  },
  {
    id: 'docs',
    label: 'Word',
    title: 'Word (.doc)',
    description: 'Editable document with embedded diagrams.',
    icon: <FileText size={20} strokeWidth={1.75} />,
    apiKey: 'exportDocs',
    acceptLabel: 'Export Word',
    accent: '#2563eb',
    ext: '.doc'
  },
  {
    id: 'html',
    label: 'HTML',
    title: 'HTML Page',
    description: 'Self-contained web page with styling.',
    icon: <FileCode size={20} strokeWidth={1.75} />,
    apiKey: 'exportHTML',
    acceptLabel: 'Export HTML',
    accent: '#f59e0b',
    ext: '.html'
  },
  {
    id: 'markdown',
    label: 'Markdown',
    title: 'Markdown',
    description: 'Plain source, ideal for other editors.',
    icon: <FileJson size={20} strokeWidth={1.75} />,
    apiKey: 'exportMarkdown',
    acceptLabel: 'Export Markdown',
    accent: '#22c55e',
    ext: '.md'
  },
  {
    id: 'text',
    label: 'Text',
    title: 'Plain Text',
    description: 'Formatting stripped down to plain text.',
    icon: <FileType size={20} strokeWidth={1.75} />,
    apiKey: 'exportText',
    acceptLabel: 'Export Text',
    accent: '#94a3b8',
    ext: '.txt'
  }
]

/** Looks up a format spec by id, defaulting to PDF. */
export function getFormat(id: ExportFormat): FormatSpec {
  return EXPORT_FORMATS.find((f) => f.id === id) || EXPORT_FORMATS[0]
}
