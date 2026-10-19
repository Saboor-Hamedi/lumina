/**
 * terminalHandlers.ts
 *
 * Main process IPC handlers for Lumina's integrated terminal engine.
 * Spawns native shell sessions (PowerShell, CMD, Bash, Zsh) with full
 * interactive stdin/stdout/stderr streaming and lifecycle management.
 */

import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import os from 'os'
import path from 'path'
import fs from 'fs'
import WorkspaceManager from '../workspace/workspaceManager'

interface SpawnPayload {
  sessionId: string
  shell?: string
  cwd?: string
  cols?: number
  rows?: number
}

interface WritePayload {
  sessionId: string
  data: string
}

interface ResizePayload {
  sessionId: string
  cols: number
  rows: number
}

const activeSessions = new Map<string, ChildProcess>()
const activeBuffers = new Map<string, string[]>()
const activeSessionShells = new Map<string, string>()

export interface ShellProfile {
  id: string
  label: string
  shell: string
  args: string[]
  env?: Record<string, string>
  isAvailable: boolean
}

/**
 * Discovers supported shells installed on the system safely without launching heavy persistent processes.
 */
export async function discoverAvailableShells(): Promise<ShellProfile[]> {
  const isWin = os.platform() === 'win32'
  const isMac = os.platform() === 'darwin'
  const profiles: ShellProfile[] = []

  if (isWin) {
    // 1. Git Bash (User preferred)
    const gitBashCandidates = [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe')
    ]
    let gitBashPath: string | null = null
    for (const cand of gitBashCandidates) {
      if (cand && fs.existsSync(cand)) {
        gitBashPath = cand
        break
      }
    }
    if (gitBashPath) {
      profiles.push({
        id: 'bash',
        label: 'Git Bash',
        shell: gitBashPath,
        args: ['--login', '-i'],
        isAvailable: true
      })
    }

    // 2. PowerShell (Built-in)
    const psCandidates = [
      path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      'powershell.exe'
    ]
    let psPath = 'powershell.exe'
    for (const cand of psCandidates) {
      if (cand && fs.existsSync(cand)) {
        psPath = cand
        break
      }
    }
    profiles.push({
      id: 'powershell',
      label: 'PowerShell',
      shell: psPath,
      args: ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass'],
      isAvailable: true
    })

    // 3. PowerShell 7 (pwsh) if installed
    const pwshCandidates = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'PowerShell', '7', 'pwsh.exe')
    ]
    let pwshPath: string | null = null
    for (const cand of pwshCandidates) {
      if (cand && fs.existsSync(cand)) {
        pwshPath = cand
        break
      }
    }
    if (pwshPath) {
      profiles.push({
        id: 'pwsh',
        label: 'PowerShell 7',
        shell: pwshPath,
        args: ['-NoLogo', '-NoExit'],
        isAvailable: true
      })
    }

    // 4. Command Prompt (cmd.exe)
    const cmdCandidates = [
      path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe'),
      'cmd.exe'
    ]
    let cmdPath = 'cmd.exe'
    for (const cand of cmdCandidates) {
      if (cand && fs.existsSync(cand)) {
        cmdPath = cand
        break
      }
    }
    profiles.push({
      id: 'cmd',
      label: 'Command Prompt',
      shell: cmdPath,
      args: [],
      isAvailable: true
    })

    // 5. WSL (Validate availability safely)
    const wslPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wsl.exe')
    if (fs.existsSync(wslPath)) {
      profiles.push({
        id: 'wsl',
        label: 'WSL (Linux)',
        shell: wslPath,
        args: [],
        isAvailable: false // default false until validated if requested
      })
    }
  } else if (isMac) {
    // macOS
    const zshPath = fs.existsSync('/bin/zsh') ? '/bin/zsh' : '/usr/bin/zsh'
    if (fs.existsSync(zshPath)) {
      profiles.push({ id: 'zsh', label: 'Zsh', shell: zshPath, args: ['-l'], isAvailable: true })
    }
    const bashPath = fs.existsSync('/bin/bash') ? '/bin/bash' : '/usr/bin/bash'
    if (fs.existsSync(bashPath)) {
      profiles.push({ id: 'bash', label: 'Bash', shell: bashPath, args: ['-l'], isAvailable: true })
    }
  } else {
    // Linux
    const shells = [
      { id: 'bash', label: 'Bash', path: '/bin/bash' },
      { id: 'zsh', label: 'Zsh', path: '/bin/zsh' },
      { id: 'fish', label: 'Fish', path: '/usr/bin/fish' },
      { id: 'sh', label: 'Sh', path: '/bin/sh' }
    ]
    for (const s of shells) {
      if (fs.existsSync(s.path)) {
        profiles.push({ id: s.id, label: s.label, shell: s.path, args: ['-l'], isAvailable: true })
      }
    }
  }

  return profiles
}

