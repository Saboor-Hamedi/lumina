import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  Download,
  FileText,
  ShieldCheck,
  X,
  Loader2,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Folder
} from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import './css/guide.css'

const LAST_SEEN_VERSION_KEY = 'lumina_last_seen_update_guide_version'
const FIRST_INSTALL_COMPLETED_KEY = 'lumina_first_install_completed'

/**
 * 10 Visual Guidance Cards (Rendered like snapshots/pictures)
 */
const LUMINA_PICTURE_GUIDES = [
  {
    id: 'local-workspace',
    tag: 'Local First',
    title: 'Local-First Markdown Workspace',
    text: 'Documents and assets remain 100% on your local disk in standard Markdown files with zero telemetry.',
    barTitle: 'workspace/notes/',
    renderMockup: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ffffff' }}>
          <Folder size={11} style={{ color: 'var(--text-accent, #40bafa)' }} />
          <span style={{ fontWeight: 700, fontSize: '10px' }}>Research / Strategy Q4.md</span>
        </div>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderLeft: '2px solid rgba(255, 255, 255, 0.2)',
            padding: '2px 6px',
            borderRadius: '2px',
            color: 'var(--text-muted)',
            fontSize: '9px',
            fontWeight: 600
          }}
        >
          🔒 Stored locally on disk • Zero cloud lock-in
        </div>
      </div>
    )
  },
  {
    id: 'katex-math',
    tag: 'LaTeX Math',
    title: 'KaTeX Mathematical Notation',
    text: 'Render equations live using inline ($...$) and block ($$...$$) KaTeX notation as you type.',
    barTitle: 'Quantum_Physics.md - KaTeX Math',
    renderMockup: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ fontFamily: 'monospace', color: '#79c0ff', fontSize: '9.5px' }}>
          $$ e^{'{'}i\pi{'}'} + 1 = 0 $$
        </div>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px dashed rgba(255, 255, 255, 0.15)',
            borderRadius: '3px',
            padding: '2px 8px',
            color: '#c084fc',
            fontWeight: 700,
            fontSize: '10.5px'
          }}
        >
          e^(iπ) + 1 = 0
        </div>
      </div>
    )
  },
  {
    id: 'word-paste',
    tag: 'Smart Paste',
    title: 'Word Document Paste Preservation',
    text: 'Paste from Word (Ctrl + V). Preserves tables, headings, footnotes, and images into clean Markdown.',
    barTitle: 'Word_Paste_Engine.md (Ctrl + V)',
    renderMockup: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3px', fontSize: '9px' }}>
          <span style={{ fontWeight: 700, color: '#ffffff', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Header</span>
          <span style={{ fontWeight: 700, color: '#ffffff', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Type</span>
          <span style={{ fontWeight: 700, color: '#ffffff', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Status</span>
          <span style={{ color: 'var(--text-muted)' }}>Table Data</span>
          <span style={{ color: 'var(--text-accent)' }}>Clean MD</span>
          <span style={{ color: '#22c55e', fontWeight: 600 }}>Preserved</span>
        </div>
        <div style={{ fontSize: '8.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
          🖼 assets/diagram.png extracted & embedded
        </div>
      </div>
    )
  },
  {
    id: 'callouts',
    tag: 'Alerts',
    title: 'GitHub-Style Callout Boxes',
    text: 'Structure notes with clean alerts: > [!NOTE], > [!TIP], > [!IMPORTANT], and > [!WARNING].',
    barTitle: 'Insight_Callouts.md',
    renderMockup: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderLeft: '2px solid var(--text-accent, #40bafa)',
            padding: '2px 6px',
            borderRadius: '2px',
            color: 'var(--text-main)',
            fontSize: '9px',
            fontWeight: 600
          }}
        >
          [!NOTE] Local Markdown files sync with zero lag.
        </div>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderLeft: '2px solid rgba(255, 255, 255, 0.3)',
            padding: '2px 6px',
            borderRadius: '2px',
            color: 'var(--text-muted)',
            fontSize: '9px',
            fontWeight: 600
          }}
        >
          [!TIP] Press Ctrl + P to open Command Palette.
        </div>
      </div>
    )
  },
  {
    id: 'graph',
    tag: 'Graph',
    title: '2D & 3D Knowledge Network',
    text: 'Press Ctrl + G to explore connected visual clusters linking notes, ideas, and references.',
    barTitle: 'Knowledge Graph (Ctrl + G)',
    renderMockup: () => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '3px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#40bafa' }} />
          <span style={{ fontSize: '9.5px', color: '#ffffff', fontWeight: 600 }}>Research</span>
        </div>
        <div style={{ width: '22px', height: '1px', background: 'rgba(255, 255, 255, 0.15)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa' }} />
          <span style={{ fontSize: '9.5px', color: '#ffffff', fontWeight: 700 }}>Core Index</span>
        </div>
        <div style={{ width: '22px', height: '1px', background: 'rgba(255, 255, 255, 0.15)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#c084fc' }} />
          <span style={{ fontSize: '9.5px', color: '#ffffff', fontWeight: 600 }}>Projects</span>
        </div>
      </div>
    )
  },
  {
    id: 'wikilinks',
    tag: 'Linking',
    title: 'Bi-Directional Wiki Links',
    text: 'Type [[ anywhere to link notes. Automatic reference discovery connects incoming thoughts.',
    barTitle: 'Note_Linker.md',
    renderMockup: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ fontSize: '9.5px', color: 'var(--text-main)' }}>
          See{' '}
          <span style={{ background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-accent)', padding: '1px 4px', borderRadius: '2px', fontWeight: 600 }}>
            [[Architecture]]
          </span>{' '}
          and review{' '}
          <span style={{ background: 'rgba(255, 255, 255, 0.06)', color: '#c084fc', padding: '1px 4px', borderRadius: '2px', fontWeight: 600 }}>
            [[Security Spec]]
          </span>
        </div>
        <div style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>
          🔗 3 incoming backlinks connected
        </div>
      </div>
    )
  },
  {
    id: 'mail',
    tag: 'Mail',
    title: 'Integrated Private Mail Client',
    text: 'Manage email natively inside Lumina with Gmail synchronization and note attachments.',
    barTitle: 'Lumina Mail - Inbox',
    renderMockup: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '9.5px' }}>Sarah Chen • Q4 Review Draft</span>
          <span style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>10:14 AM</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '8.5px', background: 'rgba(255,255,255,0.04)', padding: '1px 4px', borderRadius: '2px', color: 'var(--text-muted)' }}>
            📎 Attached: Research.md
          </span>
          <span style={{ fontSize: '8.5px', color: '#22c55e', fontWeight: 600 }}>✔ Synchronized</span>
        </div>
      </div>
    )
  },
  {
    id: 'breadcrumbs',
    tag: 'Navigation',
    title: 'Interactive Breadcrumb Bar',
    text: 'Jump across hierarchy segments (Workspace › Folders › Note › Heading) with keyboard navigation.',
    barTitle: 'Breadcrumb Bar',
    renderMockup: () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9.5px' }}>
        <span style={{ color: 'var(--text-muted)' }}>Workspace</span>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
        <span style={{ color: 'var(--text-muted)' }}>Engineering</span>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
        <span style={{ color: '#ffffff', fontWeight: 700 }}>API_Spec.md</span>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
        <span style={{ color: 'var(--text-accent)', background: 'rgba(255,255,255,0.04)', padding: '1px 3px', borderRadius: '2px', fontWeight: 600 }}>
          # Endpoints
        </span>
      </div>
    )
  },
  {
    id: 'palette',
    tag: 'Commands',
    title: 'Lightning Command Palette (Ctrl + P)',
    text: 'Find notes, run actions, switch themes, and execute commands instantly with quick typing.',
    barTitle: 'Command Palette (Ctrl + P)',
    renderMockup: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '2px',
            padding: '2px 5px',
            fontSize: '9px',
            color: 'var(--text-muted)'
          }}
        >
          <span style={{ color: 'var(--text-accent)', fontWeight: 700 }}>&gt;</span> Search notes or commands...
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#ffffff', padding: '0 2px' }}>
          <span style={{ fontWeight: 600 }}>📄 Q4 Architecture Blueprint.md</span>
          <span style={{ color: 'var(--text-muted)' }}>Note</span>
        </div>
      </div>
    )
  },
  {
    id: 'shortcuts',
    tag: 'Shortcuts',
    title: 'Essential Keyboard Shortcuts',
    text: 'Keep your fingers on the keyboard to move through Lumina at lightning speed.',
    barTitle: 'Keyboard Quick Reference',
    renderMockup: () => (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', fontSize: '9px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>Palette</span>
          <kbd style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 3px', borderRadius: '2px', color: 'var(--text-accent)', fontWeight: 700 }}>Ctrl+P</kbd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>New Note</span>
          <kbd style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 3px', borderRadius: '2px', color: 'var(--text-accent)', fontWeight: 700 }}>Ctrl+N</kbd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>Lumina AI</span>
          <kbd style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 3px', borderRadius: '2px', color: 'var(--text-accent)', fontWeight: 700 }}>Ctrl+Shift+\</kbd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>Settings</span>
          <kbd style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 3px', borderRadius: '2px', color: 'var(--text-accent)', fontWeight: 700 }}>Ctrl+,</kbd>
        </div>
      </div>
    )
  }
]

