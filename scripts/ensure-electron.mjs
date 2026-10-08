import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

function checkElectron() {
  const electronDir = path.join(projectRoot, 'node_modules', 'electron')
  const pathFile = path.join(electronDir, 'path.txt')
  const distExe = path.join(electronDir, 'dist', 'electron.exe')
  
  if (fs.existsSync(distExe)) {
    if (!fs.existsSync(pathFile)) {
      fs.writeFileSync(pathFile, 'electron.exe', 'ascii')
    }
    return true
  }
  return false
}

if (!checkElectron()) {
  console.log('[ensure-electron] Electron binary missing. Restoring from cache or downloading...')
  const localAppData = process.env.LOCALAPPDATA || ''
  const cacheZip = path.join(localAppData, 'electron', 'Cache', 'electron-v39.2.4-win32-x64.zip')
  const distDir = path.join(projectRoot, 'node_modules', 'electron', 'dist')
  const pathFile = path.join(projectRoot, 'node_modules', 'electron', 'path.txt')

  if (fs.existsSync(cacheZip)) {
    try {
      if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true })
      execSync(`tar.exe -xf "${cacheZip}" -C "${distDir}"`, { stdio: 'inherit' })
      fs.writeFileSync(pathFile, 'electron.exe', 'ascii')
      console.log('[ensure-electron] ✓ Unpacked Electron binary from local cache!')
    } catch (err) {
      console.warn('[ensure-electron] Cache extraction failed:', err.message)
    }
  }

  if (!checkElectron()) {
    const installJs = path.join(projectRoot, 'node_modules', 'electron', 'install.js')
    if (fs.existsSync(installJs)) {
      try {
        execSync(`node "${installJs}"`, { cwd: projectRoot, stdio: 'inherit' })
      } catch (err) {
        console.warn('[ensure-electron] install.js warning:', err.message)
      }
    }
  }

  if (checkElectron()) {
    console.log('[ensure-electron] ✓ Electron binary ready!')
  }
}
