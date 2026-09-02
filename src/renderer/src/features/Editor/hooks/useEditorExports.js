/**
 * =========================================================================================
 * Editor Exports Hook (`useEditorExports.js`)
 * =========================================================================================
 *
 * Responsibilities:
 * - HTML Export (copied to clipboard)
 * - PDF Export
 * - Plain Text Export
 * - Docs Export
 * - Markdown Export
 * =========================================================================================
 */

import { useCallback } from 'react'

export function useEditorExports({ snippet, title, editorHandleRef, showToast }) {
  const handleExportHTML = useCallback(async () => {
    if (!snippet || !editorHandleRef.current) return
    if (!window.api?.exportHTML) return
    try {
      const code = editorHandleRef.current.getMarkdown()
      const res = await window.api.exportHTML({
        title: title || snippet.title || 'Untitled',
        content: code,
        language: snippet.language || 'markdown'
      })
      if (res?.success) {
        showToast('HTML exported successfully', 'success')
      }
      return res
    } catch (error) {
      showToast('Failed to export HTML', 'error')
      throw error
    }
  }, [snippet, title, showToast, editorHandleRef])

  const handleExportPDF = useCallback(async () => {
    if (!snippet || !editorHandleRef.current) return
    if (!window.api?.exportPDF) return
    try {
      const code = editorHandleRef.current.getMarkdown()
      return await window.api.exportPDF({
        title: title || snippet.title || 'Untitled',
        content: code,
        language: snippet.language || 'markdown'
      })
    } catch (error) {
      showToast('Failed to export PDF', 'error')
      throw error
    }
  }, [snippet, title, showToast, editorHandleRef])

  const handleExportText = useCallback(async () => {
    if (!snippet || !editorHandleRef.current) return
    if (!window.api?.exportText) return
    try {
      const code = editorHandleRef.current.getMarkdown()
      return await window.api.exportText({
        title: title || snippet.title || 'Untitled',
        content: code,
        language: snippet.language || 'markdown'
      })
    } catch (error) {
      showToast('Failed to export text', 'error')
      throw error
    }
  }, [snippet, title, showToast, editorHandleRef])

  const handleExportDocs = useCallback(async () => {
    if (!snippet || !editorHandleRef.current) return
    if (!window.api?.exportDocs) return
    try {
      const code = editorHandleRef.current.getMarkdown()
      return await window.api.exportDocs({
        title: title || snippet.title || 'Untitled',
        content: code,
        language: snippet.language || 'markdown'
      })
    } catch (error) {
      showToast('Failed to export Docs', 'error')
      throw error
    }
  }, [snippet, title, showToast, editorHandleRef])

  const handleExportMarkdown = useCallback(async () => {
    if (!snippet || !editorHandleRef.current) return
    if (!window.api?.exportMarkdown) return
    try {
      const code = editorHandleRef.current.getMarkdown()
      return await window.api.exportMarkdown({
        title: title || snippet.title || 'Untitled',
        content: code,
        language: snippet.language || 'markdown'
      })
    } catch (error) {
      showToast('Failed to export markdown', 'error')
      throw error
    }
  }, [snippet, title, showToast, editorHandleRef])

  const handleExportMarkdownBundle = useCallback(async () => {
    if (!snippet || !editorHandleRef.current) return
    if (!window.api?.exportMarkdownBundle) return
    try {
      const code = editorHandleRef.current.getMarkdown()
      const res = await window.api.exportMarkdownBundle({
        title: title || snippet.title || 'Untitled',
        content: code,
        language: snippet.language || 'markdown'
      })
      if (res?.success) {
        showToast('Exported Markdown bundle successfully', 'success')
      }
      return res
    } catch (error) {
      showToast('Failed to export markdown bundle', 'error')
      throw error
    }
  }, [snippet, title, showToast, editorHandleRef])

  return {
    handleExportHTML,
    handleExportPDF,
    handleExportText,
    handleExportDocs,
    handleExportMarkdown,
    handleExportMarkdownBundle
  }
}