function resolveShellExecutable(requestedShell?: string): { shell: string; args: string[] } {
  const isWin = os.platform() === 'win32'
  if (!requestedShell) {
    requestedShell = isWin ? 'powershell.exe' : (process.env.SHELL || '/bin/bash')
  }

  if (isWin) {
    if (/pwsh(\.exe)?$/i.test(requestedShell)) {
      return { shell: requestedShell, args: ['-NoLogo', '-NoExit'] }
    }
    if (/powershell(\.exe)?$/i.test(requestedShell)) {
      return { shell: 'powershell.exe', args: ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass'] }
    }
    if (/cmd(\.exe)?$/i.test(requestedShell)) {
      return { shell: 'cmd.exe', args: [] }
    }
    if (/bash(\.exe)?$/i.test(requestedShell)) {
      const candidates = [
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
        'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe')
      ]
      for (const cand of candidates) {
        if (cand && fs.existsSync(cand)) {
          return { shell: cand, args: ['--login', '-i'] }
        }
      }
      // If Git Bash is not installed, fallback to powershell.exe so it never fails with Access Denied
      return { shell: 'powershell.exe', args: ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass'] }
    }
    if (/wsl(\.exe)?$/i.test(requestedShell)) {
      return { shell: 'wsl.exe', args: [] }
    }
    return { shell: requestedShell, args: [] }
  }

  // macOS / Linux
  return { shell: requestedShell, args: ['-l'] }
}

function sanitizeTerminalOutput(chunkStr: string): string {
  if (!chunkStr) return ''
  if (!/cannot set terminal process group|no job control in this shell/i.test(chunkStr)) {
    return chunkStr
  }
  const lines = chunkStr.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim()
    if (trimmed.includes('cannot set terminal process group')) return false
    if (trimmed.includes('no job control in this shell')) return false
    return true
  })
  return lines.join('\r\n')
}

