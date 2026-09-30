/**
 * ============================================================================
 * Mermaid Runtime Loader (`mermaidRuntime.ts`)
 * ============================================================================
 * Locates the app's bundled Mermaid build and produces a `<script src>` tag
 * pointing at a local file. This lets previews/PDFs render diagrams fully
 * offline WITHOUT inlining JavaScript into HTML (inlined JS can contain
 * `<!--` / `</script>` sequences that break HTML parsing).
 *
 * Falls back to a CDN tag only if the local build cannot be resolved.
 * ============================================================================
 */

import fsSync from 'fs'
import path from 'path'
import { app } from 'electron'

const CDN_FALLBACK =
  '<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>'

/**
 * Resolves the on-disk path to the locally installed Mermaid build.
 */
export function resolveMermaidPath(): string | null {
  const bases: string[] = []
  try {
    bases.push(app.getAppPath())
  } catch {
    /* app not ready */
  }
  bases.push(process.cwd())

  for (const base of bases) {
    const candidate = path.join(base, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js')
    try {
      if (fsSync.existsSync(candidate)) return candidate
    } catch {
      /* ignore */
    }
  }
  return null
}

/** The CDN `<script>` tag used when no local Mermaid build is available. */
export function mermaidCdnFallback(): string {
  return CDN_FALLBACK
}

const CDN_MERMAID_RE = /<script\b[^>]*src=["'][^"']*mermaid[^"']*["'][^>]*>\s*<\/script>/i

/**
 * Replaces the CDN Mermaid placeholder with the provided script tag, or appends
 * it before `</body>` when no placeholder exists.
 */
export function injectMermaidScript(html: string, scriptTag: string): string {
  if (CDN_MERMAID_RE.test(html)) return html.replace(CDN_MERMAID_RE, scriptTag)
  return html.replace(/<\/body>/i, `${scriptTag}\n</body>`)
}

/**
 * Removes every `<script>` tag that references Mermaid (runtime + init) so the
 * rendered document sent to the preview iframe stays small.
 */
export function stripMermaidScripts(html: string): string {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (tag) =>
    /mermaid/i.test(tag) ? '' : tag
  )
}
