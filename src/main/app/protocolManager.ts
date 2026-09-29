/**
 * ============================================================================
 * Lumina Protocol & Network Manager
 * ============================================================================
 * 
 * Manages custom URL schemes, disk cache configuration, and development request
 * filters for the main Electron process:
 * 
 * 1. Privileged Scheme Registration:
 *    - `asset://`: Configured as standard, secure, fetch-enabled, and CORS-friendly
 *      before `app.whenReady()` to allow loading workspace media seamlessly.
 * 
 * 2. Asset Protocol Handler:
 *    - Serves workspace images, attachments, and PDFs via `asset://local/...`.
 *    - Enforces strict path traversal checks to guarantee assets cannot resolve
 *      outside the user's active workspace directory.
 *    - Direct binary streaming with correct MIME type detection.
 * 
 * 3. Network & Dev Request Filters:
 *    - Permissive CORS proxying for local AI (Ollama on :11434).
 *    - Silences non-critical Chromium cache and quota warnings in dev mode.
 */

import electron, { app, protocol, session } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import WorkspaceManager from '../workspace/workspaceManager'

/**
 * Registers custom URL schemes as privileged.
 * Must be executed before Electron's `app.whenReady()` lifecycle event.
 */
export function registerPrivilegedSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'asset',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        bypassCSP: true,
        corsEnabled: true
      }
    }
  ])
}

/**
 * Configures disk cache limits and paths for development.
 * Must be executed before `app.whenReady()`.
 */
export function configureAppCache(): void {
  if (!app.isPackaged) {
    const cachePath = path.join(app.getPath('userData'), 'cache')
    app.commandLine.appendSwitch('disk-cache-dir', cachePath)
    app.commandLine.appendSwitch('disk-cache-size', '52428800') // 50MB
  }
}

/**
 * Registers the `asset://` protocol handler to safely stream local workspace
 * images and documents into renderer img tags and iframes.
 */
export function registerAssetProtocol(): void {
  protocol.handle('asset', async (request) => {
    try {
      const parsedUrl = new URL(request.url)
      let relativePath = ''

      if (parsedUrl.hostname === 'local') {
        // Standard URL format: asset://local/.lumina/assets/image.png
        relativePath = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''))
      } else {
        // Legacy fallback format: asset://image.png
        const fallbackUrl = request.url.replace('asset://', '').replace('asset:///', '')
        relativePath = decodeURIComponent(fallbackUrl.replace(/^\/+/, ''))
      }

      if (!WorkspaceManager.workspacePath || !relativePath) {
        return new Response('Workspace not open', { status: 404 })
      }

      const workspaceRoot = path.resolve(WorkspaceManager.workspacePath)
      const finalPath = path.resolve(workspaceRoot, relativePath)

      // Strict containment check: prevent path traversal attacks outside workspace
      if (!finalPath.startsWith(workspaceRoot + path.sep) && finalPath !== workspaceRoot) {
        console.warn('[Protocol] Blocked path traversal attempt:', relativePath)
        return new Response('Access Denied: Path Traversal Forbidden', { status: 403 })
      }

      // Read file directly from disk
      const data = await fs.readFile(finalPath)

      const ext = path.extname(finalPath).toLowerCase()
      let mimeType = 'image/png'
      if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'
      else if (ext === '.gif') mimeType = 'image/gif'
      else if (ext === '.webp') mimeType = 'image/webp'
      else if (ext === '.svg') mimeType = 'image/svg+xml'
      else if (ext === '.pdf') mimeType = 'application/pdf'

      const arrayBuffer = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      return new Response(arrayBuffer, {
        headers: { 'Content-Type': mimeType }
      })
    } catch (error) {
      console.error('[Protocol] Asset fetch error:', error)
      return new Response('Not Found', { status: 404 })
    }
  })
}

/**
 * Sets up development network filters and console suppressions.
 * Allows renderer to communicate directly with local Ollama (:11434).
 */
export function setupDevWebRequestFilters(): void {
  // Allow renderer process to communicate directly with local Ollama (:11434) without CORS issues
  if (session && session.defaultSession && session.defaultSession.webRequest) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      if (details.url && details.url.includes(':11434')) {
        const responseHeaders = { ...details.responseHeaders }
        responseHeaders['access-control-allow-origin'] = ['*']
        responseHeaders['access-control-allow-methods'] = ['GET, POST, OPTIONS, PUT, DELETE']
        responseHeaders['access-control-allow-headers'] = ['*']
        callback({ responseHeaders })
        return
      }
      callback({ responseHeaders: details.responseHeaders })
    })
  }

  // Suppress harmless Chromium cache/quota warning console messages in development
  if (!app.isPackaged) {
    const originalConsoleError = console.error
    console.error = (...args: any[]) => {
      const message = args.join(' ')
      if (
        message.includes('disk_cache') ||
        message.includes('quota_database') ||
        message.includes('Unable to move the cache') ||
        message.includes('Unable to create cache') ||
        message.includes('Could not open the quota database')
      ) {
        return
      }
      originalConsoleError.apply(console, args)
    }
  }
}
