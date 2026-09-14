import { useCallback } from 'react'
import type { UseEditorExportsProps, UseEditorExportsReturn, ExportResult } from './types'

declare global {
  interface Window {
    api?: {
      exportHTML?: (payload: { title: string; content: string; language?: string }) => Promise<ExportResult>
      exportPDF?: (payload: { title: string; content: string; language?: string }) => Promise<ExportResult>
      exportText?: (payload: { title: string; content: string; language?: string }) => Promise<ExportResult>
      exportDocs?: (payload: { title: string; content: string; language?: string }) => Promise<ExportResult>
      exportMarkdown?: (payload: { title: string; content: string; language?: string }) => Promise<ExportResult>
      exportMarkdownBundle?: (payload: { title: string; content: string; language?: string }) => Promise<ExportResult>
      [key: string]: any
    }
  }
}

/**
 * Hardened Editor Exports Hook (`useEditorExports.ts`)
 *
 * Responsibilities:
 * - HTML Export (copied to clipboard / file)
 * - PDF Export
 * - Plain Text Export
 * - Docs Export
 * - Markdown Export
 * - Markdown Bundle Export
 *
 * Robust error handling, null guards, and user toast notifications.
 */
export function useEditorExports({
  snippet,
  title,
  editorHandleRef,
  showToast
}: UseEditorExportsProps): UseEditorExportsReturn {
  const getExportTitle = useCallback(() => {
    return (title || snippet?.title || 'Untitled').trim()
  }, [title, snippet?.title])

  const getContent = useCallback(() => {
    if (!editorHandleRef.current) return null
    try {
      return editorHandleRef.current.getMarkdown() ?? ''
    } catch (err) {
      console.error('[useEditorExports] Failed to get markdown from editor handle:', err)
      return null
    }
  }, [editorHandleRef])

  const handleExportHTML = useCallback(async (): Promise<ExportResult | undefined> => {
    if (!snippet) {
      showToast?.('No active note to export', 'error')
      return
    }
    if (!editorHandleRef.current) {
      showToast?.('Editor is not ready', 'error')
      return
    }
    if (!window.api?.exportHTML) {
      showToast?.('HTML export is not supported in this environment', 'error')
      return
    }

    try {
      const code = getContent()
      if (code === null) return
      const res = await window.api.exportHTML({
        title: getExportTitle(),
        content: code,
        language: snippet.language || 'markdown'
      })
      if (res?.success) {
        showToast?.('HTML exported successfully', 'success')
      } else if (res?.error) {
        showToast?.(`Failed to export HTML: ${res.error}`, 'error')
      }
      return res
    } catch (error: any) {
      showToast?.(`Failed to export HTML: ${error?.message || 'Unknown error'}`, 'error')
      throw error
    }
  }, [snippet, getExportTitle, getContent, showToast, editorHandleRef])

  const handleExportPDF = useCallback(async (): Promise<ExportResult | undefined> => {
    if (!snippet) {
      showToast?.('No active note to export', 'error')
      return
    }
    if (!editorHandleRef.current) {
      showToast?.('Editor is not ready', 'error')
      return
    }
    if (!window.api?.exportPDF) {
      showToast?.('PDF export is not supported in this environment', 'error')
      return
    }

    try {
      const code = getContent()
      if (code === null) return
      const res = await window.api.exportPDF({
        title: getExportTitle(),
        content: code,
        language: snippet.language || 'markdown'
      })
      if (res?.success) {
        showToast?.('PDF exported successfully', 'success')
      } else if (res?.error) {
        showToast?.(`Failed to export PDF: ${res.error}`, 'error')
      }
      return res
    } catch (error: any) {
      showToast?.(`Failed to export PDF: ${error?.message || 'Unknown error'}`, 'error')
      throw error
    }
  }, [snippet, getExportTitle, getContent, showToast, editorHandleRef])

  const handleExportText = useCallback(async (): Promise<ExportResult | undefined> => {
    if (!snippet) {
      showToast?.('No active note to export', 'error')
      return
    }
    if (!editorHandleRef.current) {
      showToast?.('Editor is not ready', 'error')
      return
    }
    if (!window.api?.exportText) {
      showToast?.('Text export is not supported in this environment', 'error')
      return
    }

    try {
      const code = getContent()
      if (code === null) return
      const res = await window.api.exportText({
        title: getExportTitle(),
        content: code,
        language: snippet.language || 'markdown'
      })
      if (res?.success) {
        showToast?.('Text file exported successfully', 'success')
      } else if (res?.error) {
        showToast?.(`Failed to export text: ${res.error}`, 'error')
      }
      return res
    } catch (error: any) {
      showToast?.(`Failed to export text: ${error?.message || 'Unknown error'}`, 'error')
      throw error
    }
  }, [snippet, getExportTitle, getContent, showToast, editorHandleRef])

  const handleExportDocs = useCallback(async (): Promise<ExportResult | undefined> => {
    if (!snippet) {
      showToast?.('No active note to export', 'error')
      return
    }
    if (!editorHandleRef.current) {
      showToast?.('Editor is not ready', 'error')
      return
    }
    if (!window.api?.exportDocs) {
      showToast?.('Word export is not supported in this environment', 'error')
      return
    }

    try {
      const code = getContent()
      if (code === null) return
      const res = await window.api.exportDocs({
        title: getExportTitle(),
        content: code,
        language: snippet.language || 'markdown'
      })
      if (res?.success) {
        showToast?.('Word document exported successfully', 'success')
      } else if (res?.error) {
        showToast?.(`Failed to export Docs: ${res.error}`, 'error')
      }
      return res
    } catch (error: any) {
      showToast?.(`Failed to export Docs: ${error?.message || 'Unknown error'}`, 'error')
      throw error
    }
  }, [snippet, getExportTitle, getContent, showToast, editorHandleRef])

  const handleExportMarkdown = useCallback(async (): Promise<ExportResult | undefined> => {
    if (!snippet) {
      showToast?.('No active note to export', 'error')
      return
    }
    if (!editorHandleRef.current) {
      showToast?.('Editor is not ready', 'error')
      return
    }
    if (!window.api?.exportMarkdown) {
      showToast?.('Markdown export is not supported in this environment', 'error')
      return
    }

    try {
      const code = getContent()
      if (code === null) return
      const res = await window.api.exportMarkdown({
        title: getExportTitle(),
        content: code,
        language: snippet.language || 'markdown'
      })
      if (res?.success) {
        showToast?.('Markdown file exported successfully', 'success')
      } else if (res?.error) {
        showToast?.(`Failed to export markdown: ${res.error}`, 'error')
      }
      return res
    } catch (error: any) {
      showToast?.(`Failed to export markdown: ${error?.message || 'Unknown error'}`, 'error')
      throw error
    }
  }, [snippet, getExportTitle, getContent, showToast, editorHandleRef])

  const handleExportMarkdownBundle = useCallback(async (): Promise<ExportResult | undefined> => {
    if (!snippet) {
      showToast?.('No active note to export', 'error')
      return
    }
    if (!editorHandleRef.current) {
      showToast?.('Editor is not ready', 'error')
      return
    }
    if (!window.api?.exportMarkdownBundle) {
      showToast?.('Markdown bundle export is not supported in this environment', 'error')
      return
    }

    try {
      const code = getContent()
      if (code === null) return
      const res = await window.api.exportMarkdownBundle({
        title: getExportTitle(),
        content: code,
        language: snippet.language || 'markdown'
      })
      if (res?.success) {
        showToast?.('Exported Markdown bundle successfully', 'success')
      } else if (res?.error) {
        showToast?.(`Failed to export markdown bundle: ${res.error}`, 'error')
      }
      return res
    } catch (error: any) {
      showToast?.(`Failed to export markdown bundle: ${error?.message || 'Unknown error'}`, 'error')
      throw error
    }
  }, [snippet, getExportTitle, getContent, showToast, editorHandleRef])

  return {
    handleExportHTML,
    handleExportPDF,
    handleExportText,
    handleExportDocs,
    handleExportMarkdown,
    handleExportMarkdownBundle
  }
}

export default useEditorExports
