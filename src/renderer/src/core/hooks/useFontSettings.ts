import { useEffect, useState, useCallback, useRef } from 'react'
import { getTheme } from '../../features/theme/hooks/themeDefinitions'
import { buildFontFamilyStack } from '../i18n'

/**
 * Default configuration constants for font and caret settings
 */
const DEFAULTS = {
  FONT_FAMILY: 'JetBrains Mono',
  FONT_SIZE: 14,
  CARET_WIDTH: '2px',
  CARET_WIDTH_MIN: 1,
  CARET_WIDTH_MAX: 10,
  CARET_STYLE: 'smooth',
  THEME: 'dark'
} as const

/**
 * Normalize pixel value to ensure it has 'px' suffix
 */
const normalizePixelValue = (value: string | number): string => {
  if (typeof value === 'number') return `${value}px`
  if (typeof value === 'string' && value.endsWith('px')) return value
  return `${value}px`
}

/**
 * Clamps caret width to valid range (1-10px) and normalizes the output
 */
const clampCaretWidth = (width: string | number): string => {
  let num: number
  if (typeof width === 'string') {
    num = parseInt(width.replace('px', ''), 10)
  } else {
    num = width
  }
  if (isNaN(num)) return DEFAULTS.CARET_WIDTH
  const clamped = Math.max(DEFAULTS.CARET_WIDTH_MIN, Math.min(DEFAULTS.CARET_WIDTH_MAX, num))
  return normalizePixelValue(clamped)
}

/**
 * Applies caret CSS variables to the document root element
 */
const applyCaretStyles = (width: string, color: string): void => {
  const root = document.documentElement

  let finalColor = color
  if (!finalColor || finalColor.trim() === '') {
    const currentThemeId = root.getAttribute('data-theme') || 'dark'
    const currentTheme = getTheme(currentThemeId)
    finalColor =
      currentTheme.colors['--caret-color'] || currentTheme.colors['--text-accent'] || '#40bafa'
  }

  root.style.setProperty('--caret-width', width)
  root.style.setProperty('--caret-color', finalColor)
  void root.offsetHeight

  const verifyWidth = getComputedStyle(root).getPropertyValue('--caret-width').trim()
  if (
    !verifyWidth ||
    verifyWidth === '' ||
    (!verifyWidth.includes('px') && !width.includes('px'))
  ) {
    console.warn('[useFontSettings] CSS variable not set correctly, retrying...')
    root.style.setProperty('--caret-width', width)
    void root.offsetHeight
  }
}

export interface FontSettings {
  editorFontFamily: string
  editorFontSize: number
  previewFontFamily: string
  previewFontSize: number
  caretStyle: string
  caretWidth: string
  caretColor: string
  themeAccentColor: string
  useBorderLeft: boolean
  updateEditorFontFamily: (fontFamily: string) => void
  updateEditorFontSize: (size: string | number) => void
  updatePreviewFontFamily: (fontFamily: string) => void
  updatePreviewFontSize: (size: string | number) => void
  updateCaretWidth: (width: string | number) => void
  updateCaretStyle: (style: string) => void
  updateCaretColor: (color: string) => void
  updateThemeAccentColor: (color: string) => void
  updateUseBorderLeft: (enabled: boolean) => void
}

/**
 * useFontSettings Hook
 *
 * Comprehensive hook for managing font and caret settings with persistence.
 */
