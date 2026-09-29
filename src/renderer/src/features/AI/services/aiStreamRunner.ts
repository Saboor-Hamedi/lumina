/**
 * ============================================================================
 * AI Stream Runner Facade
 * ============================================================================
 * 
 * Re-exports all streaming and execution modules for backward compatibility:
 * - Vercel AI SDK text streaming (`runDeepSeekStream`, `ensureAISdk`)
 * - Fallback provider streaming (`runFallbackProviderStream`)
 * - Legacy markdown code block parser (`applyLegacyMarkdownBlocks`)
 * - Realtime UI cards & badge builder (`buildRealtimeDisplay`, `getToolStatusDescription`, `getToolResultThought`)
 * - Tool call interception & markup cleaning (`cleanRawToolLeaks`, `parseAndExecuteDSML`)
 */

export * from './streaming'
