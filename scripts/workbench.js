#!/usr/bin/env node

/**
 * Lumina Performance Workbench
 * 
 * Measures performance metrics across the entire codebase:
 * - Main process initialization
 * - Renderer initialization
 * - Vault operations
 * - Search performance
 * - Component render times
 * - Memory usage
 */

import { performance } from 'perf_hooks'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

class PerformanceWorkbench {
  constructor() {
    this.results = {}
    this.startTime = null
  }

  log(message, color = 'reset') {
    console.info(`${colors[color]}${message}${colors.reset}`)
  }

  formatTime(ms) {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`
    if (ms < 1000) return `${ms.toFixed(2)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
  }

  async measure(name, fn) {
    const start = performance.now()
    const memBefore = process.memoryUsage()
    let result
    let error = null

    try {
      result = await fn()
    } catch (err) {
      error = err
    }

    const end = performance.now()
    const memAfter = process.memoryUsage()
    const duration = end - start
    const memDelta = {
      heapUsed: memAfter.heapUsed - memBefore.heapUsed,
      heapTotal: memAfter.heapTotal - memBefore.heapTotal,
      external: memAfter.external - memBefore.external,
      rss: memAfter.rss - memBefore.rss
    }

    this.results[name] = {
      duration,
      memory: memDelta,
      memoryAfter: memAfter,
      error: error?.message,
      success: !error
    }

    const status = error ? '✗' : '✓'
    const statusColor = error ? 'red' : 'green'
    this.log(`  ${status} ${name}: ${this.formatTime(duration)}`, statusColor)
    
    if (error) {
      this.log(`    Error: ${error.message}`, 'red')
    } else if (memDelta.heapUsed > 0) {
      this.log(`    Memory: +${this.formatBytes(memDelta.heapUsed)}`, 'dim')
    }

    return result
  }

  async analyzeCodebase() {
    this.log('\n📊 Analyzing Codebase Structure...', 'cyan')
    
    const stats = {
      totalFiles: 0,
      totalLines: 0,
      byType: {},
      byDirectory: {}
    }

    async function countLines(filePath) {
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        return content.split('\n').length
      } catch {
        return 0
      }
    }

    async function walkDir(dir, baseDir = dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        const relPath = path.relative(baseDir, fullPath)
        
        // Skip node_modules, build, out, .git
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' || 
            entry.name === 'build' || 
            entry.name === 'out' ||
            entry.name === 'dist') {
          continue
        }

        if (entry.isDirectory()) {
          await walkDir(fullPath, baseDir)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name)
          const type = ext || 'no-ext'
          stats.totalFiles++
          stats.byType[type] = (stats.byType[type] || 0) + 1
          
          const dirName = path.dirname(relPath)
          stats.byDirectory[dirName] = (stats.byDirectory[dirName] || 0) + 1
          
          const lines = await countLines(fullPath)
          stats.totalLines += lines
        }
      }
    }

    await walkDir(path.join(projectRoot, 'src'))
    
    this.results.codebase = stats
    this.log(`  ✓ Total files: ${stats.totalFiles}`, 'green')
    this.log(`  ✓ Total lines: ${stats.totalLines.toLocaleString()}`, 'green')
    
    return stats
  }

  async measureFileOperations() {
    this.log('\n📁 Measuring File Operations...', 'cyan')
    
    const testDir = path.join(projectRoot, '.workbench-test')
    const testFile = path.join(testDir, 'test.md')
    
    try {
      // Create test directory
      await this.measure('Create directory', async () => {
        await fs.mkdir(testDir, { recursive: true })
      })

      // Write file
      await this.measure('Write file (1KB)', async () => {
        const content = '# Test\n\n' + 'x'.repeat(1000)
        await fs.writeFile(testFile, content)
      })

      // Read file
      await this.measure('Read file', async () => {
        await fs.readFile(testFile, 'utf-8')
      })

      // Read directory
      await this.measure('Read directory', async () => {
        await fs.readdir(testDir)
      })

      // Stat file
      await this.measure('Stat file', async () => {
        await fs.stat(testFile)
      })

      // Delete file
      await this.measure('Delete file', async () => {
        await fs.unlink(testFile)
      })

      // Cleanup
      await fs.rmdir(testDir)
    } catch (err) {
      this.log(`  ✗ File operations test failed: ${err.message}`, 'red')
    }
  }

  async measureJSONOperations() {
    this.log('\n📄 Measuring JSON Operations...', 'cyan')
    
    const testData = {
      snippets: Array.from({ length: 1000 }, (_, i) => ({
        id: `snippet-${i}`,
        title: `Snippet ${i}`,
        code: `# Snippet ${i}\n\nContent here...`.repeat(10),
        language: 'markdown',
        tags: `tag${i % 10}`,
        timestamp: Date.now() - i * 1000
      }))
    }

    await this.measure('JSON.stringify (1000 items)', async () => {
      return JSON.stringify(testData)
    })

    const jsonString = JSON.stringify(testData)
    
    await this.measure('JSON.parse (1000 items)', async () => {
      return JSON.parse(jsonString)
    })

    await this.measure('JSON.parse + filter', async () => {
      const parsed = JSON.parse(jsonString)
      return parsed.snippets.filter(s => s.language === 'markdown')
    })
  }

  async measureSearchOperations() {
    this.log('\n🔍 Measuring Search Operations...', 'cyan')
    
    // Simulate search index
    const index = Array.from({ length: 5000 }, (_, i) => ({
      id: `chunk-${i}`,
      filePath: `file-${i % 100}.md`,
      text: `This is chunk ${i} with some content about topic ${i % 20}`,
      type: i % 2 === 0 ? 'snippet' : 'note',
      embeddingOffset: i * 384 * 4,
      embeddingLength: 384
    }))

    // Simple text search
    await this.measure('Text search (5000 items)', async () => {
      const query = 'topic 5'
      return index.filter(item => 
        item.text.toLowerCase().includes(query.toLowerCase())
      )
    })

    // Filter by type
    await this.measure('Filter by type (5000 items)', async () => {
      return index.filter(item => item.type === 'snippet')
    })

    // Sort by ID
    await this.measure('Sort array (5000 items)', async () => {
      return [...index].sort((a, b) => a.id.localeCompare(b.id))
    })

    // Map operation
    await this.measure('Map operation (5000 items)', async () => {
      return index.map(item => ({ id: item.id, filePath: item.filePath }))
    })
  }

  async measureStoreOperations() {
    this.log('\n💾 Measuring Store Operations...', 'cyan')
    
    // Simulate Zustand-like store operations
    const store = {
      snippets: [],
      selectedSnippet: null,
      isLoading: false
    }

    // Initialize with data
    const snippets = Array.from({ length: 1000 }, (_, i) => ({
      id: `snippet-${i}`,
      title: `Snippet ${i}`,
      code: `Content ${i}`,
      timestamp: Date.now() - i * 1000
    }))

    await this.measure('Store: Set 1000 snippets', async () => {
      store.snippets = snippets
    })

    await this.measure('Store: Find snippet by ID', async () => {
      return store.snippets.find(s => s.id === 'snippet-500')
    })

    await this.measure('Store: Filter snippets', async () => {
      return store.snippets.filter(s => s.timestamp > Date.now() - 86400000)
    })

    await this.measure('Store: Update snippet', async () => {
      store.snippets = store.snippets.map(s => 
        s.id === 'snippet-500' ? { ...s, title: 'Updated' } : s
      )
    })

    await this.measure('Store: Sort snippets', async () => {
      return [...store.snippets].sort((a, b) => b.timestamp - a.timestamp)
    })
  }

  async measureComponentOperations() {
    this.log('\n⚛️  Measuring Component Operations...', 'cyan')
    
    // Simulate React component operations
    const components = Array.from({ length: 100 }, (_, i) => ({
      id: `component-${i}`,
      props: { title: `Component ${i}`, count: i },
      state: { active: i % 2 === 0 }
    }))

    await this.measure('Component: Map render (100 items)', async () => {
      return components.map(c => ({ ...c, rendered: true }))
    })

    await this.measure('Component: Filter active (100 items)', async () => {
      return components.filter(c => c.state.active)
    })

    await this.measure('Component: Reduce count (100 items)', async () => {
      return components.reduce((sum, c) => sum + c.props.count, 0)
    })
  }

  async measureMarkdownOperations() {
    this.log('\n📝 Measuring Markdown Operations...', 'cyan')
    
    const markdownContent = `# Title

This is a **bold** statement and this is *italic*.

## Section 1

- Item 1
- Item 2
- Item 3

\`\`\`javascript
const code = "example";
\`\`\`

[Link](https://example.com)
`.repeat(100)

    await this.measure('Markdown: Split by lines', async () => {
      return markdownContent.split('\n')
    })

    await this.measure('Markdown: Count words', async () => {
      return markdownContent.trim().split(/\s+/).length
    })

    await this.measure('Markdown: Extract code blocks', async () => {
      const matches = markdownContent.match(/```[\s\S]*?```/g)
      return matches || []
    })

    await this.measure('Markdown: Extract links', async () => {
      const matches = markdownContent.match(/\[([^\]]+)\]\(([^)]+)\)/g)
      return matches || []
    })
  }

  async generateReport() {
    this.log('\n' + '='.repeat(60), 'bright')
    this.log('📊 PERFORMANCE WORKBENCH REPORT', 'bright')
    this.log('='.repeat(60), 'bright')

    // Group results by category
    const categories = {
      'File Operations': Object.keys(this.results).filter(k => 
        k.includes('file') || k.includes('directory') || k.includes('Write') || k.includes('Read')
      ),
      'JSON Operations': Object.keys(this.results).filter(k => 
        k.includes('JSON')
      ),
      'Search Operations': Object.keys(this.results).filter(k => 
        k.includes('search') || k.includes('Filter') || k.includes('Sort')
      ),
      'Store Operations': Object.keys(this.results).filter(k => 
        k.includes('Store')
      ),
      'Component Operations': Object.keys(this.results).filter(k => 
        k.includes('Component')
      ),
      'Markdown Operations': Object.keys(this.results).filter(k => 
        k.includes('Markdown')
      )
    }

    // Summary
    const totalTests = Object.keys(this.results).filter(k => k !== 'codebase').length
    const passedTests = Object.values(this.results)
      .filter(r => r.success !== false)
      .length - 1 // Exclude codebase
    const failedTests = totalTests - passedTests
    const totalTime = Object.values(this.results)
      .filter(r => r.duration)
      .reduce((sum, r) => sum + r.duration, 0)

    this.log(`\n📈 Summary:`, 'cyan')
    this.log(`  Total Tests: ${totalTests}`, 'bright')
    this.log(`  Passed: ${passedTests}`, 'green')
    if (failedTests > 0) {
      this.log(`  Failed: ${failedTests}`, 'red')
    }
    this.log(`  Total Time: ${this.formatTime(totalTime)}`, 'bright')

    // Codebase stats
    if (this.results.codebase) {
      this.log(`\n📁 Codebase:`, 'cyan')
      this.log(`  Files: ${this.results.codebase.totalFiles}`, 'bright')
      this.log(`  Lines: ${this.results.codebase.totalLines.toLocaleString()}`, 'bright')
      
      const topTypes = Object.entries(this.results.codebase.byType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
      this.log(`  Top file types:`, 'dim')
      topTypes.forEach(([type, count]) => {
        this.log(`    ${type}: ${count}`, 'dim')
      })
    }

    // Performance by category
    for (const [category, tests] of Object.entries(categories)) {
      if (tests.length === 0) continue
      
      this.log(`\n${category}:`, 'cyan')
      const categoryTime = tests.reduce((sum, test) => {
        return sum + (this.results[test]?.duration || 0)
      }, 0)
      
      tests.forEach(test => {
        const result = this.results[test]
        if (!result) return
        
        const status = result.success !== false ? '✓' : '✗'
        const color = result.success !== false ? 'green' : 'red'
        this.log(`  ${status} ${test}: ${this.formatTime(result.duration)}`, color)
      })
      this.log(`  Total: ${this.formatTime(categoryTime)}`, 'dim')
    }

    // Memory summary
    const finalMemory = process.memoryUsage()
    this.log(`\n💾 Memory Usage:`, 'cyan')
    this.log(`  Heap Used: ${this.formatBytes(finalMemory.heapUsed)}`, 'bright')
    this.log(`  Heap Total: ${this.formatBytes(finalMemory.heapTotal)}`, 'dim')
    this.log(`  RSS: ${this.formatBytes(finalMemory.rss)}`, 'dim')
    this.log(`  External: ${this.formatBytes(finalMemory.external)}`, 'dim')

    this.log('\n' + '='.repeat(60), 'bright')
  }

  async run() {
    this.startTime = performance.now()
    this.log('\n🚀 Starting Lumina Performance Workbench...\n', 'bright')

    try {
      await this.analyzeCodebase()
      await this.measureFileOperations()
      await this.measureJSONOperations()
      await this.measureSearchOperations()
      await this.measureStoreOperations()
      await this.measureComponentOperations()
      await this.measureMarkdownOperations()

      const totalTime = performance.now() - this.startTime
      this.log(`\n✅ Workbench completed in ${this.formatTime(totalTime)}`, 'green')
      
      await this.generateReport()
    } catch (err) {
      this.log(`\n❌ Workbench failed: ${err.message}`, 'red')
      console.error(err)
      process.exit(1)
    }
  }
}

// Run workbench
const workbench = new PerformanceWorkbench()
workbench.run().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
