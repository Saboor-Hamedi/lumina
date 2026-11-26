import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { useSettingsStore } from '../../../core/store/SettingStore'
import { applyRichPasteToView, isTsvTable } from '../../Editor/utils/htmlToMarkdown'
import { trySmartLinkPaste } from '../../Editor/utils/smartLinkPaste'
import { encodeMarkdownImageUrl } from '../utils/assetUrl'

type ElectronFile = File & { path?: string }

interface ImportExternalPathsResult {
  importedFolderIds?: string[]
  importedNoteIds?: string[]
  importedSnippetIds?: string[]
}

export const imageDropExtension = (): Extension =>
  EditorView.domEventHandlers({
    dragover(event) {
      if (event.dataTransfer?.types?.includes('Files')) {
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'copy'
      }
    },

    drop(event, view) {
      const files = Array.from(event.dataTransfer?.files || [])
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))

      if (imageFiles.length > 0) {
        event.preventDefault()
        event.stopPropagation()

        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos == null) return true

        imageFiles.forEach(async (file) => {
          try {
            const arrayBuffer = await file.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)
            const relativePath: string | null | undefined = await window.api.saveImage(uint8Array, file.name)

            if (relativePath) {
              const encodedPath = encodeMarkdownImageUrl(relativePath)
              const markdownToInsert = `\n![${file.name}](${encodedPath})\n`
              const currentDocLen = view.state.doc.length
              const safePos = Math.max(0, Math.min(pos, currentDocLen))
              const safeAnchor = Math.min(safePos + markdownToInsert.length, currentDocLen + markdownToInsert.length)

              view.dispatch({
                changes: { from: safePos, insert: markdownToInsert },
                selection: { anchor: safeAnchor }
              })
            }
          } catch (error) {
            console.error('Failed to save dropped image:', error)
          }
        })

        return true
      }

      const paths = files
        .map((f) =>
          window.api?.getPathForFile
            ? (window.api.getPathForFile(f) as string | undefined)
            : (f as ElectronFile).path
        )
        .filter((p): p is string => Boolean(p))

      if (paths.length > 0) {
        event.preventDefault()
        event.stopPropagation()

        ;(window.api?.importExternalPaths?.(paths, '') as Promise<ImportExternalPathsResult | undefined> | undefined)
          ?.then(async (result) => {
            await useWorkspaceStore.getState().loadWorkspace()
            if (result?.importedFolderIds && result.importedFolderIds.length > 0) {
              const currentExpanded = useSettingsStore.getState().settings.expandedFolders || []
              const nextExpanded = Array.from(new Set([...currentExpanded, ...result.importedFolderIds]))
              useSettingsStore.getState().updateSetting('expandedFolders', nextExpanded)
            }
            const importedIds = result?.importedNoteIds || result?.importedSnippetIds || []
            if (importedIds.length > 0) {
              const targetId = importedIds[0]
              const notes = useWorkspaceStore.getState().notes || []
              const found = notes.find((s) => s.id === targetId)
              if (found) {
                const setSel = useWorkspaceStore.getState().setSelectedNote || useWorkspaceStore.getState().setSelectedSnippet
                if (setSel) setSel(found)
              }
            }
          })
          .catch((err: unknown) => {
            console.error('Failed to import dropped folder/files:', err)
          })
        return true
      }

      return false
    },

    paste(event, view) {
      // 1. Shift key bypass: Ctrl+Shift+V / Cmd+Shift+V pastes as raw plain text
      if ((event as ClipboardEvent & { shiftKey?: boolean }).shiftKey) {
        return false
      }

      const rawText = event.clipboardData?.getData('text/plain') || ''
      const rawHtml = event.clipboardData?.getData('text/html') || ''

      // 2. Markdown Link Smart-Paste: When text is selected and a URL is pasted,
      // transform into [Selected Text](https://url) instead of overwriting the text.
      if (rawText && trySmartLinkPaste(view, rawText)) {
        event.preventDefault()
        event.stopPropagation()
        return true
      }

      // 3. Table & Rich Document Priority:
      // When copying cells from Excel or Google Sheets, the clipboard provides rich HTML containing <table>
      // AND also attaches an image/png snapshot. If a table, structured HTML, or TSV data is detected,
      // prioritize parsing it as a Markdown table instead of saving the companion snapshot image.
      const hasTable = /<(?:table|tbody|thead|tr|td|th)\b/i.test(rawHtml)
      const hasStructuredHtml = /<(?:table|tbody|thead|tr|td|th|p|div|h[1-6]|ul|ol|li|blockquote)\b/i.test(rawHtml)
      const isTsv = isTsvTable(rawText)

      if ((rawHtml && (hasTable || hasStructuredHtml)) || isTsv) {
        event.preventDefault()
        event.stopPropagation()

        applyRichPasteToView(view, rawHtml, rawText).catch((err: unknown) => {
          console.error('[imageDropExtension] Failed to apply rich paste:', err)
        })
        return true
      }

      // 4. Direct image file paste (e.g. copied image file or screenshot from clipboard)
      const items = Array.from(event.clipboardData?.items || [])
      const fileFromItems = items
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter((f): f is File => f !== null)

      const directFiles = Array.from(event.clipboardData?.files || []).filter((f) =>
        f.type.startsWith('image/')
      )

      const imageFiles = fileFromItems.length > 0 ? fileFromItems : directFiles

      if (imageFiles.length > 0) {
        event.preventDefault()
        event.stopPropagation()

        const pos = view.state.selection.main.head

        imageFiles.forEach(async (file) => {
          try {
            const arrayBuffer = await file.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)

            const ext = file.type.split('/')[1] || 'png'
            const filename =
              file.name && file.name !== 'image.png' && file.name !== 'image.jpeg'
                ? file.name
                : `Pasted image ${Date.now()}.${ext}`

            const relativePath: string | null | undefined = await window.api.saveImage(uint8Array, filename)

            if (relativePath) {
              const encodedPath = encodeMarkdownImageUrl(relativePath)
              const markdownToInsert = `![${filename}](${encodedPath})`
              const currentDocLen = view.state.doc.length
              const safePos = Math.max(0, Math.min(pos, currentDocLen))
              const safeAnchor = Math.min(safePos + markdownToInsert.length, currentDocLen + markdownToInsert.length)

              view.dispatch({
                changes: { from: safePos, insert: markdownToInsert },
                selection: { anchor: safeAnchor }
              })
            }
          } catch (error) {
            console.error('Failed to save pasted image:', error)
          }
        })

        return true
      }

      // 5. Fallback for any remaining rich HTML formatting
      if (rawHtml && rawHtml.trim()) {
        event.preventDefault()
        event.stopPropagation()

        applyRichPasteToView(view, rawHtml, rawText).catch((err: unknown) => {
          console.error('[imageDropExtension] Failed to apply rich paste:', err)
        })
        return true
      }

      return false
    }
  })