export const useFontSettings = (): FontSettings => {
  // Helper to synchronously read from localStorage on mount to prevent FOUC
  const getInitial = <T>(key: string, defaultVal: T): T => {
    try {
      const saved = localStorage.getItem('theme-colors')
      if (saved) {
        const val = JSON.parse(saved)[key]
        if (val !== undefined && val !== null && val !== '') return val
      }
    } catch {
      // Fall through
    }
    return defaultVal
  }

  const [editorFontFamily, setEditorFontFamily] = useState<string>(() =>
    getInitial('editorFontFamily', DEFAULTS.FONT_FAMILY)
  )
  const [editorFontSize, setEditorFontSize] = useState<number>(() =>
    getInitial('editorFontSize', DEFAULTS.FONT_SIZE)
  )
  const [previewFontFamily, setPreviewFontFamily] = useState<string>(() =>
    getInitial('previewFontFamily', DEFAULTS.FONT_FAMILY)
  )
  const [previewFontSize, setPreviewFontSize] = useState<number>(() =>
    getInitial('previewFontSize', DEFAULTS.FONT_SIZE)
  )
  const [, setBaseThemeName] = useState<string>(DEFAULTS.THEME)
  const [baseColors, setBaseColors] = useState<Record<string, any>>(() => {
    try {
      const s = localStorage.getItem('theme-colors')
      return s ? JSON.parse(s) : {}
    } catch {
      return {}
    }
  })
  const [caretStyle, setCaretStyle] = useState<string>(() =>
    getInitial('caretStyle', DEFAULTS.CARET_STYLE)
  )
  const [caretWidth, setCaretWidth] = useState<string>(() =>
    getInitial('caretWidth', DEFAULTS.CARET_WIDTH)
  )
  const [caretColor, setCaretColor] = useState<string>(() => getInitial('caretColor', ''))
  const [themeAccentColor, setThemeAccentColor] = useState<string>(() =>
    getInitial('themeAccentColor', '')
  )
  const [useBorderLeft, setUseBorderLeft] = useState<boolean>(() =>
    getInitial('useBorderLeft', true)
  )

  const persistDebounceRef = useRef<any>(null)
  const caretDebounceRef = useRef<any>(null)
  const accentDebounceRef = useRef<any>(null)

  // Load settings on mount
  useEffect(() => {
    ;(async () => {
      try {
        let colors: Record<string, any> = {}
        let themeName: string = DEFAULTS.THEME

        try {
          const savedColors = localStorage.getItem('theme-colors')
          if (savedColors) {
            colors = JSON.parse(savedColors)
          }
        } catch (e) {
          console.warn('Failed to load theme colors from localStorage:', e)
        }

        const api = (window as any).api
        let allSettings: any = null
        try {
          allSettings = await api?.getSetting?.()
          const cursorSettings =
            (allSettings && allSettings.cursor) || (await api?.getSetting?.('cursor')) || {}

          if (
            (cursorSettings &&
              typeof cursorSettings === 'object' &&
              Object.keys(cursorSettings).length > 0) ||
            (allSettings && typeof allSettings === 'object')
          ) {
            let parsedCaretWidth = cursorSettings.caretWidth
            if (parsedCaretWidth !== undefined && parsedCaretWidth !== null) {
              if (typeof parsedCaretWidth === 'string' && parsedCaretWidth.includes('px')) {
                parsedCaretWidth = parseInt(parsedCaretWidth.replace('px', ''), 10)
              } else if (typeof parsedCaretWidth === 'string') {
                parsedCaretWidth = parseInt(parsedCaretWidth, 10)
              }
              if (isNaN(parsedCaretWidth) || parsedCaretWidth < 1) {
                parsedCaretWidth = parseInt(DEFAULTS.CARET_WIDTH.replace('px', ''), 10)
              }
            }

            const cursorColors = {
              caretWidth:
                parsedCaretWidth !== undefined
                  ? parsedCaretWidth
                  : (allSettings?.caretWidth ??
                    allSettings?.width ??
                    allSettings?.['caret width'] ??
                    colors.caretWidth),
              caretStyle:
                (cursorSettings && cursorSettings.caretStyle) ||
                allSettings?.cursorStyle ||
                allSettings?.caretStyle ||
                colors.caretStyle ||
                DEFAULTS.CARET_STYLE,
              caretColor:
                cursorSettings && typeof cursorSettings.caretColor !== 'undefined'
                  ? cursorSettings.caretColor
                  : (allSettings?.caretColor ?? allSettings?.color ?? colors.caretColor),
              useBorderLeft:
                typeof cursorSettings.useBorderLeft !== 'undefined'
                  ? cursorSettings.useBorderLeft !== false &&
                    cursorSettings.useBorderLeft !== 'none' &&
                    cursorSettings.useBorderLeft !== 'hidden'
                  : typeof allSettings?.useBorderLeft !== 'undefined'
                    ? allSettings.useBorderLeft !== false &&
                      allSettings.useBorderLeft !== 'none' &&
                      allSettings.useBorderLeft !== 'hidden'
                    : typeof allSettings?.borderLeft !== 'undefined'
                      ? allSettings.borderLeft !== false &&
                        allSettings.borderLeft !== 'none' &&
                        allSettings.borderLeft !== 'hidden'
                      : true,
              editorFontFamily:
                (cursorSettings && cursorSettings.editorFontFamily) ||
                (allSettings && allSettings.fontFamily) ||
                colors.editorFontFamily,
              editorFontSize:
                (cursorSettings && cursorSettings.editorFontSize) ||
                (allSettings && allSettings.fontSize) ||
                colors.editorFontSize,
              previewFontFamily:
                (cursorSettings && cursorSettings.previewFontFamily) ||
                (allSettings && allSettings.previewFontFamily) ||
                colors.previewFontFamily,
              previewFontSize:
                (cursorSettings && cursorSettings.previewFontSize) ||
                (allSettings && allSettings.previewFontSize) ||
                colors.previewFontSize,
              themeAccentColor:
                cursorSettings && typeof cursorSettings.themeAccentColor !== 'undefined'
                  ? cursorSettings.themeAccentColor
                  : (allSettings?.themeAccentColor ?? colors.themeAccentColor)
            }
            colors = { ...colors, ...cursorColors }
          }
        } catch (e) {
          console.warn('[useFontSettings] Failed to load cursor from settings.json:', e)
        }

        try {
          const themeValue = await api?.getTheme?.()
          if (themeValue) {
            if (typeof themeValue === 'string') {
              themeName = themeValue
            } else if (typeof themeValue === 'object' && themeValue.colors) {
              try {
                const dbColors = JSON.parse(themeValue.colors)
                if (!colors.caretWidth && !colors.caretStyle && !colors.caretColor) {
                  colors = { ...dbColors, ...colors }
                }
              } catch (parseErr) {
                console.warn('[useFontSettings] Failed to parse theme colors:', parseErr)
              }
              if (
                themeValue.name &&
                typeof themeValue.name === 'string' &&
                !themeValue.name.includes('object')
              ) {
                themeName = themeValue.name
              }
            }
          }
        } catch (e) {
          console.warn('[useFontSettings] Failed to load theme from settings.json:', e)
        }

        if (!themeName || themeName === DEFAULTS.THEME) {
          themeName = document.documentElement.getAttribute('data-theme') || DEFAULTS.THEME
        }

        setBaseThemeName(themeName)
        setBaseColors(colors)

        const ef =
          colors.editorFontFamily || (allSettings && allSettings.fontFamily) || DEFAULTS.FONT_FAMILY
        const es = parseFloat(
          colors.editorFontSize != null
            ? colors.editorFontSize
            : allSettings && allSettings.fontSize != null
              ? allSettings.fontSize
              : String(DEFAULTS.FONT_SIZE)
        )
        const pf = colors.previewFontFamily || (allSettings && allSettings.previewFontFamily) || ef
        const ps = parseFloat(
          colors.previewFontSize != null
            ? colors.previewFontSize
            : allSettings && allSettings.previewFontSize != null
              ? allSettings.previewFontSize
              : String(es)
        )

        setEditorFontFamily(ef)
        setEditorFontSize(isNaN(es) ? DEFAULTS.FONT_SIZE : es)
        setPreviewFontFamily(pf)
        setPreviewFontSize(isNaN(ps) ? DEFAULTS.FONT_SIZE : ps)

        const root = document.documentElement
        let savedCaretStyle = colors.caretStyle || DEFAULTS.CARET_STYLE
        if (savedCaretStyle === 'bar') savedCaretStyle = 'smooth'
        if (savedCaretStyle === 'line') savedCaretStyle = 'sharp'

        let savedCaretWidth = colors.caretWidth
        if (savedCaretWidth === undefined || savedCaretWidth === null) {
          savedCaretWidth = DEFAULTS.CARET_WIDTH
        }
        if (typeof savedCaretWidth === 'string' && savedCaretWidth.includes('px')) {
          savedCaretWidth = parseInt(savedCaretWidth.replace('px', ''), 10)
        } else if (typeof savedCaretWidth === 'string') {
          savedCaretWidth = parseInt(savedCaretWidth, 10)
        }
        if (isNaN(savedCaretWidth) || savedCaretWidth < 1) {
          savedCaretWidth = parseInt(DEFAULTS.CARET_WIDTH.replace('px', ''), 10)
        }
        const normalizedWidth = clampCaretWidth(savedCaretWidth)

        const savedCaretColor = colors.caretColor || ''
        const savedThemeAccentColor = colors.themeAccentColor || ''

        root.style.setProperty('--caret-style', savedCaretStyle)
        root.setAttribute('data-caret-style', savedCaretStyle || 'smooth')
        root.style.setProperty('--caret-width', normalizedWidth)
        const initialUseBorderLeft = colors.useBorderLeft !== undefined ? colors.useBorderLeft : true
        root.setAttribute('data-use-active-line-border', initialUseBorderLeft ? 'true' : 'false')

        let finalCaretColor = savedCaretColor
        if (!finalCaretColor || finalCaretColor.trim() === '') {
          const currentTheme = getTheme(themeName)
          finalCaretColor =
            currentTheme.colors['--caret-color'] ||
            currentTheme.colors['--text-accent'] ||
            '#40bafa'
        }
        root.style.setProperty('--caret-color', finalCaretColor)
        void root.offsetHeight

        const isMono = (f: string) => f && (f.toLowerCase().includes('mono') || f.toLowerCase().includes('code'))
        const efStack = buildFontFamilyStack(ef, isMono(ef))
        const pfStack = buildFontFamilyStack(pf, false)
        root.style.setProperty('--font-editor', efStack)
        root.style.setProperty('--font-size-editor', `${isNaN(es) ? DEFAULTS.FONT_SIZE : es}px`)
        root.style.setProperty('--editor-font-family', efStack)
        root.style.setProperty(
          '--editor-font-size',
          `${(isNaN(es) ? DEFAULTS.FONT_SIZE : es) / 16}rem`
        )
        root.style.setProperty('--preview-font-family', pfStack)
        root.style.setProperty(
          '--preview-font-size',
          `${(isNaN(ps) ? DEFAULTS.FONT_SIZE : ps) / 16}rem`
        )
        root.style.setProperty('--preview-font-size-px', `${isNaN(ps) ? DEFAULTS.FONT_SIZE : ps}px`)

        if (colors.currentLineBg) {
          root.style.setProperty('--current-line-bg', colors.currentLineBg)
        }

        setCaretStyle(savedCaretStyle)
        setCaretWidth(normalizedWidth)
        const themeDefaultColor =
          getTheme(themeName).colors['--caret-color'] || getTheme(themeName).colors['--text-accent']
        const stateCaretColor =
          savedCaretColor && savedCaretColor.trim() !== '' && savedCaretColor !== themeDefaultColor
            ? savedCaretColor
            : ''
        setCaretColor(stateCaretColor)

        const stateThemeAccentColor =
          savedThemeAccentColor && savedThemeAccentColor.trim() !== '' ? savedThemeAccentColor : ''
        setThemeAccentColor(stateThemeAccentColor)
        if (stateThemeAccentColor) {
          root.style.setProperty('--text-accent', stateThemeAccentColor)
          const rgbMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(stateThemeAccentColor)
          if (rgbMatch) {
            root.style.setProperty(
              '--text-accent-rgb',
              `${parseInt(rgbMatch[1], 16)}, ${parseInt(rgbMatch[2], 16)}, ${parseInt(rgbMatch[3], 16)}`
            )
          }
        }

        const updatedColors = {
          ...colors,
          editorFontFamily: ef,
          editorFontSize: isNaN(es) ? DEFAULTS.FONT_SIZE : es,
          previewFontFamily: pf,
          previewFontSize: isNaN(ps) ? DEFAULTS.FONT_SIZE : ps,
          caretWidth:
            typeof normalizedWidth === 'string'
              ? parseInt(normalizedWidth.replace('px', ''), 10)
              : normalizedWidth,
          caretStyle: savedCaretStyle,
          caretColor: stateCaretColor,
          themeAccentColor: stateThemeAccentColor,
          useBorderLeft: colors.useBorderLeft !== undefined ? colors.useBorderLeft : true
        }
        localStorage.setItem('theme-colors', JSON.stringify(updatedColors))
        setBaseColors(updatedColors)

        try {
          const cursorSettings = await api?.getSetting?.('cursor')
          if (
            !cursorSettings ||
            typeof cursorSettings !== 'object' ||
            Object.keys(cursorSettings).length === 0
          ) {
            const widthNumber =
              typeof normalizedWidth === 'string'
                ? parseInt(normalizedWidth.replace('px', ''), 10)
                : normalizedWidth
            await api?.saveSetting?.('cursor', {
              caretWidth: widthNumber,
              caretStyle: savedCaretStyle,
              caretColor: stateCaretColor,
              themeAccentColor: stateThemeAccentColor,
              editorFontFamily: ef,
              editorFontSize: isNaN(es) ? DEFAULTS.FONT_SIZE : es,
              previewFontFamily: pf,
              previewFontSize: isNaN(ps) ? DEFAULTS.FONT_SIZE : ps
            })
          }
        } catch (e) {
          console.warn('[useFontSettings] Failed to sync cursor settings to settings.json:', e)
        }

        requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent('caret-style-update'))
        })
      } catch (err) {
        console.warn('Failed to load theme settings:', err)
      }
    })()

    let settingsChangedUnsubscribe: any = null
    const api = (window as any).api
    if (api?.onSettingsChanged) {
      settingsChangedUnsubscribe = api.onSettingsChanged(async (settings: any) => {
        try {
          const cursorSettings = settings?.cursor || {}
          const incoming = {
            caretWidth:
              cursorSettings.caretWidth ??
              settings?.caretWidth ??
              settings?.width ??
              settings?.['caret width'],
            caretStyle: cursorSettings.caretStyle ?? settings?.cursorStyle ?? settings?.caretStyle,
            caretColor:
              typeof cursorSettings.caretColor !== 'undefined'
                ? cursorSettings.caretColor
                : (settings?.caretColor ?? settings?.color),
            themeAccentColor:
              typeof cursorSettings.themeAccentColor !== 'undefined'
                ? cursorSettings.themeAccentColor
                : settings?.themeAccentColor,
            useBorderLeft:
              typeof cursorSettings.useBorderLeft !== 'undefined'
                ? cursorSettings.useBorderLeft !== false &&
                  cursorSettings.useBorderLeft !== 'none' &&
                  cursorSettings.useBorderLeft !== 'hidden'
                : typeof settings?.useBorderLeft !== 'undefined'
                  ? settings.useBorderLeft !== false &&
                    settings.useBorderLeft !== 'none' &&
                    settings.useBorderLeft !== 'hidden'
                  : typeof settings?.borderLeft !== 'undefined'
                    ? settings.borderLeft !== false &&
                      settings.borderLeft !== 'none' &&
                      settings.borderLeft !== 'hidden'
                    : true,
            editorFontFamily: cursorSettings.editorFontFamily ?? settings?.fontFamily,
            editorFontSize: cursorSettings.editorFontSize ?? settings?.fontSize,
            previewFontFamily: cursorSettings.previewFontFamily ?? settings?.previewFontFamily,
            previewFontSize: cursorSettings.previewFontSize ?? settings?.previewFontSize
          }

          let caretWidthVal = incoming.caretWidth
          if (caretWidthVal !== undefined && caretWidthVal !== null) {
            if (typeof caretWidthVal === 'string' && caretWidthVal.includes('px')) {
              caretWidthVal = parseInt(caretWidthVal.replace('px', ''), 10)
            } else if (typeof caretWidthVal === 'string') {
              caretWidthVal = parseInt(caretWidthVal, 10)
            }
            if (isNaN(caretWidthVal) || caretWidthVal < 1) {
              caretWidthVal = parseInt(DEFAULTS.CARET_WIDTH.replace('px', ''), 10)
            }
          }

          const normalizedWidth = clampCaretWidth(caretWidthVal || DEFAULTS.CARET_WIDTH)
          const savedCaretStyle = incoming.caretStyle || DEFAULTS.CARET_STYLE
          const savedCaretColor = incoming.caretColor || ''
          const savedThemeAccentColor = incoming.themeAccentColor || ''

          const root = document.documentElement
          root.style.setProperty('--caret-style', savedCaretStyle)
          root.setAttribute('data-caret-style', savedCaretStyle || 'smooth')
          root.style.setProperty('--caret-width', normalizedWidth)

          let finalCaretColor = savedCaretColor
          if (!finalCaretColor || finalCaretColor.trim() === '') {
            const currentTheme = getTheme(settings?.theme || DEFAULTS.THEME)
            finalCaretColor =
              currentTheme.colors['--caret-color'] ||
              currentTheme.colors['--text-accent'] ||
              '#40bafa'
          } else if (!finalCaretColor.startsWith('#')) {
            finalCaretColor = `#${finalCaretColor}`
          }
          root.style.setProperty('--caret-color', finalCaretColor)

          let finalThemeAccentColor = savedThemeAccentColor
          if (finalThemeAccentColor && !finalThemeAccentColor.startsWith('#')) {
            finalThemeAccentColor = `#${finalThemeAccentColor}`
          }
          if (finalThemeAccentColor) {
            root.style.setProperty('--text-accent', finalThemeAccentColor)
          } else {
            const currentTheme = getTheme(settings?.theme || DEFAULTS.THEME)
            root.style.setProperty(
              '--text-accent',
              currentTheme.colors['--text-accent'] || '#40bafa'
            )
          }

          const isMono = (f: string) => f && (f.toLowerCase().includes('mono') || f.toLowerCase().includes('code'))
          if (incoming.editorFontFamily) {
            const efStack = buildFontFamilyStack(incoming.editorFontFamily, isMono(incoming.editorFontFamily))
            root.style.setProperty('--font-editor', efStack)
            root.style.setProperty('--editor-font-family', efStack)
          }
          if (incoming.editorFontSize)
            root.style.setProperty('--editor-font-size', `${incoming.editorFontSize / 16}rem`)
          if (incoming.previewFontFamily) {
            const pfStack = buildFontFamilyStack(incoming.previewFontFamily, false)
            root.style.setProperty('--preview-font-family', pfStack)
          }
          if (incoming.previewFontSize)
            root.style.setProperty('--preview-font-size', `${incoming.previewFontSize / 16}rem`)

          setCaretStyle(savedCaretStyle)
          setCaretWidth(normalizedWidth)
          setCaretColor(savedCaretColor || '')
          setThemeAccentColor(savedThemeAccentColor || '')
          setUseBorderLeft(incoming.useBorderLeft)
          root.setAttribute('data-use-active-line-border', incoming.useBorderLeft ? 'true' : 'false')

          requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent('caret-style-update'))
          })
        } catch (err) {
          console.error('[useFontSettings] Failed to reload cursor settings:', err)
        }
      })
    }

    const handleCaretUpdate = (e: any) => {
      if (e.detail) {
        if (e.detail.caretStyle !== undefined) setCaretStyle(e.detail.caretStyle)
        if (e.detail.caretWidth !== undefined) setCaretWidth(e.detail.caretWidth)
        if (e.detail.caretColor !== undefined) setCaretColor(e.detail.caretColor)
      } else {
        const root = document.documentElement
        const cs = root.style.getPropertyValue('--caret-style')
        const cw = root.style.getPropertyValue('--caret-width')
        const cc = root.style.getPropertyValue('--caret-color')
        if (cs) setCaretStyle(cs.trim())
        if (cw) setCaretWidth(cw.trim())
        if (cc) setCaretColor(cc.trim())
      }
    }
    window.addEventListener('caret-style-update', handleCaretUpdate)

    return () => {
      window.removeEventListener('caret-style-update', handleCaretUpdate)
      if (settingsChangedUnsubscribe) {
        settingsChangedUnsubscribe()
      }
    }
  }, [])

  /**
   * Universal styling side-effect
   */
  useEffect(() => {
    const root = document.documentElement
    const sizeRem = `${editorFontSize / 16}rem`
    const pSizeRem = `${previewFontSize / 16}rem`
    const sizePx = `${editorFontSize}px`
    const pSizePx = `${previewFontSize}px`

    const isMono = (f: string) => f && (f.toLowerCase().includes('mono') || f.toLowerCase().includes('code'))
    const editorFontStack = buildFontFamilyStack(editorFontFamily, isMono(editorFontFamily))
    const previewFontStack = buildFontFamilyStack(previewFontFamily, false)

    root.style.setProperty('--font-editor', editorFontStack)
    root.style.setProperty('--font-size-editor', sizePx)
    root.style.setProperty('--editor-font-family', editorFontStack)
    root.style.setProperty('--editor-font-size', sizeRem)

    root.style.setProperty('--preview-font-family', previewFontStack)
    root.style.setProperty('--preview-font-size', pSizeRem)
    root.style.setProperty('--preview-font-size-px', pSizePx)

    root.style.setProperty('--caret-style', caretStyle)
    root.setAttribute('data-caret-style', caretStyle || 'smooth')
    root.setAttribute('data-use-active-line-border', useBorderLeft ? 'true' : 'false')
    root.style.setProperty(
      '--caret-width',
      typeof caretWidth === 'number' ? `${caretWidth}px` : caretWidth
    )

    let finalCaretColor = caretColor
    if (!finalCaretColor || finalCaretColor.trim() === '') {
      const themeName = root.getAttribute('data-theme') || DEFAULTS.THEME
      const currentTheme = getTheme(themeName)
      finalCaretColor =
        currentTheme.colors['--caret-color'] || currentTheme.colors['--text-accent'] || '#40bafa'
    } else if (!finalCaretColor.startsWith('#')) {
      finalCaretColor = `#${finalCaretColor}`
    }
    root.style.setProperty('--caret-color', finalCaretColor)

    let finalThemeAccentColor = themeAccentColor
    if (finalThemeAccentColor && !finalThemeAccentColor.startsWith('#')) {
      finalThemeAccentColor = `#${finalThemeAccentColor}`
    }
    if (finalThemeAccentColor && finalThemeAccentColor.trim() !== '') {
      root.style.setProperty('--text-accent', finalThemeAccentColor)
      const rgbMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(finalThemeAccentColor)
      if (rgbMatch) {
        root.style.setProperty(
          '--text-accent-rgb',
          `${parseInt(rgbMatch[1], 16)}, ${parseInt(rgbMatch[2], 16)}, ${parseInt(rgbMatch[3], 16)}`
        )
      }
    } else {
      const themeName = root.getAttribute('data-theme') || DEFAULTS.THEME
      const currentTheme = getTheme(themeName)
      root.style.setProperty('--text-accent', currentTheme.colors['--text-accent'] || '#40bafa')
      root.style.setProperty(
        '--text-accent-rgb',
        currentTheme.colors['--text-accent-rgb'] || '64, 186, 250'
      )
    }

    void root.offsetHeight
    window.dispatchEvent(new CustomEvent('caret-style-update'))
  }, [
    editorFontFamily,
    editorFontSize,
    previewFontFamily,
    previewFontSize,
    caretStyle,
    caretWidth,
    caretColor,
    themeAccentColor,
    useBorderLeft
  ])

  const persistTheme = useCallback(
    (next: Record<string, any>) => {
      try {
        const merged = { ...baseColors, ...next }
        setBaseColors(merged)

        if (persistDebounceRef.current) {
          clearTimeout(persistDebounceRef.current)
        }

        persistDebounceRef.current = setTimeout(async () => {
          try {
            let caretWidthValue = merged.caretWidth
            if (typeof caretWidthValue === 'string' && caretWidthValue.includes('px')) {
              caretWidthValue = parseInt(caretWidthValue.replace('px', ''), 10)
            } else if (typeof caretWidthValue === 'string') {
              caretWidthValue = parseInt(caretWidthValue, 10)
            }
            if (isNaN(caretWidthValue) || caretWidthValue < 1) {
              caretWidthValue = parseInt(DEFAULTS.CARET_WIDTH.replace('px', ''), 10)
            }

            const cursorSettings = {
              caretWidth: caretWidthValue,
              caretStyle: merged.caretStyle,
              caretColor: merged.caretColor,
              themeAccentColor: merged.themeAccentColor,
              useBorderLeft: merged.useBorderLeft !== undefined ? merged.useBorderLeft : true,
              editorFontFamily: merged.editorFontFamily,
              editorFontSize: merged.editorFontSize,
              previewFontFamily: merged.previewFontFamily,
              previewFontSize: merged.previewFontSize
            }

            const api = (window as any).api
            await api?.saveSetting?.('cursor', cursorSettings)
            localStorage.setItem('theme-colors', JSON.stringify(merged))
          } catch (err) {
            console.warn('[useFontSettings] Failed to save cursor settings asynchronously:', err)
          }
        }, 300)
      } catch (err) {
        console.warn('[useFontSettings] Failed to merge cursor settings:', err)
      }
    },
    [baseColors]
  )

  const updateEditorFontFamily = useCallback(
    (fontFamily: string) => {
      setEditorFontFamily(fontFamily)
      persistTheme({ editorFontFamily: fontFamily })
    },
    [persistTheme]
  )

  const updateEditorFontSize = useCallback(
    (size: string | number) => {
      const normalized = typeof size === 'number' ? size : parseInt(size, 10)
      setEditorFontSize(normalized)
      persistTheme({ editorFontSize: normalized })
    },
    [persistTheme]
  )

  const updatePreviewFontFamily = useCallback(
    (fontFamily: string) => {
      setPreviewFontFamily(fontFamily)
      persistTheme({ previewFontFamily: fontFamily })
    },
    [persistTheme]
  )

  const updatePreviewFontSize = useCallback(
    (size: string | number) => {
      const normalized = typeof size === 'number' ? size : parseInt(size, 10)
      setPreviewFontSize(normalized)
      persistTheme({ previewFontSize: normalized })
    },
    [persistTheme]
  )

  const updateCaretWidth = useCallback(
    (width: string | number) => {
      const normalized = clampCaretWidth(width)
      setCaretWidth(normalized)
      applyCaretStyles(normalized, caretColor || '')

      let widthNumber: any = width
      if (typeof width === 'string') {
        widthNumber = parseInt(width.replace('px', ''), 10)
      }
      if (isNaN(widthNumber)) {
        widthNumber = parseInt(normalized.replace('px', ''), 10)
      }
      if (isNaN(widthNumber) || widthNumber < 1) {
        widthNumber = 2
      }
      if (caretDebounceRef.current) clearTimeout(caretDebounceRef.current)
      caretDebounceRef.current = setTimeout(() => {
        persistTheme({ caretWidth: widthNumber })
      }, 50)

      window.dispatchEvent(
        new CustomEvent('caret-style-update', { detail: { caretWidth: normalized } })
      )
    },
    [caretColor, persistTheme]
  )

  const updateCaretStyle = useCallback(
    (style: string) => {
      setCaretStyle(style)
      document.documentElement.style.setProperty('--caret-style', style)
      document.documentElement.setAttribute('data-caret-style', style || 'smooth')
      persistTheme({ caretStyle: style })

      window.dispatchEvent(new CustomEvent('caret-style-update', { detail: { caretStyle: style } }))
    },
    [persistTheme]
  )

  const updateCaretColor = useCallback(
    (color: string) => {
      const rawColor = color ? color.trim() : ''
      const root = document.documentElement
      if (rawColor) {
        root.style.setProperty('--caret-color', rawColor)
      } else {
        const themeName = root.getAttribute('data-theme') || DEFAULTS.THEME
        const currentTheme = getTheme(themeName)
        root.style.setProperty(
          '--caret-color',
          currentTheme.colors['--caret-color'] || currentTheme.colors['--text-accent'] || '#40bafa'
        )
      }

      if (caretDebounceRef.current) clearTimeout(caretDebounceRef.current)
      caretDebounceRef.current = setTimeout(() => {
        setCaretColor(rawColor)
        persistTheme({ caretColor: rawColor })
      }, 50)

      window.dispatchEvent(
        new CustomEvent('caret-style-update', { detail: { caretColor: rawColor } })
      )
    },
    [persistTheme]
  )

  const updateThemeAccentColor = useCallback(
    (color: string) => {
      const rawColor = color ? color.trim() : ''
      const root = document.documentElement
      if (rawColor) {
        root.style.setProperty('--text-accent', rawColor)
        const rgbMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(rawColor)
        if (rgbMatch) {
          root.style.setProperty(
            '--text-accent-rgb',
            `${parseInt(rgbMatch[1], 16)}, ${parseInt(rgbMatch[2], 16)}, ${parseInt(rgbMatch[3], 16)}`
          )
        }
      } else {
        const themeName = root.getAttribute('data-theme') || DEFAULTS.THEME
        const currentTheme = getTheme(themeName)
        root.style.setProperty('--text-accent', currentTheme.colors['--text-accent'] || '#40bafa')
        root.style.setProperty(
          '--text-accent-rgb',
          currentTheme.colors['--text-accent-rgb'] || '64, 186, 250'
        )
      }

      if (accentDebounceRef.current) clearTimeout(accentDebounceRef.current)
      accentDebounceRef.current = setTimeout(() => {
        setThemeAccentColor(rawColor)
        persistTheme({ themeAccentColor: rawColor })
      }, 50)
    },
    [persistTheme]
  )

  const updateUseBorderLeft = useCallback(
    (enabled: boolean) => {
      const isEnabled = Boolean(enabled)
      setUseBorderLeft(isEnabled)
      document.documentElement.setAttribute('data-use-active-line-border', isEnabled ? 'true' : 'false')
      persistTheme({ useBorderLeft: isEnabled })
      window.dispatchEvent(
        new CustomEvent('caret-style-update', { detail: { useBorderLeft: isEnabled } })
      )
    },
    [persistTheme]
  )

  return {
    editorFontFamily,
    editorFontSize,
    previewFontFamily,
    previewFontSize,
    caretStyle,
    caretWidth,
    caretColor,
    themeAccentColor,
    useBorderLeft,
    updateEditorFontFamily,
    updateEditorFontSize,
    updatePreviewFontFamily,
    updatePreviewFontSize,
    updateCaretWidth,
    updateCaretStyle,
    updateCaretColor,
    updateThemeAccentColor,
    updateUseBorderLeft
  }
}

export default useFontSettings
