import { describe, it, expect } from 'vitest'
import { stripMarkdownFrontmatter } from '../src/shared/frontmatter'

describe('stripMarkdownFrontmatter', () => {
  it('preserves leading blank lines before images, tables, links, and headings', () => {
    const cases = [
      '\n\n\n![diagram](https://example.com/img.png)\nText',
      '\n\n| Col A | Col B |\n| --- | --- |\n| 1 | 2 |',
      '\n\n[OpenAI](https://openai.com)',
      '\n\nhttps://example.com/video',
      '\n\n\n# Heading'
    ]
    for (const input of cases) {
      const { content } = stripMarkdownFrontmatter(input)
      expect(content).toBe(input)
    }
  })

  it('strips standard YAML frontmatter while preserving body leading blank lines', () => {
    const raw = '---\nid: note-1\ntitle: Test\n---\n\n\n![img](a.png)\nBody'
    const { content, yamlBlocks } = stripMarkdownFrontmatter(raw)
    expect(yamlBlocks).toHaveLength(1)
    expect(content).toBe('\n\n![img](a.png)\nBody')
  })

  it('does not treat markdown horizontal rules as YAML frontmatter', () => {
    const raw = '---\n# Not YAML\nSome paragraph\n---\nMore text'
    const { content, yamlBlocks } = stripMarkdownFrontmatter(raw)
    expect(yamlBlocks).toHaveLength(0)
    expect(content).toBe(raw)
  })

  it('preserves 9 leading blank lines when user starts typing on line 10 with YAML frontmatter', () => {
    const nineNewlines = '\n'.repeat(9)
    const raw = `---\nid: note-123\ntitle: My Note\n---\n${nineNewlines}Started on line 10`
    const { content, yamlBlocks } = stripMarkdownFrontmatter(raw)
    expect(yamlBlocks).toHaveLength(1)
    expect(content).toBe(`${nineNewlines}Started on line 10`)
  })

  it('preserves 9 leading blank lines when note has no YAML frontmatter and line 10 has a colon or key-value', () => {
    const nineNewlines = '\n'.repeat(9)
    const raw = `${nineNewlines}title: Note Title on line 10\nsome body`
    const { content, looseLines } = stripMarkdownFrontmatter(raw)
    expect(looseLines).toHaveLength(0)
    expect(content).toBe(raw)
  })
})