const UpdateGuide = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentVersion, setCurrentVersion] = useState('')
  const [step, setStep] = useState(0) // 0: Review, 1: Download/Features, 2: Install
  const [guideIndex, setGuideIndex] = useState(0)
  const [isInstallingAction, setIsInstallingAction] = useState(false)
  const [isFirstInstall, setIsFirstInstall] = useState(false)

  const status = useUpdateStore((state) => state.status)
  const progress = useUpdateStore((state) => state.progress)
  const updateInfo = useUpdateStore((state) => state.updateInfo)
  const download = useUpdateStore((state) => state.download)
  const cancel = useUpdateStore((state) => state.cancel)
  const install = useUpdateStore((state) => state.install)

  const targetVersion = updateInfo?.version || '1.0.44'

  // Initialize version & detect whether this is a First-Time Install
  useEffect(() => {
    let cancelled = false

    const initVersion = async () => {
      if (!window.api?.getVersion || typeof localStorage === 'undefined') return

      try {
        const appVer = await window.api.getVersion()
        if (cancelled || !appVer) return

        setCurrentVersion(appVer)
        const isSetupCompleted = localStorage.getItem(FIRST_INSTALL_COMPLETED_KEY)
        const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY)

        if (!isSetupCompleted) {
          setIsFirstInstall(true)
          setStep(0)
        } else if (lastSeen && lastSeen !== appVer) {
          setIsFirstInstall(false)
          setStep(2)
          setIsOpen(true)
        }
      } catch (err) {
        console.warn('[UpdateGuide] Version fetch error:', err)
      }
    }

    initVersion()
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-advance the 10 picture guides every 6 seconds
  useEffect(() => {
    if (!isOpen) return undefined
    const timer = setInterval(() => {
      setGuideIndex((curr) => (curr + 1) % LUMINA_PICTURE_GUIDES.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [isOpen])

  // Sync step with updater state
  useEffect(() => {
    if (status === 'available') {
      setIsFirstInstall(false)
      setStep(0)
      setIsOpen(true)
    } else if (status === 'downloading') {
      setIsFirstInstall(false)
      setStep(1)
      setIsOpen(true)
    } else if (status === 'ready') {
      setIsFirstInstall(false)
      setStep(2)
      setIsOpen(true)
    }
  }, [status])

  // Progress metrics calculation
  const progressPercent = useMemo(() => {
    if (status === 'ready') return 100
    if (status !== 'downloading') return step >= 2 ? 100 : step === 1 ? 52 : 0
    const val = typeof progress === 'number' ? progress : progress?.percent
    if (typeof val === 'number' && !isNaN(val)) {
      return Math.min(100, Math.max(0, Math.round(val)))
    }
    return 0
  }, [status, progress, step])

  const speedText = useMemo(() => {
    if (status !== 'downloading' || !progress?.bytesPerSecond) return ''
    const mbps = (progress.bytesPerSecond / (1024 * 1024)).toFixed(1)
    return `${mbps} MB/s`
  }, [status, progress])

  const transferredText = useMemo(() => {
    if (status !== 'downloading' || !progress?.transferred) return ''
    const transferredMB = (progress.transferred / (1024 * 1024)).toFixed(1)
    const totalMB = progress.total ? (progress.total / (1024 * 1024)).toFixed(1) : ''
    return totalMB ? `${transferredMB} / ${totalMB} MB` : `${transferredMB} MB`
  }, [status, progress])

  // Listen for custom trigger events
  useEffect(() => {
    const handleOpen = () => {
      if (status === 'ready') setStep(2)
      else if (status === 'downloading') setStep(1)
      else setStep(0)
      setIsOpen(true)
    }
    window.addEventListener('open-update-guide', handleOpen)
    window.addEventListener('open-whats-new', handleOpen)
    return () => {
      window.removeEventListener('open-update-guide', handleOpen)
      window.removeEventListener('open-whats-new', handleOpen)
    }
  }, [status])

  // Cancel download and close
  const handleCancel = async () => {
    if (status === 'downloading') {
      try {
        await cancel()
      } catch (err) {
        console.warn('[UpdateGuide] Failed to cancel download:', err)
      }
    }
    setIsOpen(false)
  }

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handleCancel()
      } else if (e.key === 'ArrowRight' && step < 2) {
        setStep((s) => s + 1)
      } else if (e.key === 'ArrowLeft' && step > 0) {
        setStep((s) => s - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isOpen, step])

  // Downloads immediately the moment user clicks Download
  const handleStartDownload = () => {
    download()
    setStep(1)
  }

  const handleInstallNow = async () => {
    if (isInstallingAction) return
    setIsInstallingAction(true)
    try {
      await install()
    } catch (err) {
      console.error('[UpdateGuide] Failed to quit and install:', err)
      setIsInstallingAction(false)
    }
  }

  const handleFinishFirstInstall = () => {
    localStorage.setItem(FIRST_INSTALL_COMPLETED_KEY, 'true')
    if (currentVersion) {
      localStorage.setItem(LAST_SEEN_VERSION_KEY, currentVersion)
    }
    setIsOpen(false)
  }

  const handleNextStep = () => {
    if (isFirstInstall) {
      if (step === 0) setStep(1)
      else if (step === 1) setStep(2)
      else handleFinishFirstInstall()
      return
    }

    if (step === 0) {
      handleStartDownload()
    } else if (step === 1) {
      if (status === 'ready' || progressPercent >= 100) {
        setStep(2)
      }
    } else if (step === 2) {
      handleInstallNow()
    }
  }

  const openGuide = () => {
    if (status === 'ready') setStep(2)
    else if (status === 'downloading') setStep(1)
    else setStep(0)
    setIsOpen(true)
  }

  const activeGuide = LUMINA_PICTURE_GUIDES[guideIndex]

  // Floating trigger button when closed
  if (!isOpen) {
    if (status === 'downloading') {
      return (
        <button
          type="button"
          onClick={openGuide}
          aria-label="Open download progress"
          title="Downloading Lumina Update"
          style={{
            position: 'fixed',
            right: '16px',
            bottom: '40px',
            zIndex: 1000,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 9px',
            border: '1px solid rgba(64, 186, 250, 0.25)',
            borderRadius: '5px',
            background: 'var(--bg-surface, rgba(20, 20, 26, 0.94))',
            color: 'var(--text-accent, #40bafa)',
            fontSize: '10.5px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(12px)'
          }}
        >
          <Loader2 size={11} className="guide-spin" />
          <span>Updating {progressPercent}%</span>
        </button>
      )
    }

    if (status === 'ready') {
      return (
        <button
          type="button"
          onClick={openGuide}
          aria-label="Open ready update"
          title="Update Ready to Install"
          style={{
            position: 'fixed',
            right: '16px',
            bottom: '40px',
            zIndex: 1000,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 9px',
            border: '1px solid rgba(34, 197, 94, 0.25)',
            borderRadius: '5px',
            background: 'var(--bg-surface, rgba(20, 20, 26, 0.94))',
            color: '#22c55e',
            fontSize: '10.5px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(12px)'
          }}
        >
          <CheckCircle2 size={11} />
          <span>Install update</span>
        </button>
      )
    }

    // Floating trigger button commented out for dev testing
    /*
    return (
      <button
        type="button"
        onClick={openGuide}
        aria-label="Open setup or updates"
        title="Lumina Setup & Updates"
        style={{
          position: 'fixed',
          right: '16px',
          bottom: '40px',
          zIndex: 1000,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 9px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '5px',
          background: 'var(--bg-surface, rgba(20, 20, 26, 0.94))',
          color: 'var(--text-main, #f8fafc)',
          fontSize: '10.5px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(12px)'
        }}
      >
        <FileText size={10} style={{ opacity: 0.7 }} />
        <span>{isFirstInstall ? 'Setup' : 'Update'}</span>
      </button>
    )
    */
    return null
  }

  // Stepper pipeline headers
  const stepTitles = isFirstInstall
    ? ['1. Welcome', '2. Feature Tour', '3. Ready']
    : ['1. Update', '2. Download', '3. Install']

  return createPortal(
    <div className="guide-modal-overlay" onClick={handleCancel}>
      <div className="installer-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Borderless Top Stepper Bar (No Titlebar) */}
        <div className="installer-stepper">
          <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            {stepTitles.map((title, idx) => {
              const isActive = step === idx
              const isCompleted = step > idx
              return (
                <React.Fragment key={title}>
                  <button
                    type="button"
                    className={`installer-step-pill ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                    onClick={() => setStep(idx)}
                  >
                    <span className="installer-step-badge">
                      {isCompleted ? '✔' : idx + 1}
                    </span>
                    <span>{title.slice(3)}</span>
                  </button>
                  {idx < 2 && <div className="installer-step-divider" />}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* Modal Body with strictly locked content height & selectable text */}
        <div className="installer-body">
          {/* STEP INFO AREA: Fixed 64px height so modal height NEVER shifts */}
          <div
            className="installer-selectable"
            style={{ minHeight: '64px', maxHeight: '64px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          >
            {/* STEP 0: WELCOME OR UPDATE DETAILS */}
            {step === 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                    {isFirstInstall ? 'Lumina Workspace' : `Lumina v${targetVersion}`}
                  </span>
                  <span
                    style={{
                      fontSize: '8.5px',
                      fontWeight: 700,
                      background: 'rgba(255, 255, 255, 0.04)',
                      color: 'rgba(255, 255, 255, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      padding: '1px 4px',
                      borderRadius: '2px'
                    }}
                  >
                    {isFirstInstall ? 'LOCAL' : 'READY'}
                  </span>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    borderRadius: '4px',
                    padding: '5px 8px',
                    fontSize: '9.5px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>
                    {isFirstInstall ? 'Installed & ready on your disk' : `Current: v${currentVersion || '1.0.43'} ➔ Target: v${targetVersion}`}
                  </span>
                  <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                    <ShieldCheck size={10} /> Local
                  </span>
                </div>
              </div>
            )}

            {/* STEP 1: DOWNLOADING OR FEATURE TOUR */}
            {step === 1 && (
              <div>
                {!isFirstInstall ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#ffffff' }}>
                        {progressPercent >= 100 || status === 'ready' ? 'Download Complete' : 'Downloading Update...'}
                      </span>
                      <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-accent, #40bafa)' }}>
                        {progressPercent}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        height: '4px',
                        borderRadius: '2px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        overflow: 'hidden',
                        marginBottom: '3px'
                      }}
                    >
                      <div
                        style={{
                          width: `${progressPercent}%`,
                          height: '100%',
                          borderRadius: '2px',
                          background: 'var(--text-accent, #40bafa)',
                          transition: 'width 0.2s ease'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)' }}>
                      <span>{transferredText || 'Downloading payload...'}</span>
                      <span>{speedText || 'Background sync'}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                      Workspace Features & Tips
                    </span>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      Explore the 10 visual feature guides below while getting started.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: READY TO INSTALL OR READY TO START */}
            {step === 2 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    color: '#22c55e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#ffffff' }}>
                    {isFirstInstall ? 'Lumina is Ready' : `v${targetVersion} Ready to Install`}
                  </div>
                  <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {isFirstInstall
                      ? 'Local workspace initialized. Click Finish to open your workspace.'
                      : 'Verified. Lumina will restart and restore your workspace.'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── 10 PICTURE GUIDES CAROUSEL (SELECTABLE TEXT) ── */}
          <div className="installer-carousel installer-selectable">
            <div>
              <div className="installer-slide-header">
                <span className="installer-slide-title">{activeGuide.title}</span>
                <span className="installer-slide-tag">{activeGuide.tag}</span>
              </div>
              <p className="installer-slide-text">{activeGuide.text}</p>

              {/* Visual Snapshot Picture Frame */}
              <div className="installer-mockup-frame">
                <div className="installer-mockup-bar">
                  <div className="installer-mockup-dot red" />
                  <div className="installer-mockup-dot yellow" />
                  <div className="installer-mockup-dot green" />
                  <span className="installer-mockup-title">{activeGuide.barTitle}</span>
                </div>
                <div className="installer-mockup-content">
                  {activeGuide.renderMockup()}
                </div>
              </div>
            </div>

            {/* Carousel Navigation (10 Dots & Arrows) */}
            <div className="installer-carousel-nav">
              <div className="installer-carousel-dots">
                {LUMINA_PICTURE_GUIDES.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setGuideIndex(idx)}
                    className={`installer-carousel-dot ${idx === guideIndex ? 'active' : ''}`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', marginRight: '3px', fontWeight: 600 }}>
                  {guideIndex + 1}/10
                </span>
                <button
                  type="button"
                  onClick={() => setGuideIndex((c) => (c <= 0 ? LUMINA_PICTURE_GUIDES.length - 1 : c - 1))}
                  className="installer-carousel-arrow"
                  aria-label="Previous slide"
                >
                  <ChevronLeft size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => setGuideIndex((c) => (c + 1) % LUMINA_PICTURE_GUIDES.length)}
                  className="installer-carousel-arrow"
                  aria-label="Next slide"
                >
                  <ChevronRight size={11} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with small sharp Next-Next-Next buttons */}
        <div className="guide-modal-footer">
          {/* Cancel button */}
          <button
            type="button"
            className="guide-btn guide-btn-secondary"
            onClick={handleCancel}
          >
            <span>{status === 'downloading' ? 'Cancel' : isFirstInstall ? 'Close' : 'Cancel'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {step > 0 && (
              <button
                type="button"
                className="guide-btn guide-btn-secondary"
                onClick={() => setStep((s) => s - 1)}
              >
                <ChevronLeft size={12} />
                <span>Back</span>
              </button>
            )}

            {step === 0 && (
              <button
                type="button"
                className="guide-btn guide-btn-primary"
                onClick={handleNextStep}
              >
                <span>{isFirstInstall ? 'Next' : 'Download Update'}</span>
                <ChevronRight size={12} />
              </button>
            )}

            {step === 1 && (
              <button
                type="button"
                className="guide-btn guide-btn-primary"
                onClick={handleNextStep}
                disabled={!isFirstInstall && progressPercent < 100 && status !== 'ready'}
              >
                {isFirstInstall ? (
                  <>
                    <span>Next</span>
                    <ChevronRight size={12} />
                  </>
                ) : progressPercent >= 100 || status === 'ready' ? (
                  <>
                    <span>Next</span>
                    <ChevronRight size={12} />
                  </>
                ) : (
                  <>
                    <Loader2 size={12} className="guide-spin" />
                    <span>{progressPercent}%</span>
                  </>
                )}
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                className="guide-btn guide-btn-primary"
                onClick={isFirstInstall ? handleFinishFirstInstall : handleInstallNow}
                disabled={isInstallingAction}
              >
                {isFirstInstall ? (
                  <>
                    <CheckCircle2 size={12} />
                    <span>Finish</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={12} className={isInstallingAction ? 'guide-spin' : ''} />
                    <span>{isInstallingAction ? 'Restarting...' : 'Install & Restart'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default UpdateGuide
