/**
 * Lumina Screen Loader Controller
 * Manages the Obsidian-style application boot loader, progress bar, and transitions.
 */

export interface ScreenLoaderOptions {
  minDuration?: number
  fadeDuration?: number
  status?: string
  subStatus?: string
  progress?: number
  onHidden?: () => void
}

let loaderElement: HTMLElement | null = null
let barFillElement: HTMLElement | null = null
let statusElement: HTMLElement | null = null
let percentElement: HTMLElement | null = null
let subStatusElement: HTMLElement | null = null
let isVisible = true
let currentProgress = 0
let currentStatus = 'Loading your notes...'
let startTime = Date.now()

/**
 * Cancels any early bootstrap inline simulation running in index.html
 */
const stopGlobalInlineTimer = (): void => {
  if (typeof window !== 'undefined') {
    const globalObj = window as unknown as {
      __LUMINA_SCREEN_LOADER__?: { stopSimulation?: () => void }
    }
    if (globalObj?.__LUMINA_SCREEN_LOADER__?.stopSimulation) {
      globalObj.__LUMINA_SCREEN_LOADER__.stopSimulation()
    }
  }
}

/**
 * Returns or creates the SVG emblem markup for the screen loader
 */
export const getEmblemSvgMarkup = (): string => `
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 4L42 16V32L24 44L6 32V16L24 4Z" stroke="url(#loader-emblem-grad)" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M24 4V44M6 16L42 32M6 32L42 16" stroke="url(#loader-emblem-inner)" stroke-width="1.2" stroke-opacity="0.45"/>
    <circle cx="24" cy="24" r="4.5" fill="url(#loader-core-grad)"/>
    <defs>
      <linearGradient id="loader-emblem-grad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
        <stop stop-color="#a855f7"/>
        <stop offset="1" stop-color="#6366f1"/>
      </linearGradient>
      <linearGradient id="loader-emblem-inner" x1="6" y1="16" x2="42" y2="32" gradientUnits="userSpaceOnUse">
        <stop stop-color="#c084fc"/>
        <stop offset="1" stop-color="#818cf8"/>
      </linearGradient>
      <linearGradient id="loader-core-grad" x1="20" y1="20" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop stop-color="#ffffff"/>
        <stop offset="1" stop-color="#c084fc"/>
      </linearGradient>
    </defs>
  </svg>
`

/**
 * Ensures references to DOM elements are cached and valid
 */
const ensureElements = (): boolean => {
  if (typeof document === 'undefined') return false

  if (loaderElement && (!loaderElement.isConnected || !document.body.contains(loaderElement))) {
    loaderElement = null
    barFillElement = null
    statusElement = null
    percentElement = null
    subStatusElement = null
  }

  if (!loaderElement) {
    loaderElement = document.getElementById('screen-loader')
  }

  if (loaderElement) {
    barFillElement = document.getElementById('screen-loader-bar-fill')
    statusElement = document.getElementById('screen-loader-status')
    percentElement = document.getElementById('screen-loader-percent')
    subStatusElement = document.getElementById('screen-loader-substatus')

    // Read and preserve existing progress from DOM if higher
    if (percentElement && percentElement.textContent) {
      const parsed = parseInt(percentElement.textContent, 10)
      if (!isNaN(parsed) && parsed > currentProgress) {
        currentProgress = parsed
      }
    }
    return true
  }

  return false
}

let simTicker: ReturnType<typeof setInterval> | null = null
let simTimeouts: ReturnType<typeof setTimeout>[] = []

export const stopLoaderSimulation = (): void => {
  stopGlobalInlineTimer()
  if (simTicker) {
    clearInterval(simTicker)
    simTicker = null
  }
  simTimeouts.forEach((t) => clearTimeout(t))
  simTimeouts = []
}

