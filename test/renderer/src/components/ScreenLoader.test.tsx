import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import ScreenLoader from '../../../../src/renderer/src/components/ScreenLoader.tsx'
import {
  initScreenLoader,
  setScreenLoaderProgress,
  setScreenLoaderStatus,
  hideScreenLoader,
  showScreenLoader,
  isScreenLoaderVisible,
  getScreenLoaderProgress,
  getScreenLoaderStatus,
  resetScreenLoader,
  screenLoader
} from '../../../../src/renderer/src/components/screenLoader'
import * as screenlaoderAlias from '../../../../src/renderer/src/components/screenlaoder'

describe('ScreenLoader Component', () => {
  it('renders default screen loader elements', () => {
    render(<ScreenLoader />)

    expect(screen.getByTestId('screen-loader')).toBeInTheDocument()
    expect(screen.getByText('Lumina')).toBeInTheDocument()
    expect(screen.getByText('Loading your notes...')).toBeInTheDocument()
    expect(screen.getByTestId('screen-loader-progressbar')).toBeInTheDocument()
    expect(screen.getByTestId('screen-loader-spinner')).toBeInTheDocument()
    expect(screen.queryByTestId('screen-loader-substatus')).toBeNull()
  })

  it('renders custom title, status, and subStatus', () => {
    render(
      <ScreenLoader
        title="Lumina Workspace"
        status="Synchronizing knowledge graph..."
        subStatus="Scanning 420 markdown files"
      />
    )

    expect(screen.getByText('Lumina Workspace')).toBeInTheDocument()
    expect(screen.getByText('Synchronizing knowledge graph...')).toBeInTheDocument()
    expect(screen.getByText('Scanning 420 markdown files')).toBeInTheDocument()
  })

  it('renders progress percentage when provided', () => {
    render(<ScreenLoader progress={72} status="Building cache..." />)

    expect(screen.getByText('72%')).toBeInTheDocument()
    const progressBar = screen.getByTestId('screen-loader-progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '72')
  })

  it('can hide pulse rings and spinner via props', () => {
    render(<ScreenLoader showPulse={false} showSpinner={false} />)

    expect(screen.queryByTestId('screen-loader-spinner')).toBeNull()
  })

  it('supports inline non-fullscreen mode', () => {
    render(<ScreenLoader fullscreen={false} className="custom-test-loader" />)

    const loader = screen.getByTestId('screen-loader')
    expect(loader).toHaveClass('inline-loader')
    expect(loader).toHaveClass('custom-test-loader')
  })
})

describe('screenLoader controller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetScreenLoader()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    resetScreenLoader()
    document.body.innerHTML = ''
  })

  it('creates screen loader DOM element if not present', () => {
    const el = initScreenLoader({ status: 'Booting...' })
    expect(el).not.toBeNull()
    expect(document.getElementById('screen-loader')).toBeInTheDocument()
    expect(screen.getByText('Booting...')).toBeInTheDocument()
  })

  it('updates progress and status properly', () => {
    initScreenLoader()
    setScreenLoaderProgress(65, 'Indexing files...')

    expect(getScreenLoaderProgress()).toBe(65)
    expect(getScreenLoaderStatus()).toBe('Indexing files...')
    expect(document.getElementById('screen-loader-bar-fill')?.style.width).toBe('65%')
    expect(document.getElementById('screen-loader-percent')?.textContent).toBe('65%')
    expect(document.getElementById('screen-loader-status')?.textContent).toBe('Indexing files...')
  })

  it('updates substatus text', () => {
    initScreenLoader()
    setScreenLoaderStatus('Preparing workspace', 'Checking 15 folders')

    expect(document.getElementById('screen-loader-substatus')?.textContent).toBe('Checking 15 folders')
  })

  it('guarantees monotonicity and prevents progress from dropping (e.g. 94% down to 74%)', () => {
    initScreenLoader()
    setScreenLoaderProgress(94, 'Almost there...')
    expect(getScreenLoaderProgress()).toBe(94)

    // Attempt to downgrade without force
    setScreenLoaderProgress(74, 'Delayed step')
    expect(getScreenLoaderProgress()).toBe(94)
    expect(document.getElementById('screen-loader-percent')?.textContent).toBe('94%')
    expect(document.getElementById('screen-loader-bar-fill')?.style.width).toBe('94%')
  })

  it('fades out and hides screen loader', async () => {
    initScreenLoader()
    const loader = document.getElementById('screen-loader')
    expect(loader).toBeInTheDocument()

    const onHidden = vi.fn()
    const hidePromise = hideScreenLoader({ minDuration: 100, fadeDuration: 200, onHidden })

    // Fast-forward minDuration
    vi.advanceTimersByTime(100)
    expect(loader?.classList.contains('screen-loader-fade-out')).toBe(true)

    // Fast-forward fadeDuration
    vi.advanceTimersByTime(200)
    await hidePromise

    expect(onHidden).toHaveBeenCalled()
    expect(isScreenLoaderVisible()).toBe(false)
  })

  it('shows screen loader after being hidden', () => {
    showScreenLoader({ status: 'Re-opening vault...', progress: 30 })
    expect(isScreenLoaderVisible()).toBe(true)
    expect(document.getElementById('screen-loader')).toBeInTheDocument()
    expect(document.getElementById('screen-loader-bar-fill')?.style.width).toBe('30%')
    expect(document.getElementById('screen-loader-status')?.textContent).toBe('Re-opening vault...')
  })

  it('exports through screenlaoder alias seamlessly', () => {
    expect(screenlaoderAlias.screenLoader).toBeDefined()
    expect(screenlaoderAlias.initScreenLoader).toBe(initScreenLoader)
    expect(screenlaoderAlias.hideScreenLoader).toBe(hideScreenLoader)
  })
})
