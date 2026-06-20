import { EditorView } from '@codemirror/view'

export const imageDropExtension = (onToast) =>
  EditorView.domEventHandlers({
    dragover(event, view) {
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

        // Calculate where the user dropped the file in the text
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos == null) return

        imageFiles.forEach(async (file) => {
          try {
            const arrayBuffer = await file.arrayBuffer()
            const relativePath = await window.api.saveImage(arrayBuffer, file.name)

            if (relativePath) {
              // Insert markdown at drop position
              const markdownToInsert = `\n![${file.name}](${relativePath})\n`

              view.dispatch({
                changes: { from: pos, insert: markdownToInsert },
                selection: { anchor: pos + markdownToInsert.length }
              })

              if (onToast) onToast('Image saved successfully', 'success')
            }
          } catch (error) {
            console.error('Failed to save dropped image:', error)
            if (onToast) onToast('Failed to save image', 'error')
          }
        })

        return true
      }
      return false
    }
  })
