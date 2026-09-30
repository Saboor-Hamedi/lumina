import React from 'react'
import { PreviewFrame, type PreviewProps } from './PreviewFrame'

/** Print-ready PDF document preview (A4 page, TOC, diagrams). */
export const PDFPreview: React.FC<PreviewProps> = (props) => <PreviewFrame {...props} label="PDF" />

export default PDFPreview
