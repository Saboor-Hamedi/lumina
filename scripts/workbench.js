#!/usr/bin/env node

/**
 * Lumina Performance Workbench
 *
 * A comprehensive health dashboard covering:
 * - Codebase structure & metrics
 * - File I/O performance
 * - JSON / data operations
 * - Search simulation
 * - Store operations
 * - Component rendering simulation
 * - Markdown processing
 * - Test suite stats (run count, coverage hint)
 * - Bundle size on disk
 * - Dependency health
 */

import { performance } from 'perf_hooks'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

// ─── ANSI helpers ────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
}
const col = (color, text) => `${c[color]}${text}${c.reset}`
const tick = col('green', '✓')
const cross = col('red', '✗')
const warn = col('yellow', '⚠')

// ─── Utilities ───────────────────────────────────────────────────────────────
function formatTime(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(1)}μs`
  if (ms < 1000) return `${ms.toFixed(2)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatBytes(bytes) {
  if (bytes < 0) return col('red', `-${formatBytes(-bytes)}`)
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
}

function bar(value, max, width = 20) {
  const filled = Math.round((value / max) * width)
  return col('cyan', '█'.repeat(filled)) + col('dim', '░'.repeat(width - filled))
}

function header(title) {
  const line = '─'.repeat(62)
  console.log(`\n${col('bright', line)}`)
  console.log(col('bright', `  ${title}`))
  console.log(col('dim', line))
}

function row(label, value, note = '') {
  const pad = ' '.repeat(Math.max(0, 36 - label.length))
  console.log(`  ${col('white', label)}${pad}${value}${note ? col('dim', '  ' + note) : ''}`)
}

// ─── Measure helper ──────────────────────────────────────────────────────────
const results = []

async function measure(label, fn) {
  const memBefore = process.memoryUsage().heapUsed
  const t0 = performance.now()
  let ok = true
  let errMsg = ''
  try {
    await fn()
  } catch (e) {
    ok = false
    errMsg = e.message
  }
  const duration = performance.now() - t0
  const memDelta = process.memoryUsage().heapUsed - memBefore

  results.push({ label, duration, memDelta, ok, errMsg })

  const status = ok ? tick : cross
  const timeStr = col(duration > 100 ? 'yellow' : 'green', formatTime(duration))
  const memStr = memDelta > 0 ? col('dim', ` +${formatBytes(memDelta)}`) : ''
  console.log(`  ${status} ${label.padEnd(38)} ${timeStr}${memStr}`)
  if (!ok) console.log(`     ${col('red', '↳ ' + errMsg)}`)
  return ok
}

// ─── Section 1: Codebase Analysis ────────────────────────────────────────────
async function analyzeCodebase() {
  header('📁  Codebase Analysis')

  const stats = { files: 0, lines: 0, bytes: 0, byExt: {}, testFiles: 0, testLines: 0 }

  async function walk(dir) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (
        e.name.startsWith('.') ||
        ['node_modules', 'build', 'out', 'dist', '.workbench-test'].includes(e.name)
      )
        continue
      if (e.isDirectory()) {
        await walk(full)
        continue
      }
      if (!e.isFile()) continue

      const ext = path.extname(e.name) || '(none)'
      const content = await fs.readFile(full, 'utf-8').catch(() => '')
      const lines = content.split('\n').length

      stats.files++
      stats.lines += lines
      stats.bytes += Buffer.byteLength(content)
      stats.byExt[ext] = stats.byExt[ext] || { files: 0, lines: 0 }
      stats.byExt[ext].files++
      stats.byExt[ext].lines += lines

      if (
        full.includes(`${path.sep}test${path.sep}`) ||
        e.name.endsWith('.test.js') ||
        e.name.endsWith('.test.jsx')
      ) {
        stats.testFiles++
        stats.testLines += lines
      }
    }
  }

  await walk(path.join(projectRoot, 'src'))
  await walk(path.join(projectRoot, 'test'))
  await walk(path.join(projectRoot, 'scripts'))

  row('Source files', col('bright', stats.files.toString()))
  row('Total lines of code', col('bright', stats.lines.toLocaleString()))
  row('Total source size', col('bright', formatBytes(stats.bytes)))
  row('Test files', col('cyan', stats.testFiles.toString()))
  row('Test lines', col('cyan', stats.testLines.toLocaleString()))

  console.log(`\n  ${col('dim', 'Top file types:')}`)
  Object.entries(stats.byExt)
    .sort((a, b) => b[1].files - a[1].files)
    .slice(0, 6)
    .forEach(([ext, s]) => {
      console.log(
        `    ${col('cyan', ext.padEnd(12))} ${String(s.files).padStart(4)} files   ${String(s.lines.toLocaleString()).padStart(8)} lines`
      )
    })

  return stats
}

