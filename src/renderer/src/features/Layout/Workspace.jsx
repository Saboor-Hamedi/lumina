/**
 * Workspace.jsx
 * 
 * Top-level Workspace Layout entry point for Lumina.
 * 
 * Re-exports MainLayout as the primary default export and named 'Workspace' export.
 * This component provides a clean, descriptive module name for the application workspace
 * while delegating full layout orchestration, pane division, and modal management to MainLayout.
 */

export { default } from './MainLayout'
export { MainLayout as Workspace } from './MainLayout'
