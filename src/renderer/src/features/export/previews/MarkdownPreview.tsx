import React from 'react'
import { PreviewFrame, type PreviewProps } from './PreviewFrame'

export const MarkdownPreview: React.FC<PreviewProps> = (props) => (
  <PreviewFrame {...props} label="Markdown" />
)

export default MarkdownPreview
