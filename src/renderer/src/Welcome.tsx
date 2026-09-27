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
import { LuminaChatContent } from './features/AI/components/LuminaChatContent'
import './assets/welcome.css'

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
        <LuminaChatContent isSidebar={false} isModal={false} />
      </div>
    </div>
  )
}

export default Welcome