export const startLoaderSimulation = (customStatus?: string, customSubStatus?: string): void => {
  stopLoaderSimulation()
  ensureElements()

  const initialStatus = customStatus || 'Opening your workspace...'
  const initialSubStatus = customSubStatus !== undefined ? customSubStatus : ''

  // Never drop progress below existing DOM or current progress
  const startVal = Math.max(12, currentProgress)
  setScreenLoaderProgress(startVal, initialStatus, true)
  setScreenLoaderStatus(initialStatus, initialSubStatus)

  let targetProgress = startVal

  const stages = [
    {
      atMs: 250,
      target: 26,
      label: 'Opening your workspace...'
    },
    {
      atMs: 1600,
      target: 48,
      label: 'Loading notes & folders...'
    },
    {
      atMs: 4200,
      target: 70,
      label: 'Preparing your note editor...'
    },
    {
      atMs: 8000,
      target: 86,
      label: 'Connecting knowledge graph...'
    },
    {
      atMs: 13000,
      target: 94,
      label: 'Finalizing your workspace...'
    }
  ]

  // Single unified monotonic ticker
  simTicker = setInterval(() => {
    if (currentProgress < targetProgress) {
      setScreenLoaderProgress(currentProgress + 1)
    }
  }, 35)

  stages.forEach((stage) => {
    const t = setTimeout(() => {
      setScreenLoaderStatus(stage.label, customSubStatus || '')
      if (stage.target > targetProgress) {
        targetProgress = stage.target
      }
    }, stage.atMs)
    simTimeouts.push(t)
  })
}

/**
 * Initializes or binds to the screen loader in the DOM
 */
export const initScreenLoader = (options?: ScreenLoaderOptions): HTMLElement | null => {
  if (typeof document === 'undefined') return null
  startTime = Date.now()
  stopGlobalInlineTimer()

  if (ensureElements() && loaderElement) {
    if (options?.status) setScreenLoaderStatus(options.status, options.subStatus)
    if (options?.progress !== undefined) {
      stopLoaderSimulation()
      setScreenLoaderProgress(options.progress, undefined, true)
    }
    return loaderElement
  }

  // Create dynamically if not present in HTML
  loaderElement = document.createElement('div')
  loaderElement.id = 'screen-loader'
  loaderElement.className = 'screen-loader-overlay'
  loaderElement.setAttribute('role', 'status')
  loaderElement.setAttribute('aria-live', 'polite')

  const initialVal = options?.progress !== undefined ? options.progress : 18

  loaderElement.innerHTML = `
    <div class="screen-loader-ambient"></div>
    <div class="screen-loader-emblem-wrap">
      <div class="screen-loader-pulse-ring ring-1"></div>
      <div class="screen-loader-pulse-ring ring-2"></div>
      <div class="screen-loader-spinner-ring"></div>
      <div class="screen-loader-emblem">
        ${getEmblemSvgMarkup()}
      </div>
    </div>
    <div class="screen-loader-title">Lumina</div>
    <div class="screen-loader-bar-container">
      <div class="screen-loader-bar-fill" id="screen-loader-bar-fill" style="width: ${initialVal}%"></div>
    </div>
    <div class="screen-loader-footer">
      <span class="screen-loader-status" id="screen-loader-status">${options?.status || 'Opening your workspace...'}</span>
      <span class="screen-loader-percent" id="screen-loader-percent">${initialVal}%</span>
    </div>
    <div class="screen-loader-substatus" id="screen-loader-substatus">${options?.subStatus || ''}</div>
  `

  document.body.prepend(loaderElement)
  ensureElements()
  isVisible = true

  if (options?.progress !== undefined) {
    setScreenLoaderProgress(options.progress, undefined, true)
  } else {
    startLoaderSimulation(options?.status, options?.subStatus)
  }

  return loaderElement
}

/**
 * Updates the screen loader progress bar and percentage display.
 * Enforces strictly monotonic progress unless forced.
 */
export const setScreenLoaderProgress = (
  progress: number,
  statusText?: string,
  force = false
): void => {
  const target = Math.max(0, Math.min(100, Math.round(progress)))

  // Monotonicity check: progress must never decrease unless explicitly forced
  if (!force && target < currentProgress) {
    if (statusText) setScreenLoaderStatus(statusText)
    return
  }

  currentProgress = target
  stopGlobalInlineTimer()
  ensureElements()

  if (barFillElement) {
    barFillElement.style.width = `${currentProgress}%`
  }

  if (percentElement) {
    percentElement.textContent = `${currentProgress}%`
  }

  if (statusText) {
    setScreenLoaderStatus(statusText)
  }
}

