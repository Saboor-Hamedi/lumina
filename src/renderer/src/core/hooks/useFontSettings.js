import { useEffect, useState } from 'react'

export const useFontSettings = () => {
  const [editorFontFamily, setEditorFontFamily] = useState('JetBrains Mono')
  const [editorFontSize, setEditorFontSize] = useState(14)
  const [previewFontFamily, setPreviewFontFamily] = useState('JetBrains Mono')
  const [previewFontSize, setPreviewFontSize] = useState(14)
  const [baseThemeName, setBaseThemeName] = useState('dark')
  const [baseColors, setBaseColors] = useState({})
  const [caretStyle, setCaretStyle] = useState('bar')
  const [caretWidth, setCaretWidth] = useState('3px')

  useEffect(() => {
    ;(async () => {
      try {
        const row = await window.api?.getTheme?.()
        const themeName = document.documentElement.getAttribute('data-theme') || 'dark'
        setBaseThemeName(row?.name || themeName)
        const colors = row?.colors ? JSON.parse(row.colors) : {}
        setBaseColors(colors)
        const ef = colors.editorFontFamily || 'JetBrains Mono'
        const es = parseInt(colors.editorFontSize != null ? colors.editorFontSize : '14', 10)
        const pf = colors.previewFontFamily || ef
        const ps = parseInt(
          colors.previewFontSize != null ? colors.previewFontSize : String(es),
          10
        )
        setEditorFontFamily(ef)
        setEditorFontSize(isNaN(es) ? 14 : es)
        setPreviewFontFamily(pf)
        setPreviewFontSize(isNaN(ps) ? 14 : ps)

        const root = document.documentElement
        const cw = colors.caretWidth || '3px'
        const clb = colors.currentLineBg || null
        const pxCW = String(cw).endsWith('px') ? cw : `${cw}px`
        root.style.setProperty('--caret-width', pxCW)
        if (clb) root.style.setProperty('--current-line-bg', clb)
        const caretStyle = colors.caretStyle || 'bar'
        root.style.setProperty('--caret-style', caretStyle)
        setCaretStyle(caretStyle)
        setCaretWidth(pxCW)

        const needsPersist =
          !row ||
          !row.colors ||
          typeof colors.editorFontFamily === 'undefined' ||
          typeof colors.editorFontSize === 'undefined' ||
          typeof colors.previewFontFamily === 'undefined' ||
          typeof colors.previewFontSize === 'undefined' ||
          typeof colors.caretWidth === 'undefined' ||
          typeof colors.caretStyle === 'undefined'
        if (needsPersist) {
          const mergedDefaults = {
            editorFontFamily: ef,
            editorFontSize: isNaN(es) ? 14 : es,
            previewFontFamily: pf,
            previewFontSize: isNaN(ps) ? 14 : ps,
            caretWidth: pxCW,
            caretStyle
          }
          await window.api?.saveTheme?.({
            id: 'current',
            name: row?.name || themeName,
            colors: JSON.stringify({ ...colors, ...mergedDefaults })
          })
          setBaseColors({ ...colors, ...mergedDefaults })
        }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const sizeRem = `${editorFontSize / 16}rem`
    const pSizeRem = `${previewFontSize / 16}rem`
    root.style.setProperty('--editor-font-family', editorFontFamily)
    root.style.setProperty('--editor-font-size', sizeRem)
    root.style.setProperty('--preview-font-family', previewFontFamily)
    root.style.setProperty('--preview-font-size', pSizeRem)
  }, [editorFontFamily, editorFontSize, previewFontFamily, previewFontSize])

  const persistTheme = async (next) => {
    try {
      const merged = { ...baseColors, ...next }
      await window.api?.saveTheme?.({
        id: 'current',
        name: baseThemeName || document.documentElement.getAttribute('data-theme') || 'dark',
        colors: JSON.stringify(merged)
      })
      setBaseColors(merged)
    } catch {}
  }

  const updateEditorFontFamily = (f) => {
    setEditorFontFamily(f)
    persistTheme({ editorFontFamily: f })
  }
  const updateEditorFontSize = (s) => {
    const n = typeof s === 'number' ? s : parseInt(s, 10)
    setEditorFontSize(n)
    persistTheme({ editorFontSize: n })
  }
  const updatePreviewFontFamily = (f) => {
    setPreviewFontFamily(f)
    persistTheme({ previewFontFamily: f })
  }
  const updatePreviewFontSize = (s) => {
    const n = typeof s === 'number' ? s : parseInt(s, 10)
    setPreviewFontSize(n)
    persistTheme({ previewFontSize: n })
  }
  const updateCaretWidth = (s) => {
    const val = String(s).endsWith('px') ? s : `${s}px`
    setCaretWidth(val)
    document.documentElement.style.setProperty('--caret-width', val)
    persistTheme({ caretWidth: val })
  }
  const updateCaretStyle = (style) => {
    setCaretStyle(style)
    document.documentElement.style.setProperty('--caret-style', style)
    persistTheme({ caretStyle: style })
  }

  return {
    editorFontFamily,
    editorFontSize,
    previewFontFamily,
    previewFontSize,
    caretStyle,
    caretWidth,
    updateEditorFontFamily,
    updateEditorFontSize,
    updatePreviewFontFamily,
    updatePreviewFontSize,
    updateCaretWidth,
    updateCaretStyle
  }
}

export default useFontSettings
