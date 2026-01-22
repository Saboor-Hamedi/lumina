import { useEffect, useState, useCallback } from 'react'
import { getTheme } from '../themes/themeDefinitions'

/**
 * Default configuration constants for font and caret settings
 * @constant {Object} DEFAULTS
 * @property {string} FONT_FAMILY - Default font family for editor
 * @property {number} FONT_SIZE - Default font size in pixels
 * @property {string} CARET_WIDTH - Default caret width
 * @property {number} CARET_WIDTH_MIN - Minimum allowed caret width (px)
 * @property {number} CARET_WIDTH_MAX - Maximum allowed caret width (px)
 * @property {string} CARET_STYLE - Default caret style ('bar', 'block', 'line')
 * @property {string} THEME - Default theme identifier
 */
const DEFAULTS = {
  FONT_FAMILY: 'JetBrains Mono',
  FONT_SIZE: 14,
  CARET_WIDTH: '2px',
  CARET_WIDTH_MIN: 1,
  CARET_WIDTH_MAX: 10,
  CARET_STYLE: 'smooth',
  THEME: 'dark'
}

/**
 * Normalize pixel value to ensure it has 'px' suffix
 * @param {string|number} value - The value to normalize
 * @returns {string} Normalized pixel value
 */
const normalizePixelValue = (value) => {
  if (typeof value === 'number') return `${value}px`
  if (typeof value === 'string' && value.endsWith('px')) return value
  return `${value}px`
}

/**
 * Clamps caret width to valid range (1-10px) and normalizes the output
 * Ensures the caret width stays within acceptable bounds for visibility and aesthetics
 *
 * @param {string|number} width - The width value to clamp (e.g., 0, 5, "15px", "3")
 * @returns {string} Clamped and normalized pixel value (e.g., "1px", "5px", "10px")
 * @example
 * clampCaretWidth(0) // returns "1px" (clamped to minimum)
 * clampCaretWidth(15) // returns "10px" (clamped to maximum)
 * clampCaretWidth(5) // returns "5px" (within range)
 */