/**
 * Updates the status text displayed below the progress bar
 */
export const setScreenLoaderStatus = (statusText: string, subStatusText?: string): void => {
  currentStatus = statusText
  ensureElements()

  if (statusElement) {
    statusElement.textContent = statusText
  }

  if (subStatusText !== undefined && subStatusElement) {
    subStatusElement.textContent = subStatusText
  }
}

/**
 * Gracefully hides and fades out the screen loader with an Obsidian-style transition
 */
export const hideScreenLoader = (options?: ScreenLoaderOptions): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      isVisible = false
      resolve()
      return
    }

    stopLoaderSimulation()
    stopGlobalInlineTimer()
    ensureElements()

    if (!loaderElement) {
      isVisible = false
      resolve()
      return
    }

    // Monotonically advance to 100% and show "Ready"
    setScreenLoaderProgress(100, options?.status || 'Ready', true)

    const minDuration = options?.minDuration ?? 200
    const elapsed = Date.now() - startTime
    const waitTime = Math.max(0, minDuration - elapsed)

    setTimeout(() => {
      if (!loaderElement) {
        isVisible = false
        resolve()
        return
      }

      loaderElement.classList.add('screen-loader-fade-out')
      const fadeDuration = options?.fadeDuration ?? 380

      setTimeout(() => {
        if (loaderElement) {
          loaderElement.style.display = 'none'
          if (loaderElement.parentNode) {
            loaderElement.parentNode.removeChild(loaderElement)
          }
          loaderElement = null
          barFillElement = null
          statusElement = null
          percentElement = null
          subStatusElement = null
        }
        isVisible = false
        options?.onHidden?.()
        resolve()
      }, fadeDuration)
    }, waitTime)
  })
}

/**
 * Shows the screen loader (creating it if needed)
 */
export const showScreenLoader = (options?: ScreenLoaderOptions): HTMLElement | null => {
  startTime = Date.now()
  const el = initScreenLoader(options)
  if (el) {
    el.classList.remove('screen-loader-fade-out')
    el.style.display = 'flex'
    isVisible = true
    if (options?.progress !== undefined) {
      setScreenLoaderProgress(options.progress, undefined, true)
    }
    if (options?.status) {
      setScreenLoaderStatus(options.status, options.subStatus)
    }
  }
  return el
}

/**
 * Checks if the screen loader is currently visible
 */
export const isScreenLoaderVisible = (): boolean => isVisible

/**
 * Returns current loading progress
 */
export const getScreenLoaderProgress = (): number => currentProgress

/**
 * Returns current status text
 */
export const getScreenLoaderStatus = (): string => currentStatus

export const resetScreenLoader = (): void => {
  stopLoaderSimulation()
  stopGlobalInlineTimer()
  if (loaderElement && loaderElement.parentNode) {
    loaderElement.parentNode.removeChild(loaderElement)
  }
  loaderElement = null
  barFillElement = null
  statusElement = null
  percentElement = null
  subStatusElement = null
  isVisible = false
  currentProgress = 0
  currentStatus = 'Loading your notes...'
  startTime = Date.now()
}

export const screenLoader = {
  init: initScreenLoader,
  show: showScreenLoader,
  hide: hideScreenLoader,
  setProgress: setScreenLoaderProgress,
  setStatus: setScreenLoaderStatus,
  isVisible: isScreenLoaderVisible,
  getProgress: getScreenLoaderProgress,
  getStatus: getScreenLoaderStatus,
  reset: resetScreenLoader
}

// Attach to window for dev inspection and early bootstrap hooks
if (typeof window !== 'undefined') {
  (window as unknown as { screenLoader?: typeof screenLoader }).screenLoader = screenLoader
}

export default screenLoader