export function registerTerminalHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Discover available shells on the host machine
  ipcMain.handle('terminal:getAvailableShells', async () => {
    try {
      return await discoverAvailableShells()
    } catch {
      return []
    }
  })

  // Spawn a new terminal shell session
  ipcMain.handle('terminal:spawn', async (event, payload: SpawnPayload) => {
    const { sessionId, shell: requestedShell, cwd: requestedCwd } = payload || {}
    if (!sessionId) {
      return { success: false, error: 'Session ID is required' }
    }

    const { shell, args } = resolveShellExecutable(requestedShell)
    let cwd = requestedCwd

    if (!cwd || !fs.existsSync(cwd)) {
      cwd = (WorkspaceManager.workspacePath && fs.existsSync(WorkspaceManager.workspacePath))
        ? WorkspaceManager.workspacePath
        : (fs.existsSync(process.cwd()) ? process.cwd() : os.homedir())
    }
    if (!cwd || !fs.existsSync(cwd)) {
      cwd = os.homedir()
    }

    // Reuse existing healthy session process if already running
    const existing = activeSessions.get(sessionId)
    if (existing && !existing.killed) {
      return { success: true, pid: existing.pid, shell, cwd }
    }
    if (existing) {
      try {
        existing.kill()
      } catch {}
      activeSessions.delete(sessionId)
    }

    try {
      const isWin = os.platform() === 'win32'
      const proc = spawn(shell, args, {
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      })

      activeSessions.set(sessionId, proc)
      activeSessionShells.set(sessionId, shell)

      // Always reset buffer for a freshly spawned process
      activeBuffers.set(sessionId, [])

      const isPs = isWin && /powershell(\.exe)?$/i.test(shell)
      if (isPs) {
        // Send a gentle wake-up ping to powershell only if buffer remains empty after 500ms
        setTimeout(() => {
          try {
            const currentBuf = activeBuffers.get(sessionId) || []
            if (currentBuf.length === 0 && proc && !proc.killed && proc.stdin && !proc.stdin.destroyed) {
              proc.stdin.write('\r\n')
            }
          } catch {}
        }, 500)
      }

      const sender = event.sender

      const sessionBuffers = activeBuffers
      let buf = sessionBuffers.get(sessionId)
      if (!buf) {
        buf = []
        sessionBuffers.set(sessionId, buf)
      }

      const isCmd = isWin && /cmd(\.exe)?$/i.test(shell)
      let initialCmdBuffer = ''
      let hasExtractedFirstCmdPrompt = false

      proc.stdout?.on('data', (chunk: Buffer) => {
        let text = chunk.toString('utf-8')
        text = sanitizeTerminalOutput(text)

        // For CMD: accurately buffer and extract the prompt on line 1, stripping banner & leading newlines
        if (isCmd && !hasExtractedFirstCmdPrompt) {
          initialCmdBuffer += text
          const promptIdx = initialCmdBuffer.indexOf('>')
          if (promptIdx !== -1) {
            hasExtractedFirstCmdPrompt = true
            const lastNl = initialCmdBuffer.lastIndexOf('\n', promptIdx)
            let promptText = lastNl === -1 ? initialCmdBuffer : initialCmdBuffer.slice(lastNl + 1)
            promptText = promptText.replace(/^[\r\n]+/, '')
            text = promptText
          } else {
            // Buffer is still accumulating the banner, wait for the '>' character
            return
          }
        }

        if (!text || text.length === 0) return

        let currentBuf = sessionBuffers.get(sessionId)
        if (!currentBuf) {
          currentBuf = []
          sessionBuffers.set(sessionId, currentBuf)
        }
        currentBuf.push(text)
        if (currentBuf.length > 1000) currentBuf.shift()

        if (!sender.isDestroyed()) {
          sender.send(`terminal:data:${sessionId}`, text)
        }
      })

      proc.stderr?.on('data', (chunk: Buffer) => {
        let text = chunk.toString('utf-8')
        text = sanitizeTerminalOutput(text)
        if (!text || text.length === 0) return

        let currentBuf = sessionBuffers.get(sessionId)
        if (!currentBuf) {
          currentBuf = []
          sessionBuffers.set(sessionId, currentBuf)
        }
        currentBuf.push(text)
        if (currentBuf.length > 1000) currentBuf.shift()

        if (!sender.isDestroyed()) {
          sender.send(`terminal:data:${sessionId}`, text)
        }
      })

      proc.on('exit', (code: number | null) => {
        activeSessions.delete(sessionId)
        activeBuffers.delete(sessionId)
        if (!sender.isDestroyed()) {
          sender.send(`terminal:exit:${sessionId}`, code ?? 0)
        }
      })

      proc.on('error', (err: Error) => {
        activeSessions.delete(sessionId)
        activeBuffers.delete(sessionId)
        if (!sender.isDestroyed()) {
          sender.send(`terminal:data:${sessionId}`, `\r\n\x1b[31m[Process Error: ${err.message}]\x1b[0m\r\n`)
          sender.send(`terminal:exit:${sessionId}`, 1)
        }
      })

      return { success: true, pid: proc.pid, shell, cwd }
    } catch (err: any) {
      console.error('[TerminalHandlers] Failed to spawn terminal shell:', err)
      return { success: false, error: err.message }
    }
  })

  // Attach and replay output buffer
  ipcMain.handle('terminal:attach', async (_, sessionId: string) => {
    if (!sessionId) return { success: false, history: '' }
    const buf = activeBuffers.get(sessionId) || []
    return { success: true, history: buf.join('') }
  })

  // Write user input into the shell stdin
  ipcMain.handle('terminal:write', async (_, payload: WritePayload) => {
    const { sessionId, data } = payload || {}
    if (!sessionId || data == null) return false

    const proc = activeSessions.get(sessionId)
    if (!proc || !proc.stdin || proc.stdin.destroyed) {
      return false
    }

    try {
      const isWin = os.platform() === 'win32'
      const sessionShell = activeSessionShells.get(sessionId) || ''
      const isBash = /bash(\.exe)?$/i.test(sessionShell)

      // In Windows, cmd.exe and powershell.exe require \r\n for Enter.
      // Git Bash (POSIX shell) expects standard \n. Sending \r\n causes duplicate prompts or blank lines.
      let normalized = data
      if (isWin) {
        if (isBash) {
          normalized = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        } else {
          normalized = data.replace(/\r(?!\n)/g, '\r\n')
        }
      }

      proc.stdin.write(normalized)
      return true
    } catch {
      return false
    }
  })

  // Resize notification
  ipcMain.handle('terminal:resize', async (_, payload: ResizePayload) => {
    const { sessionId } = payload || {}
    if (!sessionId) return false
    return true
  })

  // Kill a session process
  ipcMain.handle('terminal:kill', async (_, sessionId: string) => {
    if (!sessionId) return false
    const proc = activeSessions.get(sessionId)
    if (proc) {
      try {
        proc.kill()
      } catch {}
      activeSessions.delete(sessionId)
      activeBuffers.delete(sessionId)
      activeSessionShells.delete(sessionId)
      return true
    }
    return false
  })
}

/**
 * Cleans up all active terminal processes on app quit.
 */
export function terminateAllTerminalSessions(): void {
  for (const [id, proc] of activeSessions.entries()) {
    try {
      proc.kill()
    } catch {}
    activeSessions.delete(id)
  }
  activeBuffers.clear()
}
