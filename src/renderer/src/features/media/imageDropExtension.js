import { EditorView } from '@codemirror/view'
import { useVaultStore } from '../../core/store/workspaceStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'

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
            await useVaultStore.getState().loadVault()
            if (result?.importedFolderIds && result.importedFolderIds.length > 0) {
              const currentExpanded = useSettingsStore.getState().settings.expandedFolders || []
              const nextExpanded = Array.from(new Set([...currentExpanded, ...result.importedFolderIds]))
              try {
                localStorage.setItem('lumina-expanded-folders', JSON.stringify(nextExpanded))
              } catch (e) {}
              useSettingsStore.getState().updateSetting('expandedFolders', nextExpanded)
            }
            if (result?.importedSnippetIds && result.importedSnippetIds.length > 0) {
              const targetId = result.importedSnippetIds[0]
              const snippets = useVaultStore.getState().snippets || []
              const found = snippets.find((s) => s.id === targetId)
              if (found) {
                useVaultStore.getState().setSelectedSnippet(found)
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
      return false
    }
  })
