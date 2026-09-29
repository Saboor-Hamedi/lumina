import { EditorView } from '@codemirror/view'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { useSettingsStore } from '../../../core/store/SettingStore'
import { htmlToMarkdown, applyRichPasteToView } from '../../Editor/utils/htmlToMarkdown'

export const imageDropExtension = () =>
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
            const relativePath = await window.api.saveImage(uint8Array, file.name)

            if (relativePath) {
              const markdownToInsert = `\n![${file.name}](${relativePath})\n`

              view.dispatch({
                changes: { from: pos, insert: markdownToInsert },
                selection: { anchor: pos + markdownToInsert.length }
              })
            }
          } catch (error) {
            console.error('Failed to save dropped image:', error)
          }
        })

        return true
      }

      const paths = files
        .map((f) => (window.api?.getPathForFile ? window.api.getPathForFile(f) : f.path))
        .filter(Boolean)

      if (paths.length > 0) {
        event.preventDefault()
        event.stopPropagation()

        window.api
          ?.importExternalPaths?.(paths, '')
          .then(async (result) => {
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
          .catch((err) => {
            console.error('Failed to import dropped folder/files:', err)
          })
        return true
      }

      return false
    },

    paste(event, view) {
      // 1. Shift key bypass: Ctrl+Shift+V / Cmd+Shift+V pastes as raw plain text
      if (event.shiftKey) {
        return false
      }

      // 2. Direct image file paste (e.g. copied image or screenshot from clipboard)
      const items = Array.from(event.clipboardData?.items || [])
      const fileFromItems = items
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter(Boolean)

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

            const relativePath = await window.api.saveImage(uint8Array, filename)

            if (relativePath) {
              const markdownToInsert = `![${filename}](${relativePath})`

              view.dispatch({
                changes: { from: pos, insert: markdownToInsert },
                selection: { anchor: pos + markdownToInsert.length }
              })
            }
          } catch (error) {
            console.error('Failed to save pasted image:', error)
          }
        })

        return true
      }

      // 3. Rich HTML / Word Paste: convert tables, formatting & extract images
      const rawHtml = event.clipboardData?.getData('text/html')
      if (rawHtml && rawHtml.trim()) {
        event.preventDefault()
        event.stopPropagation()

        const rawText = event.clipboardData?.getData('text/plain') || ''
        applyRichPasteToView(view, rawHtml, rawText)
        return true
      }

      return false
    }
  })
