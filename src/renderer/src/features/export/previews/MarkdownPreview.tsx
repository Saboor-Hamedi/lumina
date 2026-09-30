import React from 'react'
import { PreviewFrame, type PreviewProps } from './PreviewFrame'

/** Raw Markdown source preview. */
export const MarkdownPreview: React.FC<PreviewProps> = (props) => (
  <PreviewFrame {...props} label="Markdown" />
)

export default MarkdownPreview
