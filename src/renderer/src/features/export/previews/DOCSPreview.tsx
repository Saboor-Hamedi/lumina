import React from 'react'
import { PreviewFrame, type PreviewProps } from './PreviewFrame'

export const DOCSPreview: React.FC<PreviewProps> = (props) => (
  <PreviewFrame {...props} label="Word Document" />
)

export default DOCSPreview
