/**
 * =========================================================================
 * Workspace Layout Module (`workspace.ts`)
 * =========================================================================
 *
 * Top-level Workspace Layout entry point for Lumina.
 *
 * Re-exports `MainLayout` as the default export and named `Workspace` export,
 * providing a clear, semantic module alias for the application workspace
 * while delegating full layout orchestration, pane division, and modal
 * management to `MainLayout`.
 * =========================================================================
 */

export { default } from './MainLayout'
export { MainLayout as Workspace } from './MainLayout'
