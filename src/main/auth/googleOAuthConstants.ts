import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

function loadEnvConfig(): void {
  try {
    dotenv.config()
    if (process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET) {
      return
    }
    const candidates = [
      path.join(process.cwd(), '.env'),
      path.join(process.cwd(), '.env.local'),
      path.resolve(__dirname, '../../.env'),
      path.resolve(__dirname, '../../../.env')
    ]
    try {
      if (app && typeof app.getAppPath === 'function') {
        candidates.push(path.join(app.getAppPath(), '.env'))
        candidates.push(path.join(path.dirname(app.getAppPath()), '.env'))
      }
    } catch {}

    for (const envPath of candidates) {
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath })
        if (process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET) {
          return
        }
      }
    }
  } catch {}
}

loadEnvConfig()

/**
 * Google OAuth Configuration
 * Reads credentials strictly from environment variables (.env).
 * Never hardcodes secrets in the codebase.
 */

declare const __LUMINA_GOOGLE_CLIENT_SECRET__: string | undefined

const BUILD_TIME_GOOGLE_CLIENT_SECRET =
  typeof __LUMINA_GOOGLE_CLIENT_SECRET__ === 'string' ? __LUMINA_GOOGLE_CLIENT_SECRET__ : ''

export const GOOGLE_DEFAULT_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '736587690312-33s4trbiculu5dvctb92lkl6njgc14ae.apps.googleusercontent.com'

export function getGoogleClientSecret(): string {
  if (!process.env.GOOGLE_CLIENT_SECRET && !process.env.VITE_GOOGLE_CLIENT_SECRET) {
    loadEnvConfig()
  }
  const secret =
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.VITE_GOOGLE_CLIENT_SECRET ||
    BUILD_TIME_GOOGLE_CLIENT_SECRET ||
    ''
  if (!secret) {
    console.warn('[GoogleOAuth] GOOGLE_CLIENT_SECRET is not set in environment or .env')
  }
  return secret
}
