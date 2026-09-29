/**
 * ============================================================================
 * Lumina AI Prompt Builder Facade
 * ============================================================================
 * 
 * Central facade re-exporting all prompt construction modules:
 * - Mention & file resolution (`resolveMentions`, `resolveReferencedFiles`, `normalizeTitle`)
 * - Workspace vector RAG & credential sanitization (`retrieveWorkspaceRAG`, `sanitizeSafeSettings`, `truncateForContext`)
 * - Mode instructions & system directives (`buildSettingsAwarenessBlock`, `buildLuminaIntelligenceBlock`)
 * - System prompt composition (`buildSystemPrompt`)
 */

export * from './prompt'
