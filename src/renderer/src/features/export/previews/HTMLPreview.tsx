import React from 'react'
import { PreviewFrame, type PreviewProps } from './PreviewFrame'

export const HTMLPreview: React.FC<PreviewProps> = (props) => (
  <PreviewFrame {...props} label="HTML" />
)

export default HTMLPreview
