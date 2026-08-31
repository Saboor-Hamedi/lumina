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
      const html = await window.api.exportHTML({
        title: title || snippet.title || 'Untitled',
        content: code,
        language: snippet.language || 'markdown'
      })
      if (html) {
        await navigator.clipboard.writeText(html)
        showToast('HTML copied to clipboard', 'success')
      }
    } catch (error) {
      showToast('Failed to export HTML', 'error')
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

  return {
    handleExportHTML,
    handleExportPDF,
    handleExportText,
    handleExportDocs,
    handleExportMarkdown
  }
}