const clampCaretWidth = (width) => {
  // Handle both "3px" and 3 formats
  let num
  if (typeof width === 'string') {
    // Remove "px" if present
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
 * Sets both width and color, with fallback to theme accent color if no custom color provided
 * Uses optimized synchronous updates for instant visual feedback with smooth transitions
 *
 * @param {string} width - Caret width in pixels (e.g., "2px", "5px")
 * @param {string} color - Caret color hex value (e.g., "#40bafa") or empty string for theme accent
 * @example
 * applyCaretStyles("2px", "#ff0000") // Sets red caret with 2px width
 * applyCaretStyles("3px", "") // Sets theme accent color with 3px width
 */
const applyCaretStyles = (width, color) => {
  const root = document.documentElement

  // Get theme accent color if no custom color provided
  let finalColor = color
  if (!finalColor || finalColor.trim() === '') {
    // Get current theme's caret color or accent color
    const currentThemeId = root.getAttribute('data-theme') || 'dark'
    const currentTheme = getTheme(currentThemeId)
    finalColor =
      currentTheme.colors['--caret-color'] ||
      currentTheme.colors['--text-accent'] ||
      '#40bafa'
  }

  // Apply CSS variables synchronously for immediate visual feedback
  // CSS transitions will handle smooth animation automatically
  root.style.setProperty('--caret-width', width)
  root.style.setProperty('--caret-color', finalColor)

  // Force immediate style application by accessing computed style
  void root.offsetHeight

  // Verify the values were actually set
  const verifyWidth = getComputedStyle(root).getPropertyValue('--caret-width').trim()
  const verifyColor = getComputedStyle(root).getPropertyValue('--caret-color').trim()

  // Debug: Log the applied values
  // Applied caret styles (no runtime logging)

  // If CSS variables weren't set correctly, try again
  if (!verifyWidth || verifyWidth === '' || (!verifyWidth.includes('px') && !width.includes('px'))) {
    console.warn('[useFontSettings] CSS variable not set correctly, retrying...')
    root.style.setProperty('--caret-width', width)
    void root.offsetHeight
  }
}

/**
 * useFontSettings Hook
 *
 * Comprehensive hook for managing font and caret settings with persistence.
 * Handles loading, updating, and saving of editor font family/size, preview font family/size,
 * and caret configuration (width, style, color).
 *
 * @returns {Object} Settings object with state and update functions
 * @returns {string} returns.editorFontFamily - Current editor font family
 * @returns {number} returns.editorFontSize - Current editor font size
 * @returns {string} returns.previewFontFamily - Current preview font family
 * @returns {number} returns.previewFontSize - Current preview font size
 * @returns {string} returns.caretStyle - Current caret style ('bar', 'block', 'line')
 * @returns {string} returns.caretWidth - Current caret width (e.g., "2px")
 * @returns {string} returns.caretColor - Current caret color (empty string = theme accent)
 * @returns {Function} returns.updateEditorFontFamily - Update editor font family
 * @returns {Function} returns.updateEditorFontSize - Update editor font size
 * @returns {Function} returns.updatePreviewFontFamily - Update preview font family
 * @returns {Function} returns.updatePreviewFontSize - Update preview font size
 * @returns {Function} returns.updateCaretWidth - Update caret width (1-10px)
 * @returns {Function} returns.updateCaretStyle - Update caret style
 * @returns {Function} returns.updateCaretColor - Update caret color
 *
 * @example
 * const {
 *   caretWidth,
 *   caretColor,
 *   updateCaretWidth,
 *   updateCaretColor
 * } = useFontSettings()
 *
 * // Update caret width
 * updateCaretWidth(3) // Sets to "3px"
 *
 * // Update caret color
 * updateCaretColor("#ff0000") // Sets to red
 * updateCaretColor("") // Resets to theme accent
 */
export const useFontSettings = () => {
  const [editorFontFamily, setEditorFontFamily] = useState(DEFAULTS.FONT_FAMILY)
  const [editorFontSize, setEditorFontSize] = useState(DEFAULTS.FONT_SIZE)
  const [previewFontFamily, setPreviewFontFamily] = useState(DEFAULTS.FONT_FAMILY)
  const [previewFontSize, setPreviewFontSize] = useState(DEFAULTS.FONT_SIZE)
  const [baseThemeName, setBaseThemeName] = useState(DEFAULTS.THEME)
  const [baseColors, setBaseColors] = useState({})
  const [caretStyle, setCaretStyle] = useState(DEFAULTS.CARET_STYLE)
  const [caretWidth, setCaretWidth] = useState(DEFAULTS.CARET_WIDTH)
  const [caretColor, setCaretColor] = useState('')
  const [useBorderLeft, setUseBorderLeft] = useState(true)

  // Load settings on mount
  useEffect(() => {
    ;(async () => {
      try {
        // Load from localStorage first (primary source for custom colors)
        let colors = {}
        let themeName = DEFAULTS.THEME

        try {
          const savedColors = localStorage.getItem('theme-colors')
          if (savedColors) {
            colors = JSON.parse(savedColors)
          }
        } catch (e) {
          console.warn('Failed to load theme colors from localStorage:', e)
        }

        // Load settings from backend. Prefer cursor object, but also accept promoted top-level keys
        try {
          const allSettings = await window.api?.getSetting?.()
          const cursorSettings = (allSettings && allSettings.cursor) || (await window.api?.getSetting?.('cursor')) || {}
          // Raw cursor settings loaded from API (silent)

          if ((cursorSettings && typeof cursorSettings === 'object' && Object.keys(cursorSettings).length > 0) || (allSettings && typeof allSettings === 'object')) {
            // cursor object exists: { caretWidth, caretStyle, caretColor, ... }
            // Handle caretWidth: convert "3px" to number 3, or keep number as-is
            let caretWidth = cursorSettings.caretWidth
            if (caretWidth !== undefined && caretWidth !== null) {
              if (typeof caretWidth === 'string' && caretWidth.includes('px')) {
                caretWidth = parseInt(caretWidth.replace('px', ''), 10)
              } else if (typeof caretWidth === 'string') {
                caretWidth = parseInt(caretWidth, 10)
              }
              // Ensure it's a valid number
              if (isNaN(caretWidth) || caretWidth < 1) {
                caretWidth = parseInt(DEFAULTS.CARET_WIDTH.replace('px', ''), 10)
              }
            }

            // Build cursorColors by preferring explicit cursor object, then promoted top-level keys, then localStorage/defaults
            const cursorColors = {
              caretWidth: caretWidth !== undefined ? caretWidth : (allSettings?.caretWidth ?? allSettings?.width ?? allSettings?.['caret width'] ?? colors.caretWidth),
              caretStyle: (cursorSettings && cursorSettings.caretStyle) || allSettings?.cursorStyle || allSettings?.caretStyle || colors.caretStyle || DEFAULTS.CARET_STYLE,
              caretColor: (cursorSettings && typeof cursorSettings.caretColor !== 'undefined') ? cursorSettings.caretColor : (allSettings?.caretColor ?? allSettings?.color ?? colors.caretColor),
              useBorderLeft: (typeof cursorSettings.useBorderLeft !== 'undefined') ? (cursorSettings.useBorderLeft !== false && cursorSettings.useBorderLeft !== 'none' && cursorSettings.useBorderLeft !== 'hidden') : 
                (typeof allSettings?.useBorderLeft !== 'undefined' ? (allSettings.useBorderLeft !== false && allSettings.useBorderLeft !== 'none' && allSettings.useBorderLeft !== 'hidden') : 
                (typeof allSettings?.borderLeft !== 'undefined' ? (allSettings.borderLeft !== false && allSettings.borderLeft !== 'none' && allSettings.borderLeft !== 'hidden') : true)),
              editorFontFamily: (cursorSettings && cursorSettings.editorFontFamily) || (allSettings && allSettings.fontFamily) || colors.editorFontFamily,
              editorFontSize: (cursorSettings && cursorSettings.editorFontSize) || (allSettings && allSettings.fontSize) || colors.editorFontSize,
              previewFontFamily: (cursorSettings && cursorSettings.previewFontFamily) || (allSettings && allSettings.previewFontFamily) || colors.previewFontFamily,
              previewFontSize: (cursorSettings && cursorSettings.previewFontSize) || (allSettings && allSettings.previewFontSize) || colors.previewFontSize
            }
            // Cursor settings from settings.json take precedence
            colors = { ...colors, ...cursorColors }
            // Loaded and merged cursor settings from settings.json (silent)
          } else {
            // No cursor object found in settings.json; using localStorage/defaults
          }
        } catch (e) {
          console.warn('[useFontSettings] Failed to load cursor from settings.json:', e)
          // Falling back to localStorage/defaults
        }

        // Also try to load from theme.colors (for backward compatibility)
        try {
          const themeValue = await window.api?.getTheme?.()
          if (themeValue) {
            if (typeof themeValue === 'string') {
              // Legacy: just theme name string
              themeName = themeValue
            } else if (typeof themeValue === 'object' && themeValue.colors) {
              // Legacy: theme object with colors JSON string (backward compatibility)
              try {
                const dbColors = JSON.parse(themeValue.colors)
                // Only use if cursor settings weren't found
                if (!colors.caretWidth && !colors.caretStyle && !colors.caretColor) {
                  colors = { ...dbColors, ...colors }
                  // loaded legacy theme colors (silently applied)
                }
              } catch (parseErr) {
                console.warn('[useFontSettings] Failed to parse theme colors:', parseErr)
              }
              // Get theme name (handle the "[object Object]" issue)
              if (themeValue.name && typeof themeValue.name === 'string' && !themeValue.name.includes('object')) {
                themeName = themeValue.name
              }
            }
          }
        } catch (e) {
          console.warn('[useFontSettings] Failed to load theme from settings.json:', e)
        }

        // final colors loaded (applied silently)

        // Fallback to document attribute
        if (!themeName || themeName === DEFAULTS.THEME) {
          themeName = document.documentElement.getAttribute('data-theme') || DEFAULTS.THEME
        }

        setBaseThemeName(themeName)
        setBaseColors(colors)

        // Load font settings
        const ef = colors.editorFontFamily || (allSettings && allSettings.fontFamily) || DEFAULTS.FONT_FAMILY
        const es = parseFloat(
          colors.editorFontSize != null ? colors.editorFontSize : (allSettings && allSettings.fontSize != null ? allSettings.fontSize : String(DEFAULTS.FONT_SIZE))
        )
        const pf = colors.previewFontFamily || (allSettings && allSettings.previewFontFamily) || ef
        const ps = parseFloat(
          colors.previewFontSize != null ? colors.previewFontSize : (allSettings && allSettings.previewFontSize != null ? allSettings.previewFontSize : String(es))
        )

        setEditorFontFamily(ef)
        setEditorFontSize(isNaN(es) ? DEFAULTS.FONT_SIZE : es)
        setPreviewFontFamily(pf)
        setPreviewFontSize(isNaN(ps) ? DEFAULTS.FONT_SIZE : ps)

        // Load and apply caret settings
        const root = document.documentElement
        // Map 'bar' style to 'smooth' for backward compatibility
        let savedCaretStyle = colors.caretStyle || DEFAULTS.CARET_STYLE
        if (savedCaretStyle === 'bar') savedCaretStyle = 'smooth'
        if (savedCaretStyle === 'line') savedCaretStyle = 'sharp'

        // Handle caretWidth: can be number (3) or string ("3px")
        let savedCaretWidth = colors.caretWidth
        if (savedCaretWidth === undefined || savedCaretWidth === null) {
          savedCaretWidth = DEFAULTS.CARET_WIDTH
        }
        // Convert to number if it's a string with "px"
        if (typeof savedCaretWidth === 'string' && savedCaretWidth.includes('px')) {
          savedCaretWidth = parseInt(savedCaretWidth.replace('px', ''), 10)
        } else if (typeof savedCaretWidth === 'string') {
          savedCaretWidth = parseInt(savedCaretWidth, 10)
        }
        // Ensure it's a valid number before clamping
        if (isNaN(savedCaretWidth) || savedCaretWidth < 1) {
          savedCaretWidth = parseInt(DEFAULTS.CARET_WIDTH.replace('px', ''), 10)
        }
        const normalizedWidth = clampCaretWidth(savedCaretWidth)

        // Caret width processing (silent)
        const savedCaretColor = colors.caretColor || ''

        // Applying caret settings (silent)

        // Apply caret styles immediately on load (synchronous for instant display)
        root.style.setProperty('--caret-style', savedCaretStyle)
        root.style.setProperty('--caret-width', normalizedWidth)

        // Use custom color if set, otherwise use theme's default caret color
        let finalCaretColor = savedCaretColor
        if (!finalCaretColor || finalCaretColor.trim() === '') {
          // Use theme's default caret color
          const currentTheme = getTheme(themeName)
          finalCaretColor = currentTheme.colors['--caret-color'] || currentTheme.colors['--text-accent'] || '#40bafa'
        }
        root.style.setProperty('--caret-color', finalCaretColor)

        // CSS variables applied (silent)

        // Force immediate application
        void root.offsetHeight

        // Apply current line background if present
        if (colors.currentLineBg) {
          root.style.setProperty('--current-line-bg', colors.currentLineBg)
        }

        // Update state (save empty string if using theme default, otherwise save the custom color)
        setCaretStyle(savedCaretStyle)
        setCaretWidth(normalizedWidth)
        // Only save custom color to state if it's different from theme default
        const themeDefaultColor = getTheme(themeName).colors['--caret-color'] || getTheme(themeName).colors['--text-accent']
        const stateCaretColor = (savedCaretColor && savedCaretColor.trim() !== '' && savedCaretColor !== themeDefaultColor) ? savedCaretColor : ''
        setCaretColor(stateCaretColor)

        // Always ensure caret styles are persisted to localStorage
        // This ensures they're available on next load and fixes the issue
        const updatedColors = {
          ...colors,
          editorFontFamily: ef,
          editorFontSize: isNaN(es) ? DEFAULTS.FONT_SIZE : es,
          previewFontFamily: pf,
          previewFontSize: isNaN(ps) ? DEFAULTS.FONT_SIZE : ps,
          // Store caretWidth as number in localStorage (will be converted to number when saving to cursor)
          caretWidth: typeof normalizedWidth === 'string' ? parseInt(normalizedWidth.replace('px', ''), 10) : normalizedWidth,
          caretStyle: savedCaretStyle,
          caretColor: stateCaretColor,
          useBorderLeft: colors.useBorderLeft !== undefined ? colors.useBorderLeft : true
        }
        localStorage.setItem('theme-colors', JSON.stringify(updatedColors))
        setBaseColors(updatedColors)

        // Also ensure settings are saved to settings.json (cursor object) if they came from localStorage
        // This ensures settings.json stays in sync
        try {
          const cursorSettings = await window.api?.getSetting?.('cursor')
          // If cursor object doesn't exist or is empty, save current settings to it
          if (!cursorSettings || typeof cursorSettings !== 'object' || Object.keys(cursorSettings).length === 0) {
            const widthNumber = typeof normalizedWidth === 'string' ? parseInt(normalizedWidth.replace('px', ''), 10) : normalizedWidth
            await window.api?.saveSetting?.('cursor', {
              caretWidth: widthNumber,
              caretStyle: savedCaretStyle,
              caretColor: stateCaretColor,
              editorFontFamily: ef,
              editorFontSize: isNaN(es) ? DEFAULTS.FONT_SIZE : es,
              previewFontFamily: pf,
              previewFontSize: isNaN(ps) ? DEFAULTS.FONT_SIZE : ps
            })
            // Saved cursor settings to settings.json on initial load (silent)
          }
        } catch (e) {
          console.warn('[useFontSettings] Failed to sync cursor settings to settings.json:', e)
        }

        // Also dispatch event to notify CodeMirror immediately (after a short delay to ensure CSS is applied)
        requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent('caret-style-update'))
        })
      } catch (err) {
        console.warn('Failed to load theme settings:', err)
      }
    })()

    // Listen for external changes to settings.json
    let settingsChangedUnsubscribe = null
    if (window.api?.onSettingsChanged) {
      settingsChangedUnsubscribe = window.api.onSettingsChanged(async (settings) => {
        // settings.json changed externally, reloading cursor/preview settings (silent)
        try {
          const cursorSettings = settings?.cursor || {}

          // Prefer cursor object but accept promoted top-level keys
          const incoming = {
            caretWidth: cursorSettings.caretWidth ?? settings?.caretWidth ?? settings?.width ?? settings?.['caret width'],
            caretStyle: cursorSettings.caretStyle ?? settings?.cursorStyle ?? settings?.caretStyle,
            caretColor: (typeof cursorSettings.caretColor !== 'undefined') ? cursorSettings.caretColor : (settings?.caretColor ?? settings?.color),
            useBorderLeft: (typeof cursorSettings.useBorderLeft !== 'undefined') ? (cursorSettings.useBorderLeft !== false && cursorSettings.useBorderLeft !== 'none' && cursorSettings.useBorderLeft !== 'hidden') : 
              (typeof settings?.useBorderLeft !== 'undefined' ? (settings.useBorderLeft !== false && settings.useBorderLeft !== 'none' && settings.useBorderLeft !== 'hidden') : 
              (typeof settings?.borderLeft !== 'undefined' ? (settings.borderLeft !== false && settings.borderLeft !== 'none' && settings.borderLeft !== 'hidden') : true)),
            editorFontFamily: cursorSettings.editorFontFamily ?? settings?.fontFamily,
            editorFontSize: cursorSettings.editorFontSize ?? settings?.fontSize,
            previewFontFamily: cursorSettings.previewFontFamily ?? settings?.previewFontFamily,
            previewFontSize: cursorSettings.previewFontSize ?? settings?.previewFontSize
          }

          // Process caretWidth
          let caretWidth = incoming.caretWidth
          if (caretWidth !== undefined && caretWidth !== null) {
            if (typeof caretWidth === 'string' && caretWidth.includes('px')) {
              caretWidth = parseInt(caretWidth.replace('px', ''), 10)
            } else if (typeof caretWidth === 'string') {
              caretWidth = parseInt(caretWidth, 10)
            }
            if (isNaN(caretWidth) || caretWidth < 1) {
              caretWidth = parseInt(DEFAULTS.CARET_WIDTH.replace('px', ''), 10)
            }
          }

          const normalizedWidth = clampCaretWidth(caretWidth || DEFAULTS.CARET_WIDTH)
          const savedCaretStyle = incoming.caretStyle || DEFAULTS.CARET_STYLE
          const savedCaretColor = incoming.caretColor || ''

          // Apply caret immediately
          const root = document.documentElement
          root.style.setProperty('--caret-style', savedCaretStyle)
          root.style.setProperty('--caret-width', normalizedWidth)

          let finalCaretColor = savedCaretColor
          if (!finalCaretColor || finalCaretColor.trim() === '') {
            const currentTheme = getTheme(settings?.theme || DEFAULTS.THEME)
            finalCaretColor = currentTheme.colors['--caret-color'] || currentTheme.colors['--text-accent'] || '#40bafa'
          }
          root.style.setProperty('--caret-color', finalCaretColor)

          // Apply font/preview sizes if provided
          if (incoming.editorFontFamily) root.style.setProperty('--editor-font-family', incoming.editorFontFamily)
          if (incoming.editorFontSize) root.style.setProperty('--editor-font-size', `${incoming.editorFontSize / 16}rem`)
          if (incoming.previewFontFamily) root.style.setProperty('--preview-font-family', incoming.previewFontFamily)
          if (incoming.previewFontSize) root.style.setProperty('--preview-font-size', `${incoming.previewFontSize / 16}rem`)

          // Update state
          setCaretStyle(savedCaretStyle)
          setCaretWidth(normalizedWidth)
          setCaretColor(savedCaretColor || '')
          setUseBorderLeft(incoming.useBorderLeft)

          // Dispatch event to update CodeMirror
          requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent('caret-style-update'))
          })
        } catch (err) {
          console.error('[useFontSettings] Failed to reload cursor settings:', err)
        }
      })
    }

    return () => {
      if (settingsChangedUnsubscribe) {
        settingsChangedUnsubscribe()
      }
    }
  }, [])

  /**
   * Universal styling side-effect
   * Synchronizes all font and caret settings to CSS variables on the document root
   * This ensures consistent styling across all components (Editor, Preview, etc.)
   */
  useEffect(() => {
    const root = document.documentElement
    const sizeRem = `${editorFontSize / 16}rem`
    const pSizeRem = `${previewFontSize / 16}rem`
    const sizePx = `${editorFontSize}px`
    const pSizePx = `${previewFontSize}px`

    // Editor Font Variables
    root.style.setProperty('--font-editor', editorFontFamily)
    root.style.setProperty('--font-size-editor', sizePx)
    root.style.setProperty('--editor-font-family', editorFontFamily)
    root.style.setProperty('--editor-font-size', sizeRem)

    // Preview Font Variables
    root.style.setProperty('--preview-font-family', previewFontFamily)
    root.style.setProperty('--preview-font-size', pSizeRem)
    root.style.setProperty('--preview-font-size-px', pSizePx)

    // Caret Variables
    root.style.setProperty('--caret-style', caretStyle)
    root.style.setProperty('--caret-width', typeof caretWidth === 'number' ? `${caretWidth}px` : caretWidth)
    
    // Caret Color (with theme fallback)
    let finalCaretColor = caretColor
    if (!finalCaretColor || finalCaretColor.trim() === '') {
      const themeName = root.getAttribute('data-theme') || DEFAULTS.THEME
      const currentTheme = getTheme(themeName)
      finalCaretColor = currentTheme.colors['--caret-color'] || currentTheme.colors['--text-accent'] || '#40bafa'
    }
    root.style.setProperty('--caret-color', finalCaretColor)
    
    // Force a repaint for stability
    void root.offsetHeight
    
    // Dispatch event for CodeMirror
    window.dispatchEvent(new CustomEvent('caret-style-update'))
  }, [
    editorFontFamily, 
    editorFontSize, 
    previewFontFamily, 
    previewFontSize, 
    caretStyle, 
    caretWidth, 
    caretColor
  ])

  // Persist cursor settings to settings.json (cursor object) and localStorage
  const persistTheme = useCallback(
    async (next) => {
      try {
        const merged = { ...baseColors, ...next }

        // Save to cursor object in settings.json (new location)
        // Store caretWidth as number (not "3px")
        let caretWidthValue = merged.caretWidth
        if (typeof caretWidthValue === 'string' && caretWidthValue.includes('px')) {
          caretWidthValue = parseInt(caretWidthValue.replace('px', ''), 10)
        } else if (typeof caretWidthValue === 'string') {
          caretWidthValue = parseInt(caretWidthValue, 10)
        }
        // Ensure it's a valid number
        if (isNaN(caretWidthValue) || caretWidthValue < 1) {
          caretWidthValue = parseInt(DEFAULTS.CARET_WIDTH.replace('px', ''), 10)
        }

        const cursorSettings = {
          caretWidth: caretWidthValue, // Store as number (e.g., 3 not "3px")
          caretStyle: merged.caretStyle,
          caretColor: merged.caretColor,
          useBorderLeft: merged.useBorderLeft !== undefined ? merged.useBorderLeft : true,
          editorFontFamily: merged.editorFontFamily,
          editorFontSize: merged.editorFontSize,
          previewFontFamily: merged.previewFontFamily,
          previewFontSize: merged.previewFontSize
        }

        // Save cursor object to settings.json
        await window.api?.saveSetting?.('cursor', cursorSettings)

        // Also save to localStorage for quick access
        localStorage.setItem('theme-colors', JSON.stringify(merged))

        setBaseColors(merged)

        // Saved cursor settings to settings.json (silent)
      } catch (err) {
        console.warn('[useFontSettings] Failed to save cursor settings:', err)
      }
    },
    [baseColors]
  )

  /**
   * Font Update Functions
   * Each function updates state and persists changes to storage
   */

  /**
   * Updates the editor font family
   * @param {string} fontFamily - Font family name (e.g., "JetBrains Mono", "Inter")
   */
  const updateEditorFontFamily = useCallback(
    (fontFamily) => {
      setEditorFontFamily(fontFamily)
      persistTheme({ editorFontFamily: fontFamily })
    },
    [persistTheme]
  )

  /**
   * Updates the editor font size
   * @param {string|number} size - Font size in pixels (e.g., 14, "16")
   */
  const updateEditorFontSize = useCallback(
    (size) => {
      const normalized = typeof size === 'number' ? size : parseInt(size, 10)
      setEditorFontSize(normalized)
      persistTheme({ editorFontSize: normalized })
    },
    [persistTheme]
  )

  /**
   * Updates the preview font family
   * @param {string} fontFamily - Font family name for preview rendering
   */
  const updatePreviewFontFamily = useCallback(
    (fontFamily) => {
      setPreviewFontFamily(fontFamily)
      persistTheme({ previewFontFamily: fontFamily })
    },
    [persistTheme]
  )

  /**
   * Updates the preview font size
   * @param {string|number} size - Font size in pixels for preview
   */
  const updatePreviewFontSize = useCallback(
    (size) => {
      const normalized = typeof size === 'number' ? size : parseInt(size, 10)
      setPreviewFontSize(normalized)
      persistTheme({ previewFontSize: normalized })
    },
    [persistTheme]
  )

  /**
   * Caret Update Functions
   * Functions for customizing caret appearance with validation and persistence
   */

  /**
   * Updates the caret width with automatic validation and clamping
   * Width is automatically clamped to 1-10px range and normalized to pixel format
   * Updates are applied immediately for smooth visual feedback
   *
   * @param {string|number} width - Caret width value (1-10px range)
   * @example
   * updateCaretWidth(3) // Sets to "3px"
   * updateCaretWidth("5px") // Sets to "5px"
   * updateCaretWidth(15) // Clamped to "10px"
   */
  const updateCaretWidth = useCallback(
    (width) => {
      const normalized = clampCaretWidth(width)
      // updateCaretWidth called (silent)

      // Update state immediately for UI feedback
      setCaretWidth(normalized)

      // Apply styles immediately with current color (empty string = use theme)
      applyCaretStyles(normalized, caretColor || '')

      // Verify CSS variables were set
      const root = document.documentElement
      const verifyWidth = getComputedStyle(root).getPropertyValue('--caret-width').trim()
      // CSS variable verification (silent)

      // Persist to storage (non-blocking) - store as number (not "3px", just 3)
      let widthNumber = width
      if (typeof width === 'string') {
        widthNumber = parseInt(width.replace('px', ''), 10)
      }
      if (isNaN(widthNumber)) {
        widthNumber = parseInt(normalized.replace('px', ''), 10)
      }
      // Ensure it's a valid number
      if (isNaN(widthNumber) || widthNumber < 1) {
        widthNumber = 2 // default
      }
      persistTheme({ caretWidth: widthNumber })

      // Force CodeMirror to update by dispatching a custom event
      // This ensures the cursor element picks up the new CSS variables
      // Use a small delay to ensure CSS variables are set first
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('caret-style-update'))
      }, 10)
    },
    [caretColor, persistTheme]
  )

  /**
   * Updates the caret style (visual appearance)
   * Applies the style CSS variable immediately and persists the setting
   *
   * @param {string} style - Caret style identifier
   * @param {string} style.bar - Smooth line cursor (default)
   * @param {string} style.block - Block cursor with blink animation
   * @param {string} style.line - Sharp line cursor
   * @example
   * updateCaretStyle('block') // Changes to block cursor
   */
  const updateCaretStyle = useCallback(
    (style) => {
      setCaretStyle(style)
      document.documentElement.style.setProperty('--caret-style', style)
      persistTheme({ caretStyle: style })

      // Force CodeMirror to update by dispatching a custom event
      window.dispatchEvent(new CustomEvent('caret-style-update'))
    },
    [persistTheme]
  )

  /**
   * Updates the caret color with theme-aware fallback
   * If empty string is provided, falls back to theme accent color
   *
   * @param {string} color - Hex color value (e.g., "#40bafa") or empty string for theme accent
   * @example
   * updateCaretColor("#ff0000") // Sets to red
   * updateCaretColor("") // Resets to theme accent color
   */
  const updateCaretColor = useCallback(
    (color) => {
      // Normalize color: ensure it has # if provided, or empty string
      let normalizedColor = color
      if (normalizedColor && normalizedColor.trim() !== '') {
        // Remove any existing # and add it back
        normalizedColor = normalizedColor.replace(/^#/, '')
        // Validate hex (3 or 6 chars)
        if (/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(normalizedColor)) {
          normalizedColor = `#${normalizedColor}`
        } else {
          // Invalid, use empty to fall back to theme
          normalizedColor = ''
        }
      } else {
        normalizedColor = ''
      }

      setCaretColor(normalizedColor)
      // Apply styles immediately with current width
      applyCaretStyles(caretWidth, normalizedColor)
      // Persist to storage (non-blocking)
      persistTheme({ caretColor: normalizedColor })

      // Force CodeMirror to update by dispatching a custom event
      window.dispatchEvent(new CustomEvent('caret-style-update'))
    },
    [caretWidth, persistTheme]
  )

  /**
   * Return hook interface with state and update functions
   * All settings are reactive and automatically persist to storage
   */
  return {
    // State values
    editorFontFamily,
    editorFontSize,
    previewFontFamily,
    previewFontSize,
    caretStyle,
    caretWidth,
    caretColor,
    useBorderLeft,
    // Update functions
    updateEditorFontFamily,
    updateEditorFontSize,
    updatePreviewFontFamily,
    updatePreviewFontSize,
    updateCaretWidth,
    updateCaretStyle,
    updateCaretColor
  }
}

export default useFontSettings
