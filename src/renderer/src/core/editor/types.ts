import React from 'react'
import type { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import type { ToastType } from '../notification'

export interface Snippet {
  id: string
  title: string
  code: string
  fileName?: string
  folderId?: string
  tags?: string | string[]
  isOversized?: boolean
  isPartial?: boolean
  timestamp?: number
  createdAt?: number
  updatedAt?: number
  customIcon?: string
  [key: string]: any
}

export interface EditorHandle {
  getMarkdown: () => string
  setMarkdown?: (code: string) => void
  view?: EditorView | null
  [key: string]: any
}

export interface ExportPayload {
  title: string
  content: string
  language?: string
}

export interface ExportResult {
  success: boolean
  filePath?: string
  canceled?: boolean
  error?: string
}

export interface UseEditorExportsProps {
  snippet: Snippet | null
  title?: string
  editorHandleRef: React.RefObject<EditorHandle | null>
  showToast: (message: string, type?: ToastType) => void
}

export interface UseEditorExportsReturn {
  handleExportHTML: () => Promise<ExportResult | undefined>
  handleExportPDF: () => Promise<ExportResult | undefined>
  handleExportText: () => Promise<ExportResult | undefined>
  handleExportDocs: () => Promise<ExportResult | undefined>
  handleExportMarkdown: () => Promise<ExportResult | undefined>
  handleExportMarkdownBundle: () => Promise<ExportResult | undefined>
}

export interface UseEditorStateProps {
  snippet: Snippet | null
  onSave: (snippet: Snippet) => Promise<Snippet | void>
  showToast: (message: string, type?: ToastType) => void
  realViewRef: React.MutableRefObject<EditorView | null>
  editorHandleRef: React.RefObject<EditorHandle | null>
}

export interface UseEditorStateReturn {
  title: string
  setTitle: React.Dispatch<React.SetStateAction<string>>
  isDirty: boolean
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>
  isSaving: boolean
  editorKey: number
  conflictPrompt: any
  snippetRef: React.MutableRefObject<Snippet | null>
  latestCodeRef: React.MutableRefObject<string>
  lastSavedCodeRef: React.MutableRefObject<string | undefined>
  lastSaveTimeRef: React.MutableRefObject<number>
  handleSave: () => Promise<void>
  handleMarkdownChange: (md: string) => void
  handleOverwriteClose: () => void
  handleOverwriteConfirm: () => Promise<void>
}

export interface UseZoomOptions {
  containerRef?: React.RefObject<HTMLElement | null>
  realViewRef?: React.MutableRefObject<EditorView | null>
  minSize?: number
  maxSize?: number
  step?: number
  defaultSize?: number
  isActive?: boolean
}

export interface UseZoomProps extends UseZoomOptions {}

export interface UseZoomReturn {
  fontSize: number
  zoomIn: (delta?: number) => void
  zoomOut: (delta?: number) => void
  resetZoom: () => void
  setZoom: (newSize: number) => void
  zoomBadge: string | null
}

export interface UseEditorExtensionsProps {
  snippetRef: React.MutableRefObject<Snippet | null>
  realViewRef: React.MutableRefObject<EditorView | null>
  showToast: (message: string, type?: ToastType) => void
  isActiveRef: React.MutableRefObject<boolean>
  showFindWidgetRef: React.MutableRefObject<boolean>
  setShowFindWidget: React.Dispatch<React.SetStateAction<boolean>>
  setReplaceModeActive: React.Dispatch<React.SetStateAction<boolean>>
  onSlashStateChange?: (state: any) => void
  slashHandlerRef?: React.MutableRefObject<any>
  setSlashState?: React.Dispatch<React.SetStateAction<any>>
}

export interface UseEditorExtensionsReturn {
  finalExtensions: Extension[]
  captureViewPlugin: Extension
}
