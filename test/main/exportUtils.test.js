import { describe, it, expect } from 'vitest'
import {
  generateTOC,
  slugifyHeading,
  escapeHtml,
  convertWikilinks
} from '../../src/export/exportUtils'

describe('exportUtils.generateTOC', () => {
  it('injects anchor ids and builds a clickable list', () => {
    const html = '<h1>Intro</h1><p>x</p><h2>Details &amp; Notes</h2><h3>Deep</h3>'
    const { html: out, toc, count } = generateTOC(html)

    expect(count).toBe(3)
    expect(out).toContain('id="toc-0-intro"')
    expect(out).toContain('id="toc-1-details-amp-notes"')
    expect(out).toContain('id="toc-2-deep"')
    expect(toc).toContain('href="#toc-0-intro"')
    expect(toc).toContain('class="toc-l3"')
  })

  it('returns empty toc when there are no headings', () => {
    const { toc, count, html } = generateTOC('<p>just text</p>')
    expect(count).toBe(0)
    expect(toc).toBe('')
    expect(html).toBe('<p>just text</p>')
  })

  it('respects maxLevel', () => {
    const html = '<h1>A</h1><h2>B</h2><h4>C</h4>'
    const { count } = generateTOC(html, { maxLevel: 2 })
    expect(count).toBe(2)
  })

  it('handles empty / non-string input safely', () => {
    expect(generateTOC('').count).toBe(0)
    expect(generateTOC(null).count).toBe(0)
    expect(generateTOC(undefined).count).toBe(0)
  })

  it('escapes heading text in the table of contents', () => {
    const { toc } = generateTOC('<h1>Tom & Jerry</h1>')
    expect(toc).toContain('Tom &amp; Jerry')
  })
})

describe('exportUtils.slugifyHeading', () => {
  it('lowercases, strips punctuation and hyphenates', () => {
    expect(slugifyHeading('Hello, World!')).toBe('hello-world')
  })

  it('strips inline markup', () => {
    expect(slugifyHeading('<code>foo</code> bar')).toBe('foo-bar')
  })
})

describe('exportUtils.escapeHtml', () => {
  it('escapes special characters', () => {
    expect(escapeHtml('<b>"a" & \'b\'</b>')).toBe(
      '&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;'
    )
  })
})

describe('exportUtils.convertWikilinks', () => {
  it('converts to span by default', () => {
    expect(convertWikilinks('See [[Note]]')).toContain('<span class="wikilink">Note</span>')
  })

  it('converts to anchor in link mode', () => {
    expect(convertWikilinks('See [[Note]]', 'link')).toContain('<a href="#">Note</a>')
  })
})
