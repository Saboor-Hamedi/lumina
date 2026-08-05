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
            const uint8Array = new Uint8Array(arrayBuffer)
            const relativePath = await window.api.saveImage(uint8Array, file.name)

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
    },

    paste(event, view) {
      const files = Array.from(event.clipboardData?.files || [])
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))

      if (imageFiles.length > 0) {
        event.preventDefault()
        event.stopPropagation()

        // Get the current cursor position
        const pos = view.state.selection.main.head

        imageFiles.forEach(async (file) => {
          try {
            const arrayBuffer = await file.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)
            
            // Generate a better filename if it's a generic paste (like 'image.png' from clipboard)
            const ext = file.type.split('/')[1] || 'png'
            const filename = (file.name === 'image.png' || file.name === 'image.jpeg') 
              ? `Pasted image ${Date.now()}.${ext}` 
              : file.name

            const relativePath = await window.api.saveImage(uint8Array, filename)

            if (relativePath) {
              // Insert markdown at cursor position (inline, no newlines)
              const markdownToInsert = `![${filename}](${relativePath})`

              view.dispatch({
                changes: { from: pos, insert: markdownToInsert },
                selection: { anchor: pos + markdownToInsert.length }
              })

              if (onToast) onToast('Image pasted successfully', 'success')
            }
          } catch (error) {
            console.error('Failed to save pasted image:', error)
            if (onToast) onToast('Failed to paste image', 'error')
          }
        })

        return true
      }
      return false
    }
  })
