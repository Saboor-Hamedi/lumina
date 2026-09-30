import React from 'react'
import { PreviewFrame, type PreviewProps } from './PreviewFrame'

/** Microsoft Word (.doc) preview. */
export const DOCSPreview: React.FC<PreviewProps> = (props) => (
  <PreviewFrame {...props} label="Word" />
)

export default DOCSPreview
