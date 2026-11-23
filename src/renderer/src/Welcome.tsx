/**
 * =========================================================================
 * Welcome Component (`Welcome.tsx`)
 * =========================================================================
 *
 * Full-fidelity Lumina AI Welcome & Thinking Workspace.
 * When no document tabs are open, Lumina AI takes center stage:
 * - Session history sidebar for exploring past conversations.
 * - Sleek AI session header with history toggle, title, new chat,
 *   telemetry analytics dropdown popover, clear chat, and "Open as Tab".
 * - Clean interactive chat stage with prompt cards and markdown rendering.
 *
 * Fully typed in TypeScript for maximum performance and stability.
 * =========================================================================
 */

import React from 'react'
import { PulseLoader } from './components/PulseLoader'
import './assets/welcome.css'

const LuminaChatContent = React.lazy(() =>
  import('./features/AI/components/LuminaChatContent').then((m) => ({
    default: m.LuminaChatContent
  }))
)

export interface WelcomeProps {
  /** Callback triggered to create a new note */
  onNew?: () => void
  /** Callback triggered to open the documentation panel or view */
  onOpenDocs?: () => void
  /** Callback triggered to open the Lumina interactive guide */
  onOpenGuide?: () => void
  /** Callback triggered to toggle open/close the Lumina AI chat drawer */
  onToggleAIChat?: () => void
  /** Callback to load starter notes */
  onLoadStarterWorkspace?: () => void
}

export const Welcome: React.FC<WelcomeProps> = () => {
  return (
    <div className="welcome-page lumina-welcome-workspace">
      <div className="welcome-chat-stage">
        <React.Suspense
          fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <PulseLoader size="md" />
            </div>
          }
        >
          <LuminaChatContent isSidebar={false} isModal={false} />
        </React.Suspense>
      </div>
    </div>
  )
}

export default Welcome
