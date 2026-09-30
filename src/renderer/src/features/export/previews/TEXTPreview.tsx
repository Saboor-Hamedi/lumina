import React from 'react'
import { PreviewFrame, type PreviewProps } from './PreviewFrame'

/** Plain-text preview. */
export const TEXTPreview: React.FC<PreviewProps> = (props) => (
  <PreviewFrame {...props} label="Text" />
)

export default TEXTPreview