// ─── Section 2: Test Suite Stats ─────────────────────────────────────────────
async function analyzeTests() {
  header('🧪  Test Suite Stats')

  // Count test files and it() blocks
  const testDir = path.join(projectRoot, 'test')
  let totalTests = 0
  let totalFiles = 0
  const suites = []

  async function walkTests(dir) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        await walkTests(full)
        continue
      }
      if (!e.name.endsWith('.test.js') && !e.name.endsWith('.test.jsx')) continue

      totalFiles++
      const content = await fs.readFile(full, 'utf-8').catch(() => '')
      const itMatches = content.match(/^\s*it\s*\(/gm) || []
      const count = itMatches.length
      totalTests += count
      suites.push({
        name: e.name.replace(/\.test\.[jt]sx?$/, ''),
        file: path.relative(projectRoot, full),
        count
      })
    }
  }

  await walkTests(testDir)

  row('Test suites', col('bright', totalFiles.toString()))
  row('Total test cases', col('bright', totalTests.toString()))

  console.log(`\n  ${col('dim', 'Suites:')}`)
  suites
    .sort((a, b) => b.count - a.count)
    .forEach((s) => {
      const b = bar(s.count, Math.max(...suites.map((x) => x.count)))
      console.log(
        `    ${col('white', s.name.padEnd(30))} ${b} ${String(s.count).padStart(3)} tests`
      )
    })

  // Run vitest in run mode and capture exit code
  console.log(`\n  ${col('dim', 'Running test suite...')}`)
  let passed = 0,
    failed = 0,
    duration = '?'
  try {
    const out = execSync('npx vitest run 2>&1', {
      cwd: projectRoot,
      timeout: 120000,
      encoding: 'utf-8'
    })
    // Match: 'Tests  5 failed | 112 passed (117)' or 'Tests  117 passed (117)'
    const passMatch = out.match(/Tests\s+(?:\d+\s+failed\s+\|\s+)?(\d+)\s+passed/)
    const failMatch = out.match(/(\d+)\s+failed/)
    const durMatch = out.match(/Duration\s+([\d.]+s)/)
    passed = passMatch ? parseInt(passMatch[1]) : 0
    failed = failMatch ? parseInt(failMatch[1]) : 0
    duration = durMatch ? durMatch[1] : '?'
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '') + (typeof e.output === 'string' ? e.output : '')
    const passMatch = out.match(/Tests\s+(?:\d+\s+failed\s+\|\s+)?(\d+)\s+passed/)
    const failMatch = out.match(/(\d+)\s+failed/)
    const durMatch = out.match(/Duration\s+([\d.]+s)/)
    passed = passMatch ? parseInt(passMatch[1]) : 0
    failed = failMatch ? parseInt(failMatch[1]) : 0
    duration = durMatch ? durMatch[1] : '?'
  }

  const total = passed + failed
  console.log()
  row('Tests passed', col(failed === 0 ? 'green' : 'yellow', `${passed} / ${total}`))
  if (failed > 0) row('Tests failed', col('red', failed.toString()))
  row('Suite duration', col('bright', duration))
}

