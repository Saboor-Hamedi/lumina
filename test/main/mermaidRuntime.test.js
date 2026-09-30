import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getAppPath: () => process.cwd() } }))

import {
  resolveMermaidPath,
  injectMermaidScript,
  stripMermaidScripts,
  mermaidCdnFallback
} from '../../src/export/mermaidRuntime'

describe('mermaidRuntime.resolveMermaidPath', () => {
  it('finds the locally installed mermaid build', () => {
    const p = resolveMermaidPath()
    expect(p).toBeTruthy()
    expect(String(p).replace(/\\/g, '/')).toContain('node_modules/mermaid/dist/mermaid.min.js')
  })
})

describe('mermaidRuntime.injectMermaidScript', () => {
  it('replaces the CDN placeholder with the local script tag', () => {
    const html =
      '<head><script src="https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"></script></head><body></body>'
    const out = injectMermaidScript(html, '<script src="mermaid.min.js"></script>')
    expect(out).toContain('<script src="mermaid.min.js"></script>')
    expect(out).not.toContain('cdn.jsdelivr.net')
  })

  it('appends before </body> when there is no placeholder', () => {
    const out = injectMermaidScript(
      '<body><p>x</p></body>',
      '<script src="mermaid.min.js"></script>'
    )
    expect(out).toContain('<script src="mermaid.min.js"></script>')
    expect(out.indexOf('mermaid.min.js')).toBeLessThan(out.lastIndexOf('</body>'))
  })
})

describe('mermaidRuntime.stripMermaidScripts', () => {
  it('removes mermaid scripts but keeps unrelated scripts', () => {
    const html =
      '<body><script src="mermaid.min.js"></script><script>window.keep = 1</script></body>'
    const out = stripMermaidScripts(html)
    expect(out).not.toContain('mermaid')
    expect(out).toContain('window.keep = 1')
  })

  it('removes inline mermaid init scripts', () => {
    const html = '<body><script>mermaid.initialize({})</script></body>'
    expect(stripMermaidScripts(html)).not.toContain('mermaid')
  })
})

describe('mermaidRuntime.mermaidCdnFallback', () => {
  it('returns a mermaid CDN script tag', () => {
    expect(mermaidCdnFallback()).toContain('mermaid')
  })
})
