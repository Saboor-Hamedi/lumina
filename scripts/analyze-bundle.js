#!/usr/bin/env node

/**
 * Bundle Size Analysis Script
 * 
 * Analyzes the production build to identify large dependencies and optimization opportunities.
 * Provides actionable recommendations for reducing bundle size and improving performance.
 * 
 * Usage:
 *   npm run analyze:bundle
 * 
 * @module analyze-bundle
 */

import { readFileSync, existsSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Analyze package.json to extract dependency information
 * @returns {Object|null} Dependency information or null if package.json not found
 */
function analyzePackageJson() {
  const packageJsonPath = join(projectRoot, 'package.json')
  if (!existsSync(packageJsonPath)) {
    console.error(`${colors.red}Error: package.json not found${colors.reset}`)
    return null
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
    
    return {
      dependencies,
      totalDeps: Object.keys(dependencies).length,
      prodDeps: Object.keys(packageJson.dependencies || {}).length,
      devDeps: Object.keys(packageJson.devDependencies || {}).length
    }
  } catch (error) {
    console.error(`${colors.red}Error reading package.json:${colors.reset}`, error.message)
    return null
  }
}

function analyzeBuildOutput() {
  const distPath = join(projectRoot, 'dist')
  const outPath = join(projectRoot, 'out')
  
  const results = {
    dist: null,
    out: null
  }

  // Check for Vite build stats
  const statsPath = join(distPath, 'stats.html')
  if (existsSync(statsPath)) {
    results.dist = { statsFile: statsPath }
  }

  // Check for Electron build output
  if (existsSync(outPath)) {
    const mainPath = join(outPath, 'main')
    const preloadPath = join(outPath, 'preload')
    const rendererPath = join(outPath, 'renderer')
    
    results.out = {
      main: existsSync(mainPath),
      preload: existsSync(preloadPath),
      renderer: existsSync(rendererPath)
    }
  }

  return results
}

function getLargeDependencies() {
  const packageJson = analyzePackageJson()
  if (!packageJson) return []

  // Known large dependencies to flag
  const largeDeps = [
    '@xenova/transformers', // AI/ML models
    'react-force-graph-2d', // Graph visualization
    'codemirror', // Editor
    '@codemirror',
    'react-markdown', // Markdown rendering
    'highlight.js', // Syntax highlighting
    'pdf-lib', // PDF generation
    'better-sqlite3', // Database
    'electron' // Electron runtime
  ]

  return packageJson.dependencies
    ? Object.keys(packageJson.dependencies).filter(dep => 
        largeDeps.some(large => dep.includes(large))
      )
    : []
}

function generateReport() {
  console.log(`${colors.bright}${colors.cyan}╔══════════════════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}║        Bundle Size Analysis Report                      ║${colors.reset}`)
  console.log(`${colors.bright}${colors.cyan}╚══════════════════════════════════════════════════════════╝${colors.reset}\n`)

  // Package.json analysis
  const packageInfo = analyzePackageJson()
  if (packageInfo) {
    console.log(`${colors.bright}Dependencies:${colors.reset}`)
    console.log(`  Total: ${colors.green}${packageInfo.totalDeps}${colors.reset} packages`)
    console.log(`  Production: ${colors.cyan}${packageInfo.prodDeps}${colors.reset}`)
    console.log(`  Development: ${colors.cyan}${packageInfo.devDeps}${colors.reset}\n`)
  }

  // Large dependencies
  const largeDeps = getLargeDependencies()
  if (largeDeps.length > 0) {
    console.log(`${colors.bright}${colors.yellow}⚠ Large Dependencies Detected:${colors.reset}`)
    largeDeps.forEach(dep => {
      console.log(`  • ${colors.yellow}${dep}${colors.reset}`)
    })
    console.log('')
  }

  // Build output analysis
  const buildInfo = analyzeBuildOutput()
  console.log(`${colors.bright}Build Output:${colors.reset}`)
  if (buildInfo.dist?.statsFile) {
    console.log(`  ${colors.green}✓${colors.reset} Vite stats available: ${buildInfo.dist.statsFile}`)
    console.log(`    ${colors.blue}→${colors.reset} Open in browser to view detailed bundle analysis`)
  } else {
    console.log(`  ${colors.yellow}⚠${colors.reset} No build stats found. Run: ${colors.cyan}npm run build${colors.reset}`)
  }

  if (buildInfo.out) {
    const { main, preload, renderer } = buildInfo.out
    console.log(`  ${main ? colors.green + '✓' : colors.red + '✗'}${colors.reset} Main process`)
    console.log(`  ${preload ? colors.green + '✓' : colors.red + '✗'}${colors.reset} Preload scripts`)
    console.log(`  ${renderer ? colors.green + '✓' : colors.red + '✗'}${colors.reset} Renderer process`)
  } else {
    console.log(`  ${colors.yellow}⚠${colors.reset} No build output found`)
  }

  console.log('')

  // Recommendations
  console.log(`${colors.bright}${colors.magenta}Optimization Recommendations:${colors.reset}`)
  console.log(`  1. ${colors.cyan}Code Splitting:${colors.reset} Use dynamic imports for heavy components`)
  console.log(`     • GraphNexus, AIChatPanel, MarkdownEditor`)
  console.log(`  2. ${colors.cyan}Tree Shaking:${colors.reset} Ensure unused code is eliminated`)
  console.log(`     • Check for unused imports in components`)
  console.log(`  3. ${colors.cyan}Lazy Loading:${colors.reset} Load AI models on-demand`)
  console.log(`     • @xenova/transformers can be loaded when needed`)
  console.log(`  4. ${colors.cyan}Bundle Analysis:${colors.reset} Run ${colors.cyan}npm run analyze${colors.reset}`)
  console.log(`     • Opens visual bundle analyzer in browser`)
  console.log('')

  // Performance tips
  console.log(`${colors.bright}${colors.green}Performance Tips:${colors.reset}`)
  console.log(`  • Use React.memo() for expensive components ✓ (implemented)`)
  console.log(`  • Use useMemo/useCallback for expensive computations`)
  console.log(`  • Virtualize long lists (already using react-virtuoso)`)
  console.log(`  • Lazy load routes and heavy features`)
  console.log('')
}

/**
 * Main execution
 * Runs the bundle analysis and handles errors gracefully
 */
function main() {
  try {
    generateReport()
    process.exit(0)
  } catch (error) {
    console.error(`${colors.red}Error during analysis:${colors.reset}`, error.message)
    if (error.stack) {
      console.error(`${colors.red}Stack trace:${colors.reset}`, error.stack)
    }
    process.exit(1)
  }
}

// Run analysis
main()
