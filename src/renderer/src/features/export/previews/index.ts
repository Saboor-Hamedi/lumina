import type { ComponentType } from 'react'
import type { ExportFormat } from '../formats'
import type { PreviewProps } from './PreviewFrame'
import { PDFPreview } from './PDFPreview'
import { DOCSPreview } from './DOCSPreview'
import { HTMLPreview } from './HTMLPreview'
import { MarkdownPreview } from './MarkdownPreview'
import { TEXTPreview } from './TEXTPreview'

/** Maps each export format to the preview component that renders it. */
export const PREVIEW_COMPONENTS: Record<ExportFormat, ComponentType<PreviewProps>> = {
  pdf: PDFPreview,
  docs: DOCSPreview,
  html: HTMLPreview,
  markdown: MarkdownPreview,
  text: TEXTPreview
}

export { PreviewFrame } from './PreviewFrame'
export type { PreviewProps } from './PreviewFrame'
export { PDFPreview, DOCSPreview, HTMLPreview, MarkdownPreview, TEXTPreview }