// ─── Section 3: Bundle size ───────────────────────────────────────────────────
async function analyzeBundleSize() {
  header('📦  Bundle & Dependency Health')

  // Check node_modules size (top-level only, approximate)
  const nmPath = path.join(projectRoot, 'node_modules')
  let totalDeps = 0
  try {
    const entries = await fs.readdir(nmPath, { withFileTypes: true })
    totalDeps = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).length
  } catch {}
  row('Direct node_modules folders', col('bright', totalDeps.toString()))

  // package.json dep counts
  const pkgRaw = await fs
    .readFile(path.join(projectRoot, 'package.json'), 'utf-8')
    .catch(() => '{}')
  const pkg = JSON.parse(pkgRaw)
  const depCount = Object.keys(pkg.dependencies || {}).length
  const devCount = Object.keys(pkg.devDependencies || {}).length
  row('Production dependencies', col('bright', depCount.toString()))
  row('Dev dependencies', col('dim', devCount.toString()))

  // Check if out/ (built) directory exists
  const outPath = path.join(projectRoot, 'out')
  let builtSize = 0
  let builtExists = false
  async function sizeOf(dir) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        await sizeOf(full)
        continue
      }
      const stat = await fs.stat(full).catch(() => null)
      if (stat) builtSize += stat.size
    }
  }
  try {
    await fs.access(outPath)
    builtExists = true
    await sizeOf(outPath)
  } catch {}

  if (builtExists) {
    row('Built bundle size (out/)', col('bright', formatBytes(builtSize)))
  } else {
    row('Built bundle', col('dim', 'not built yet  (run npm run build)'))
  }
}

// ─── Section 4: File I/O Performance ─────────────────────────────────────────
async function measureFileOps() {
  header('📂  File I/O Performance')
  const testDir = path.join(projectRoot, '.workbench-test')
  const testFile = path.join(testDir, 'test.md')

  try {
    await measure('mkdir (recursive)', () => fs.mkdir(testDir, { recursive: true }))
    await measure('write file (1 KB)', () => fs.writeFile(testFile, '# Test\n' + 'x'.repeat(1000)))
    await measure('read file (1 KB)', () => fs.readFile(testFile, 'utf-8'))
    await measure('stat file', () => fs.stat(testFile))
    await measure('readdir', () => fs.readdir(testDir))
    await measure('unlink file', () => fs.unlink(testFile))
    await measure('rmdir', () => fs.rm(testDir, { recursive: true, force: true }))
  } catch (e) {
    console.log(`  ${cross} ${col('red', e.message)}`)
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})
  }
}

// ─── Section 5: Data / JSON ───────────────────────────────────────────────────
async function measureDataOps() {
  header('🗂️   Data & JSON Performance')
  const items = Array.from({ length: 2000 }, (_, i) => ({
    id: `snippet-${i}`,
    title: `Note ${i}`,
    code: `# Snippet ${i}\n\n${'content '.repeat(50)}`,
    language: 'markdown',
    tags: `tag${i % 10}`,
    timestamp: Date.now() - i * 1000
  }))

  let json = ''
  await measure('JSON.stringify (2000 items)', () => {
    json = JSON.stringify(items)
  })
  await measure('JSON.parse (2000 items)', () => JSON.parse(json))
  await measure('Array.filter (2000 items)', () => items.filter((s) => s.language === 'markdown'))
  await measure('Array.sort by timestamp', () =>
    [...items].sort((a, b) => b.timestamp - a.timestamp)
  )
  await measure('Map construction (2000)', () => new Map(items.map((s) => [s.id, s])))
  await measure('Map.get by ID', () => {
    const m = new Map(items.map((s) => [s.id, s]))
    return m.get('snippet-1000')
  })
}

// ─── Section 6: Search ────────────────────────────────────────────────────────
async function measureSearchOps() {
  header('🔍  Search Simulation')
  const index = Array.from({ length: 5000 }, (_, i) => ({
    id: `chunk-${i}`,
    filePath: `file-${i % 100}.md`,
    text: `This is chunk ${i} about topic ${i % 20} with keyword lumina`,
    type: i % 2 === 0 ? 'snippet' : 'note'
  }))

  await measure('Full-text search (5000 chunks)', () =>
    index.filter((x) => x.text.toLowerCase().includes('topic 5'))
  )
  await measure('Filter by type (5000 chunks)', () => index.filter((x) => x.type === 'snippet'))
  await measure('Sort by ID (5000 chunks)', () =>
    [...index].sort((a, b) => a.id.localeCompare(b.id))
  )
  await measure('Regex search (5000 chunks)', () => index.filter((x) => /topic [135]/.test(x.text)))
  await measure('Multi-word AND search (5000)', () => {
    const terms = ['lumina', 'chunk']
    return index.filter((x) => terms.every((t) => x.text.includes(t)))
  })
}

