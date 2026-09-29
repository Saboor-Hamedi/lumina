/**
 * ============================================================================
 * Lumina Application Architecture
 * ============================================================================
 * 
 * Aggregates core application subsystems:
 * - `protocolManager`: Custom URI protocols (`asset://`) and web filters.
 * - `windowManager`: Main BrowserWindow lifecycle, geometry, and safety.
 * - `lifecycleManager`: Startup bootstrapping, service coordination, shutdown.
 * - `crashReporter`: Centralized uncaught exception and crash diagnostics.
 */

export * from './protocolManager'
export * from './windowManager'
export * from './lifecycleManager'
export * from './crashReporter'
