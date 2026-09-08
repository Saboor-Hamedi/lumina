import React, { useState, useEffect } from 'react'
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
  Workflow
} from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import './css/guide.css'

/**
 * Visual Preview for Step 0: Local-First Workspace
 */
const PreviewWelcome = () => (
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
)

/**
 * Visual Preview for Step 1: Markdown & KaTeX Math
 */
const PreviewEditor = () => (
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
)

/**
 * Visual Preview for Step 2: Knowledge Graph
 */
const PreviewGraph = () => (
  <div className="preview-card">
    <div className="preview-top-bar">
      <div className="preview-dot red" />
      <div className="preview-dot yellow" />
      <div className="preview-dot green" />
      <span className="preview-top-title">2D / 3D Knowledge Graph</span>
    </div>
    <div className="preview-step-2">
      <svg viewBox="0 0 200 120" className="graph-preview-svg">
        {/* Edge Lines */}
        <line x1="40" y1="60" x2="100" y2="35" stroke="rgba(64, 186, 250, 0.4)" strokeWidth="1.5" strokeDasharray="3 3" />
        <line x1="100" y1="35" x2="160" y2="55" stroke="rgba(64, 186, 250, 0.4)" strokeWidth="1.5" />
        <line x1="100" y1="35" x2="100" y2="95" stroke="rgba(168, 85, 247, 0.5)" strokeWidth="2" />
        <line x1="40" y1="60" x2="100" y2="95" stroke="rgba(64, 186, 250, 0.3)" strokeWidth="1.5" />
        <line x1="160" y1="55" x2="100" y2="95" stroke="rgba(64, 186, 250, 0.3)" strokeWidth="1.5" />

        {/* Nodes */}
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
)

/**
 * Visual Preview for Step 3: AI Copilot & Voice
 */
const PreviewAI = () => (
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
)

/**
 * Visual Preview for Step 4: Ready to Start
 */
const PreviewReady = () => (
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
)

const GUIDE_STEPS = [
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

/**
 * Interactive Guide Modal
 *
 * Provides a multi-step onboarding carousel with feature walkthroughs,
 * interactive mockups, step indicators, and sample notes generation.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {() => void} props.onClose - Function to close the modal.
 * @param {() => Promise<void>} [props.onLoadStarterNotes] - Optional callback to generate starter notes.
 * @param {() => void} [props.onOpenDocs] - Optional callback to open the Documentation modal.
 */
const Guide = ({ isOpen, onClose, onLoadStarterNotes, onOpenDocs }) => {
  const [step, setStep] = useState(0)
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false)

  // Keyboard navigation: Escape to close, Arrow keys for step navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
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
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      document.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [isOpen, onClose])

  const handleNext = () => {
    if (step < GUIDE_STEPS.length - 1) {
      setStep((prev) => prev + 1)
    } else {
      onClose()
    }
  }

  const handlePrev = () => {
    if (step > 0) {
      setStep((prev) => prev - 1)
    }
  }

  const handleOpenDocs = () => {
    onClose()
    if (onOpenDocs) {
      onOpenDocs()
    }
  }

  const handleGenerateSamples = async () => {
    if (onLoadStarterNotes && !isGeneratingNotes) {
      setIsGeneratingNotes(true)
      try {
        await onLoadStarterNotes()
        onClose()
      } catch (err) {
        console.error('[Guide] Failed to populate starter notes:', err)
      } finally {
        setIsGeneratingNotes(false)
      }
    }
  }

  if (!isOpen) return null

  const currentStepData = GUIDE_STEPS[step]
  const PreviewComponent = currentStepData.preview
  const BadgeIcon = currentStepData.badgeIcon

  return createPortal(
    <div className="guide-modal-overlay" onClick={onClose}>
      <div className="guide-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="guide-modal-header">
          <div className="guide-header-left">
            <div className="guide-logo-badge">
              <Compass size={16} />
            </div>
            <div className="guide-header-title">Lumina Guide</div>
            <span className="guide-step-counter">
              Step {step + 1} of {GUIDE_STEPS.length}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onOpenDocs && (
              <ToolTip text="Documentation (Ctrl + D)" position="bottom">
                <button
                  className="guide-btn guide-btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                  onClick={handleOpenDocs}
                  aria-label="Documentation (Ctrl + D)"
                >
                  <BookOpen size={13} />
                  <span>Docs</span>
                </button>
              </ToolTip>
            )}
            <ToolTip text="Close (Esc)" position="bottom">
              <button
                className="guide-close-btn"
                onClick={onClose}
                aria-label="Close Guide (Esc)"
              >
                <X size={18} />
              </button>
            </ToolTip>
          </div>
        </div>

        {/* Body */}
        <div className="guide-modal-body">
          {/* Left Column: Description & Features */}
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

          {/* Right Column: Visual Preview Mockup */}
          <div className="guide-preview-col">
            <PreviewComponent />
          </div>
        </div>

        {/* Footer */}
        <div className="guide-modal-footer">
          {/* Step Indicator Dots */}
          <div className="guide-dots-nav">
            {GUIDE_STEPS.map((_, idx) => (
              <button
                key={idx}
                className={`guide-dot ${idx === step ? 'active' : ''}`}
                onClick={() => setStep(idx)}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="guide-footer-actions">
            {onOpenDocs && (
              <button
                className="guide-btn guide-btn-secondary"
                onClick={handleOpenDocs}
                aria-label="Documentation (Ctrl + D)"
              >
                <BookOpen size={14} />
                <span>Documentation</span>
              </button>
            )}

            <button
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
                    className="guide-btn guide-btn-starter"
                    onClick={handleGenerateSamples}
                    disabled={isGeneratingNotes}
                  >
                    <BookOpen size={14} />
                    <span>{isGeneratingNotes ? 'Loading Notes…' : 'Add Sample Notes'}</span>
                  </button>
                )}
                <button className="guide-btn guide-btn-primary" onClick={onClose}>
                  <CheckCircle2 size={14} />
                  <span>Get Started</span>
                </button>
              </>
            ) : (
              <button className="guide-btn guide-btn-primary" onClick={handleNext}>
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
}

export default Guide