// ─── Section 7: Store simulation ─────────────────────────────────────────────
async function measureStoreOps() {
  header('💾  Store (Zustand-like) Simulation')
  const snippets = Array.from({ length: 1000 }, (_, i) => ({
    id: `snippet-${i}`,
    title: `Snippet ${i}`,
    code: `Content ${i}`,
    timestamp: Date.now() - i * 1000,
    isPinned: i < 5
  }))
  let store = { snippets: [], selected: null }

  await measure('Set 1000 snippets', () => {
    store.snippets = snippets
  })
  await measure('Find by ID', () => store.snippets.find((s) => s.id === 'snippet-500'))
  await measure('Filter pinned', () => store.snippets.filter((s) => s.isPinned))
  await measure('Immutable update snippet', () => {
    store.snippets = store.snippets.map((s) =>
      s.id === 'snippet-500' ? { ...s, title: 'Updated' } : s
    )
  })
  await measure('Sort by timestamp', () =>
    [...store.snippets].sort((a, b) => b.timestamp - a.timestamp)
  )
}

// ─── Section 8: Markdown processing ──────────────────────────────────────────
async function measureMarkdownOps() {
  header('📝  Markdown Processing')
  const md =
    `# Title\n\n**bold** and *italic*.\n\n## Section\n\n- Item 1\n- Item 2\n\n\`\`\`js\nconst x = 1\n\`\`\`\n\n[Link](https://example.com)\n`.repeat(
      100
    )

  await measure('Split by lines', () => md.split('\n'))
  await measure('Count words', () => md.trim().split(/\s+/).length)
  await measure('Extract code blocks', () => md.match(/```[\s\S]*?```/g) || [])
  await measure('Extract links', () => md.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [])
  await measure('Extract headings', () => md.match(/^#{1,6}\s+.+$/gm) || [])
  await measure('Strip markdown syntax', () => md.replace(/[*_`#\[\]()]/g, ''))
}

// ─── Section 9: Summary ──────────────────────────────────────────────────────
function generateSummary(startTime) {
  const totalTime = performance.now() - startTime
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  const slowest = [...results].sort((a, b) => b.duration - a.duration).slice(0, 5)
  const fastest = [...results].sort((a, b) => a.duration - b.duration).slice(0, 3)

  header('📊  Workbench Summary')

  const finalMem = process.memoryUsage()
  row('Total benchmarks run', col('bright', (passed + failed).toString()))
  row('Passed', col('green', passed.toString()))
  if (failed > 0) row('Failed', col('red', failed.toString()))
  row('Total workbench time', col('bright', formatTime(totalTime)))
  row('Process heap used', col('bright', formatBytes(finalMem.heapUsed)))
  row('Process RSS', col('dim', formatBytes(finalMem.rss)))

  if (slowest.length) {
    console.log(`\n  ${col('yellow', 'Slowest operations:')}`)
    slowest.forEach((r) => {
      console.log(
        `    ${col('dim', '•')} ${r.label.padEnd(42)} ${col('yellow', formatTime(r.duration))}`
      )
    })
  }

  if (fastest.length) {
    console.log(`\n  ${col('green', 'Fastest operations:')}`)
    fastest.forEach((r) => {
      console.log(
        `    ${col('dim', '•')} ${r.label.padEnd(42)} ${col('green', formatTime(r.duration))}`
      )
    })
  }

  console.log(`\n${'═'.repeat(62)}\n`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const startTime = performance.now()
console.log(
  `\n${col('bright', '╔══════════════════════════════════════════════════════════════╗')}`
)
console.log(
  `${col('bright', '║')}  ${col('cyan', '⚡  Lumina Performance Workbench')}${' '.repeat(31)}${col('bright', '║')}`
)
console.log(`${col('bright', '╚══════════════════════════════════════════════════════════════╝')}`)

try {
  await analyzeCodebase()
  await analyzeTests() // ← includes running the test suite
  await analyzeBundleSize()
  await measureFileOps()
  await measureDataOps()
  await measureSearchOps()
  await measureStoreOps()
  await measureMarkdownOps()
  generateSummary(startTime)
} catch (err) {
  console.error(`\n${cross} Workbench failed: ${err.message}`)
  console.error(err)
  process.exit(1)
}
