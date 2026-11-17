import React, { useState, useEffect, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import {
  BookOpen,
  Compass,
  FileText,
  Network,
  Mic,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  ShieldCheck,
  Zap,
  FolderTree,
  Terminal,
  Layers,
  Bot,
  Workflow,
  Square,
  Copy,
  type LucideIcon
} from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { useSettingsStore } from '../../core/store/SettingStore'
import './css/guide.css'

export interface GuideProps {
  isOpen: boolean
  onClose: () => void
  onLoadStarterNotes?: () => Promise<void>
  onOpenDocs?: () => void
}

interface GuideFeature {
  icon: LucideIcon
  title: string
  text: string
}

interface GuideStep {
  badge: string
  badgeIcon: LucideIcon
  title: string
  subtitle: string
  features: GuideFeature[]
  preview: React.ComponentType
}

const PreviewWelcome: React.FC = memo(() => (
  <div className="preview-card">
    <div className="preview-top-bar">
      <div className="preview-dot red" />
      <div className="preview-dot yellow" />
      <div className="preview-dot green" />
      <span className="preview-top-title">workspace/documents/lumina</span>
    </div>
    <div className="preview-step-0">
      <div className="preview-file-item">
        <FolderTree size={14} style={{ color: 'var(--text-accent, #40bafa)' }} />
        <span>Research / Q3 Strategy.md</span>
      </div>
      <div className="preview-callout">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, marginBottom: 4 }}>
          <ShieldCheck size={14} style={{ color: '#22c55e' }} />
          <span>Local-First & Offline</span>
        </div>
        <div>Your notes are 100% yours. No cloud lock-in, no telemetry, pure Markdown on disk.</div>
      </div>
    </div>
  </div>
))
PreviewWelcome.displayName = 'PreviewWelcome'

