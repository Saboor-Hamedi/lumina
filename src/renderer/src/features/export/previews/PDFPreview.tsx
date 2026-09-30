import React from 'react'
import { PreviewFrame, type PreviewProps } from './PreviewFrame'

export const PDFPreview: React.FC<PreviewProps> = (props) => (
  <PreviewFrame {...props} label="PDF" />
)

export default PDFPreview
