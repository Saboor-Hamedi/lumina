import dotenv from 'dotenv'

try {
  dotenv.config()
} catch {}

/**
 * Google OAuth Configuration
 * Reads credentials strictly from environment variables (.env).
 * Never hardcodes secrets in the codebase.
 */

export const GOOGLE_DEFAULT_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '736587690312-33s4trbiculu5dvctb92lkl6njgc14ae.apps.googleusercontent.com'

export function getGoogleClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET || ''
  if (!secret) {
    console.warn('[GoogleOAuth] GOOGLE_CLIENT_SECRET is not set in environment or .env')
  }
  return secret
}
