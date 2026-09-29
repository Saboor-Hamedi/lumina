import { z } from 'zod'

/**
 * ============================================================================
 * Lumina IPC Input Validation Layer
 * ============================================================================
 * 
 * Provides runtime validation for IPC payloads coming from the renderer process
 * using Zod schemas. This ensures that:
 * 1. Malformed or unexpected payloads from the renderer fail gracefully
 *    with clear error messages instead of causing main-process crashes.
 * 2. IPC handlers receive clean, strongly-typed arguments.
 * 3. Any tampering or corrupted state is trapped before hitting disk or managers.
 */

/**
 * Validates untrusted IPC data against a Zod schema.
 * 
 * @param schema - The Zod schema to enforce
 * @param data - The raw, untrusted data received over the IPC channel
 * @returns The strongly-typed, sanitized data if validation passes
 * @throws An Error with descriptive issue details if validation fails
 */
export function validateIpc<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ')
    console.warn(`[IPC Validation Failed]: ${errorDetails}`)
    throw new Error(`Invalid IPC payload: ${errorDetails}`)
  }
  return result.data
}

export { z }