const PreviewEditor: React.FC = memo(() => (
  <div className="preview-card">
    <div className="preview-top-bar">
      <div className="preview-dot red" />
      <div className="preview-dot yellow" />
      <div className="preview-dot green" />
      <span className="preview-top-title">Math & Formulas.md</span>
    </div>
    <div className="preview-step-1">
      <div className="preview-code-block">
        <div># Quantum Computing Note</div>
        <div style={{ color: 'var(--text-muted, #888899)' }}>// Math equation</div>
        <div style={{ color: '#ff7b72' }}>$$ e^{'{'}i\pi{'}'} + 1 = 0 $$</div>
      </div>
      <div className="preview-math-box">
        <span style={{ fontSize: '11px', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Live Rendered Equation
        </span>
        <div className="preview-math-formula">e^(iπ) + 1 = 0</div>
      </div>
    </div>
  </div>
))
PreviewEditor.displayName = 'PreviewEditor'

const PreviewGraph: React.FC = memo(() => (
  <div className="preview-card">
    <div className="preview-top-bar">
      <div className="preview-dot red" />
      <div className="preview-dot yellow" />
      <div className="preview-dot green" />
      <span className="preview-top-title">2D / 3D Knowledge Graph</span>
    </div>
    <div className="preview-step-2">
      <svg viewBox="0 0 200 120" className="graph-preview-svg">
        <line x1="40" y1="60" x2="100" y2="35" stroke="rgba(64, 186, 250, 0.4)" strokeWidth="1.5" strokeDasharray="3 3" />
        <line x1="100" y1="35" x2="160" y2="55" stroke="rgba(64, 186, 250, 0.4)" strokeWidth="1.5" />
        <line x1="100" y1="35" x2="100" y2="95" stroke="rgba(168, 85, 247, 0.5)" strokeWidth="2" />
        <line x1="40" y1="60" x2="100" y2="95" stroke="rgba(64, 186, 250, 0.3)" strokeWidth="1.5" />
        <line x1="160" y1="55" x2="100" y2="95" stroke="rgba(64, 186, 250, 0.3)" strokeWidth="1.5" />

        <circle cx="40" cy="60" r="7" fill="#40bafa" className="graph-node" />
        <text x="40" y="78" fontSize="8" fill="#a0a0b5" textAnchor="middle">Ideas</text>

        <circle cx="100" cy="35" r="10" fill="#60a5fa" className="graph-node" />
        <text x="100" y="20" fontSize="8" fill="#ffffff" fontWeight="600" textAnchor="middle">Index</text>

        <circle cx="160" cy="55" r="8" fill="#38bdf8" className="graph-node" />
        <text x="160" y="73" fontSize="8" fill="#a0a0b5" textAnchor="middle">Projects</text>

        <circle cx="100" cy="95" r="9" fill="#c084fc" className="graph-node" />
        <text x="100" y="113" fontSize="8" fill="#c084fc" fontWeight="600" textAnchor="middle">Graph</text>
      </svg>
    </div>
  </div>
))
PreviewGraph.displayName = 'PreviewGraph'

const PreviewAI: React.FC = memo(() => (
  <div className="preview-card">
    <div className="preview-top-bar">
      <div className="preview-dot red" />
      <div className="preview-dot yellow" />
      <div className="preview-dot green" />
      <span className="preview-top-title">Lumina AI Copilot</span>
    </div>
    <div className="preview-step-3">
      <div className="chat-bubble-user">
        What were my action items for the Q3 product release?
      </div>
      <div className="chat-bubble-ai">
        <div>Based on <strong>[[Q3 Strategy]]</strong>, your two priorities are:</div>
        <div style={{ marginTop: 4 }}>• Finalize local vector embeddings</div>
        <div>• Deploy real-time voice capsule</div>
        <div className="chat-citation-tag">
          <BookOpen size={10} />
          <span>Cited in 2 notes</span>
        </div>
      </div>
    </div>
  </div>
))
PreviewAI.displayName = 'PreviewAI'

const PreviewMailCanvas: React.FC = memo(() => (
  <div className="preview-card">
    <div className="preview-top-bar">
      <div className="preview-dot red" />
      <div className="preview-dot yellow" />
      <div className="preview-dot green" />
      <span className="preview-top-title">Lumina Mail & Spatial Canvas</span>
    </div>
    <div className="preview-step-3" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px', padding: '8px 10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>Lumina Mail Client</span>
          <span style={{ fontSize: '9.5px', color: 'var(--text-accent, #40bafa)', fontWeight: 600 }}>Gmail API</span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          Private Gmail suite in a draggable portal window with thread search & 1-click note attachment.
        </div>
      </div>
      <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px', padding: '8px 10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>Infinite Spatial Canvas</span>
          <span style={{ fontSize: '9.5px', color: '#22c55e', fontWeight: 600 }}>2D Plane</span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          Mind-map thoughts visually with reactive bezier wires, markdown cards, and hardware zoom.
        </div>
      </div>
    </div>
  </div>
))
PreviewMailCanvas.displayName = 'PreviewMailCanvas'

const PreviewReady: React.FC = memo(() => (
  <div className="preview-card">
    <div className="preview-top-bar">
      <div className="preview-dot red" />
      <div className="preview-dot yellow" />
      <div className="preview-dot green" />
      <span className="preview-top-title">Setup Complete</span>
    </div>
    <div className="preview-step-4">
      <div className="ready-icon-halo">
        <CheckCircle2 size={28} />
      </div>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', marginBottom: 4 }}>
          You are ready to create!
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted, #a0a0b0)', maxWidth: '240px', margin: '0 auto' }}>
          Explore sample guides, browse documentation, or jump directly into your personal workspace.
        </div>
      </div>
    </div>
  </div>
))
PreviewReady.displayName = 'PreviewReady'

const GUIDE_STEPS: readonly GuideStep[] = [
  {
    badge: 'Philosophy',
    badgeIcon: ShieldCheck,
    title: 'Welcome to Lumina',
    subtitle: 'A local-first, distraction-free workspace for thinking, writing, and building connections.',
    features: [
      {
        icon: FileText,
        title: 'Pure Markdown on Disk',
        text: 'Your notes are standard .md files stored directly on your computer. Zero proprietary databases, zero vendor lock-in.'
      },
      {
        icon: Zap,
        title: 'Blazing Fast & Local',
        text: 'Instant launch, offline-first reliability, and lightning-fast search with instant keyboard navigation.'
      },
      {
        icon: ShieldCheck,
        title: 'Private by Design',
        text: 'Your data stays exclusively on your machine. Complete privacy for your thoughts, research, and journals.'
      }
    ],
    preview: PreviewWelcome
  },
  {
    badge: 'Editing Canvas',
    badgeIcon: FileText,
    title: 'Rich Markdown & Math',
    subtitle: 'Distraction-free editing canvas with live formatting, callout boxes, and mathematical formulas.',
    features: [
      {
        icon: Layers,
        title: 'Insight Callout Boxes',
        text: 'Highlight important notes using clean callout boxes like > [!NOTE], > [!TIP], > [!IMPORTANT], and > [!WARNING].'
      },
      {
        icon: Terminal,
        title: 'Math Notation & Code',
        text: 'Render equations live using ($...$ and $$...$$) and view syntax-highlighted code blocks across dozens of languages.'
      },
      {
        icon: Workflow,
        title: 'Interactive Diagrams',
        text: 'Write plain text to dynamically render flowcharts, sequence diagrams, and visual architecture graphs.'
      }
    ],
    preview: PreviewEditor
  },
  {
    badge: 'Knowledge Graph',
    badgeIcon: Network,
    title: 'Link Your Notes',
    subtitle: 'Interconnect your ideas organically and visualize your digital brain in 2D and 3D.',
    features: [
      {
        icon: Network,
        title: 'Link Any Note ([[Note Title]])',
        text: 'Type [[ anywhere to search and link directly to any note, heading, or file in your workspace.'
      },
      {
        icon: BookOpen,
        title: 'Connected Backlinks',
        text: 'Notes automatically discover all incoming references so you never lose track of related thoughts.'
      },
      {
        icon: Zap,
        title: '3D Interactive Graph',
        text: 'Switch into full 3D Graph mode (Ctrl+G) to orbit, zoom, and explore clusters of connected notes.'
      }
    ],
    preview: PreviewGraph
  },
  {
    badge: 'AI Assistant',
    badgeIcon: Bot,
    title: 'Lumina AI Copilot & Voice',
    subtitle: 'Your personal research partner with local vector indexing and real-time speech dictation.',
    features: [
      {
        icon: Bot,
        title: 'Workspace-Aware Assistant',
        text: 'Lumina reads your notes using local semantic search to synthesize summaries and answer questions.'
      },
      {
        icon: Mic,
        title: 'Live Voice Capsule',
        text: 'Dictate thoughts naturally. The real-time speech capsule streams live transcriptions directly into your active note.'
      },
      {
        icon: Terminal,
        title: 'Instant Shortcut (Ctrl+Shift+\\)',
        text: 'Summon the Lumina AI modal or docked sidebar anytime from anywhere in the app.'
      }
    ],
    preview: PreviewAI
  },
  {
    badge: 'Mail & Canvas',
    badgeIcon: Compass,
    title: 'Mail & Spatial Thinking',
    subtitle: 'Private email and infinite 2D canvas workspace right inside your notebook.',
    features: [
      {
        icon: Compass,
        title: 'Infinite Spatial Canvas',
        text: 'Launch an infinite canvas directly from the ActivityBar to map cards, diagrams, and files.'
      },
      {
        icon: FileText,
        title: 'Lumina Mail Client',
        text: 'Search, read, star, and reply to Gmail messages with rich HTML rendering in a draggable window.'
      },
      {
        icon: Zap,
        title: 'Interactive Breadcrumbs',
        text: 'Navigate folder hierarchies and section outlines seamlessly with keyboard shortcuts.'
      }
    ],
    preview: PreviewMailCanvas
  },
  {
    badge: 'Ready to Start',
    badgeIcon: CheckCircle2,
    title: 'Get Started with Lumina',
    subtitle: 'Start with a clean blank canvas, explore documentation, or load interactive sample notes.',
    features: [
      {
        icon: Zap,
        title: 'Command Palette (Ctrl + P)',
        text: 'Access quick search, open notes, execute actions, and switch themes instantly.'
      },
      {
        icon: FileText,
        title: 'New Note (Ctrl + N)',
        text: 'Create a new note in your active folder or root directory in a fraction of a second.'
      },
      {
        icon: BookOpen,
        title: 'Documentation & Starter Notes',
        text: 'Explore comprehensive guides on Math, Diagrams, linking notes, and keyboard shortcuts.'
      }
    ],
    preview: PreviewReady
  }
]

const Guide: React.FC<GuideProps> = memo(({ isOpen, onClose, onLoadStarterNotes, onOpenDocs }) => {
  const [step, setStep] = useState<number>(0)
  const [isGeneratingNotes, setIsGeneratingNotes] = useState<boolean>(false)
  const isMaximized = useSettingsStore((s: any) => s.settings?.guideModalMaximized ?? false)

  // Single window capture listener (prevents duplicate step advances)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      } else if (e.key === 'ArrowRight') {
        setStep((prev) => Math.min(GUIDE_STEPS.length - 1, prev + 1))
      } else if (e.key === 'ArrowLeft') {
        setStep((prev) => Math.max(0, prev - 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [isOpen, onClose])

  const handleNext = useCallback(() => {
    setStep((prev) => {
      if (prev < GUIDE_STEPS.length - 1) return prev + 1
      onClose()
      return prev
    })
  }, [onClose])

  const handlePrev = useCallback(() => {
    setStep((prev) => (prev > 0 ? prev - 1 : prev))
  }, [])

  const handleOpenDocs = useCallback(() => {
    onClose()
    onOpenDocs?.()
  }, [onClose, onOpenDocs])

  const handleGenerateSamples = useCallback(async () => {
    if (!onLoadStarterNotes || isGeneratingNotes) return
    setIsGeneratingNotes(true)
    try {
      await onLoadStarterNotes()
      onClose()
    } catch (err) {
      console.error('[Guide] Failed to populate starter notes:', err)
    } finally {
      setIsGeneratingNotes(false)
    }
  }, [onLoadStarterNotes, isGeneratingNotes, onClose])

  const handleToggleMaximize = useCallback(() => {
    const { settings, updateSettings } = useSettingsStore.getState() as any
    updateSettings({ guideModalMaximized: !(settings?.guideModalMaximized ?? false) })
  }, [])

  if (!isOpen) return null

  const currentStepData = GUIDE_STEPS[step]
  const PreviewComponent = currentStepData.preview
  const BadgeIcon = currentStepData.badgeIcon

  return createPortal(
    <div className="guide-modal-overlay" onClick={onClose}>
      <div
        className={`guide-modal-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="guide-modal-header docs-modal-header"
          onDoubleClick={handleToggleMaximize}
          style={{ cursor: 'default' }}
        >
          <div className="guide-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-main)',
                letterSpacing: '-0.01em',
                background: 'transparent',
                padding: 0
              }}
            >
              Lumina Guide
            </span>
            <span style={{ opacity: 0.35, color: 'var(--text-muted)', fontSize: '12px' }}>/</span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 450,
                color: 'var(--text-muted)',
                background: 'transparent',
                padding: 0
              }}
            >
              Step {step + 1} of {GUIDE_STEPS.length}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenDocs && (
              <ToolTip text="Documentation (Ctrl + D)" position="bottom">
                <button
                  type="button"
                  className="guide-header-btn"
                  onClick={handleOpenDocs}
                  aria-label="Documentation (Ctrl + D)"
                >
                  <BookOpen size={13} />
                  <span>Docs</span>
                </button>
              </ToolTip>
            )}
            <ToolTip text={isMaximized ? 'Restore Window' : 'Maximize Window'} position="bottom">
              <button
                type="button"
                className="docs-window-btn guide-window-btn"
                onClick={handleToggleMaximize}
                aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
              >
                {isMaximized ? (
                  <Copy size={13} style={{ transform: 'rotate(90deg)' }} />
                ) : (
                  <Square size={13} />
                )}
              </button>
            </ToolTip>
            <ToolTip text="Close (Esc)" position="bottom">
              <button
                type="button"
                className="guide-close-btn"
                onClick={onClose}
                aria-label="Close Guide (Esc)"
              >
                <X size={17} />
              </button>
            </ToolTip>
          </div>
        </div>

        <div className="guide-modal-body">
          <div className="guide-content-col">
            <div className="guide-badge">
              <BadgeIcon size={13} />
              <span>{currentStepData.badge}</span>
            </div>
            <h2 className="guide-step-title">{currentStepData.title}</h2>
            <p className="guide-step-subtitle">{currentStepData.subtitle}</p>

            <div className="guide-features-list">
              {currentStepData.features.map((feat, idx) => {
                const FeatIcon = feat.icon
                return (
                  <div className="guide-feature-item" key={idx}>
                    <FeatIcon size={16} className="guide-feature-icon" />
                    <div>
                      <strong>{feat.title}: </strong>
                      <span>{feat.text}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="guide-preview-col">
            <PreviewComponent />
          </div>
        </div>

        <div className="guide-modal-footer">
          <div className="guide-dots-nav">
            {GUIDE_STEPS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`guide-dot ${idx === step ? 'active' : ''}`}
                onClick={() => setStep(idx)}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          <div className="guide-footer-actions">
            {onOpenDocs && (
              <button
                type="button"
                className="guide-btn guide-btn-secondary"
                onClick={handleOpenDocs}
                aria-label="Documentation (Ctrl + D)"
              >
                <BookOpen size={14} />
                <span>Documentation</span>
              </button>
            )}

            <button
              type="button"
              className="guide-btn guide-btn-secondary"
              onClick={handlePrev}
              disabled={step === 0}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>

            {step === GUIDE_STEPS.length - 1 ? (
              <>
                {onLoadStarterNotes && (
                  <button
                    type="button"
                    className="guide-btn guide-btn-starter"
                    onClick={handleGenerateSamples}
                    disabled={isGeneratingNotes}
                  >
                    <BookOpen size={14} />
                    <span>{isGeneratingNotes ? 'Loading Notes…' : 'Add Sample Notes'}</span>
                  </button>
                )}
                <button type="button" className="guide-btn guide-btn-primary" onClick={onClose}>
                  <CheckCircle2 size={14} />
                  <span>Get Started</span>
                </button>
              </>
            ) : (
              <button type="button" className="guide-btn guide-btn-primary" onClick={handleNext}>
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
})

Guide.displayName = 'Guide'

export default Guide
