import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const crateDir = path.join(rootDir, 'crates', 'lumina_core')
const srcDir = path.join(crateDir, 'src')

// Ensure newly installed Rust from winget/rustup is detected even before terminal restart
const cargoBinDir = path.join(process.env.USERPROFILE || '', '.cargo', 'bin')
if (fs.existsSync(cargoBinDir) && !process.env.PATH?.includes(cargoBinDir)) {
  process.env.PATH = `${cargoBinDir}${path.delimiter}${process.env.PATH}`
}

function getLatestSourceMtime() {
  let latest = 0
  const cargoToml = path.join(crateDir, 'Cargo.toml')
  if (fs.existsSync(cargoToml)) {
    latest = Math.max(latest, fs.statSync(cargoToml).mtimeMs)
  }

  if (!fs.existsSync(srcDir)) return latest

  const files = fs.readdirSync(srcDir)
  for (const f of files) {
    const fullPath = path.join(srcDir, f)
    const stat = fs.statSync(fullPath)
    if (stat.isFile()) {
      latest = Math.max(latest, stat.mtimeMs)
    }
  }
  return latest
}

function getCompiledBinaryMtime() {
  if (!fs.existsSync(crateDir)) return 0
  const files = fs.readdirSync(crateDir)
  const nodeFiles = files.filter((f) => f.endsWith('.node'))
  if (nodeFiles.length === 0) return 0

  let latest = 0
  for (const f of nodeFiles) {
    const stat = fs.statSync(path.join(crateDir, f))
    latest = Math.max(latest, stat.mtimeMs)
  }
  return latest
}

function ensureRustCore() {
  try {
    const sourceMtime = getLatestSourceMtime()
    const binaryMtime = getCompiledBinaryMtime()

    if (binaryMtime > 0 && binaryMtime >= sourceMtime) {
      // Compiled binary is up to date!
      return
    }

    // Check if cargo / rustc is available
    try {
      execSync('cargo --version', { stdio: 'ignore' })
    } catch {
      console.log('⚡ [Lumina Engine] Rust toolchain not detected. Running on JavaScript engine.')
      return
    }

    console.log('⚡ [Lumina Engine] Compiling native Rust core (lumina_core)...')
    const localNapi = path.join(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'napi.cmd' : 'napi')
    const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--release')
    const releaseFlag = isProduction ? ' --release' : ''

    const cmd = fs.existsSync(localNapi)
      ? `"${localNapi}" build --platform${releaseFlag} --cwd crates/lumina_core`
      : `npx napi build --platform${releaseFlag} --cwd crates/lumina_core`

    execSync(cmd, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true
    })

    const resourcesNativeDir = path.join(rootDir, 'resources', 'native')
    if (!fs.existsSync(resourcesNativeDir)) {
      fs.mkdirSync(resourcesNativeDir, { recursive: true })
    }

    if (fs.existsSync(crateDir)) {
      const builtFiles = fs.readdirSync(crateDir)
      for (const file of builtFiles) {
        if (file.endsWith('.node') || file === 'index.js' || file === 'index.d.ts') {
          fs.copyFileSync(path.join(crateDir, file), path.join(resourcesNativeDir, file))
        }
      }
    }

    console.log('✨ [Lumina Engine] Native Rust core compiled successfully.')
  } catch (err) {
    console.warn('⚠️ [Lumina Engine] Native compilation skipped, continuing with JavaScript engine:', err?.message || err)
  }
}

ensureRustCore()
