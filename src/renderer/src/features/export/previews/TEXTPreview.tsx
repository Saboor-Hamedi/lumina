import React from 'react'
import { PreviewFrame, type PreviewProps } from './PreviewFrame'

export const TEXTPreview: React.FC<PreviewProps> = (props) => (
  <PreviewFrame {...props} label="Text" />
)

export default TEXTPreview
