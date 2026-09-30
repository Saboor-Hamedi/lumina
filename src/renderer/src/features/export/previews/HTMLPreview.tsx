import React from 'react'
import { PreviewFrame, type PreviewProps } from './PreviewFrame'

/** Self-contained HTML page preview. */
export const HTMLPreview: React.FC<PreviewProps> = (props) => (
  <PreviewFrame {...props} label="HTML" />
)

export default HTMLPreview
