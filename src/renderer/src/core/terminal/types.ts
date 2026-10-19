// components/terminal/types.ts
// Shared type definitions for the Lumina terminal module.

export type SessionStatus = 'idle' | 'running' | 'exited' | 'killed'

export interface TerminalSession {
  /** Stable unique id for the session */
  id: string
  /** User-visible name (renameable) */
  name: string
  /** Shell binary to launch (auto-detected if omitted) */
  shell: string
  /** Working directory at spawn time */
  cwd: string
  /** Lifecycle state */
  status: SessionStatus
  /** When the session was created */
  createdAt: number
  /** Exit code when the session has exited */
  exitCode?: number
}

export interface CreateSessionInput {
  name?: string
  shell?: string
  cwd?: string
}

export type SessionAction = 'rename' | 'kill' | 'delete' | 'close' | 'duplicate'

export interface SessionActionPayload {
  id: string
  action: SessionAction
  value?: string
}
