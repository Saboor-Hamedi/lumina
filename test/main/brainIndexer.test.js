import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { BrainIndexer } from '../../src/main/workspace/brainIndexer'

describe('BrainIndexer (Main Process)', () => {
  let tempDir
  let tempBrainDir
  let indexer

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-brain-test-'))
    tempBrainDir = path.join(tempDir, 'brain')
    await fs.mkdir(tempBrainDir, { recursive: true })

    indexer = new BrainIndexer()
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (_) {}
  })

  it('handles missing or non-existent brain folder gracefully without throwing', async () => {
    const emptyUserData = path.join(tempDir, 'empty-userdata')
    await fs.mkdir(emptyUserData, { recursive: true })

    await expect(indexer.init(emptyUserData)).resolves.not.toThrow()
    const stats = indexer.getStats()
    expect(stats.totalFiles).toBe(0)
    expect(stats.totalChunks).toBe(0)

    const searchResults = await indexer.search('shortcuts')
    expect(searchResults).toEqual([])
  })

  it('dynamically discovers markdown files and chunks by headings', async () => {
    const docPath = path.join(tempBrainDir, 'test-guide.md')
    const content = `# Test Guide

Overview of the test system.

## Features & Shortcuts

Here are the key shortcuts:
Ctrl+Shift+P opens palette.

### Layout Details

32px header alignment is strictly required.
`
    await fs.writeFile(docPath, content, 'utf-8')

    // Mock resolveBrainDirectory to return our tempBrainDir
    indexer.resolveBrainDirectory = () => tempBrainDir
    await indexer.init(tempDir)

    const result = await indexer.indexBrain(true)
    expect(result.totalFiles).toBe(1)
    expect(result.totalChunks).toBeGreaterThanOrEqual(2)

    const stats = indexer.getStats()
    expect(stats.totalFiles).toBe(1)
    expect(stats.totalChunks).toBeGreaterThanOrEqual(2)
  })

  it('keyword ranking correctly boosts matching headings and breadcrumbs', async () => {
    const docPath = path.join(tempBrainDir, 'specs.md')
    const content = `# Specifications

System architecture specifications.

## Three-Pane Layout Architecture

The flex-row layout consists of sidebar, resizers, and main editor.
32px header rule must be preserved.

## Theme Engine

67 theme definitions are supported without label backgrounds.
`
    await fs.writeFile(docPath, content, 'utf-8')

    indexer.resolveBrainDirectory = () => tempBrainDir
    await indexer.init(tempDir)
    await indexer.indexBrain(true)

    // Search for three-pane layout
    const results = await indexer.search('three-pane layout', { threshold: 0.05, limit: 3 })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].heading).toContain('Three-Pane Layout Architecture')
  })
})
