/**
 * terminalHandlers.ts
 *
 * Main process IPC handlers for Lumina's integrated terminal engine.
 * Spawns native shell sessions (PowerShell, CMD, Bash, Zsh) with full
 * interactive stdin/stdout/stderr streaming and lifecycle management.
 */

import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess, execSync } from 'child_process'
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

interface TerminalLineState {
  currentLine: string
  cursorPos: number
  history: string[]
  historyIndex: number
  tempLine: string
  isExecuting: boolean
  pendingEchoFilter?: string
}

const activeSessions = new Map<string, ChildProcess>()
const activeBuffers = new Map<string, string[]>()
const activeSessionShells = new Map<string, string>()
const activeSessionCwds = new Map<string, string>()
const activeLineStates = new Map<string, TerminalLineState>()

export interface ShellProfile {
  id: string
  label: string
  shell: string
  args: string[]
  env?: Record<string, string>
  isAvailable: boolean
}

/**
 * Terminate a process and all its children safely.
 */
function terminateProcessTree(proc: ChildProcess): void {
  if (!proc || !proc.pid) return
  try {
    if (os.platform() === 'win32') {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' })
    } else {
      proc.kill('SIGTERM')
    }
  } catch {
    try {
      proc.kill('SIGKILL')
    } catch {}
  }
}

/**
 * Generates dynamic PowerShell startup arguments that discover and dot-source the user profile
 * across standard paths (e.g. OneDrive/Documents, USERPROFILE/Documents) matching native terminal behavior,
 * without hardcoding user paths or throwing errors if the profile does not exist.
 */
function getPowerShellArgs(): string[] {
  const initCmd = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "$p = $PROFILE",
    "if (-not $p -or -not (Test-Path -LiteralPath $p)) {",
    "  $docs = if ($env:OneDrive -and (Test-Path -LiteralPath (Join-Path $env:OneDrive 'Documents'))) { Join-Path $env:OneDrive 'Documents' } elseif ($env:USERPROFILE) { Join-Path $env:USERPROFILE 'Documents' } else { '' };",
    "  if ($docs) {",
    "    foreach ($cand in @(Join-Path $docs 'WindowsPowerShell\\Microsoft.PowerShell_profile.ps1', Join-Path $docs 'PowerShell\\Microsoft.PowerShell_profile.ps1', Join-Path $docs 'WindowsPowerShell\\profile.ps1', Join-Path $docs 'PowerShell\\profile.ps1')) {",
    "      if (Test-Path -LiteralPath $cand) { $p = $cand; break }",
    "    }",
    "  }",
    "};",
    "if ($p -and (Test-Path -LiteralPath $p)) { . $p }"
  ].join('; ')

  return ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', `& { ${initCmd} }`]
}

function getPwshArgs(): string[] {
  const initCmd = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "$p = $PROFILE",
    "if (-not $p -or -not (Test-Path -LiteralPath $p)) {",
    "  $docs = if ($env:OneDrive -and (Test-Path -LiteralPath (Join-Path $env:OneDrive 'Documents'))) { Join-Path $env:OneDrive 'Documents' } elseif ($env:USERPROFILE) { Join-Path $env:USERPROFILE 'Documents' } else { '' };",
    "  if ($docs) {",
    "    foreach ($cand in @(Join-Path $docs 'PowerShell\\Microsoft.PowerShell_profile.ps1', Join-Path $docs 'PowerShell\\profile.ps1')) {",
    "      if (Test-Path -LiteralPath $cand) { $p = $cand; break }",
    "    }",
    "  }",
    "};",
    "if ($p -and (Test-Path -LiteralPath $p)) { . $p }"
  ].join('; ')

  return ['-NoLogo', '-NoExit', '-Command', `& { ${initCmd} }`]
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
      args: getPowerShellArgs(),
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
        args: getPwshArgs(),
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
      args: ['/Q', '/k'],
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
      return { shell: requestedShell, args: getPwshArgs() }
    }
    if (/powershell(\.exe)?$/i.test(requestedShell)) {
      return { shell: 'powershell.exe', args: getPowerShellArgs() }
    }
    if (/cmd(\.exe)?$/i.test(requestedShell)) {
      return { shell: 'cmd.exe', args: ['/Q', '/k'] }
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
      return { shell: 'powershell.exe', args: getPowerShellArgs() }
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
        terminateProcessTree(existing)
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
      activeSessionCwds.set(sessionId, cwd)

      // Always reset buffer for a freshly spawned process
      activeBuffers.set(sessionId, [])

      const isCmd = isWin && /cmd(\.exe)?$/i.test(shell)
      const isPs = isWin && /(powershell|pwsh)(\.exe)?$/i.test(shell)
      const needsLineDiscipline = isCmd || isPs

      if (needsLineDiscipline) {
        activeLineStates.set(sessionId, {
          currentLine: '',
          cursorPos: 0,
          history: [],
          historyIndex: -1,
          tempLine: '',
          isExecuting: false
        })
      }

      const sender = event.sender

      const sessionBuffers = activeBuffers
      let buf = sessionBuffers.get(sessionId)
      if (!buf) {
        buf = []
        sessionBuffers.set(sessionId, buf)
      }

      let initialCmdBuffer = ''
      let hasExtractedFirstCmdPrompt = false

      proc.stdout?.on('data', (chunk: Buffer) => {
        let text = chunk.toString('utf-8')
        text = sanitizeTerminalOutput(text)

        // For CMD: accurately buffer and extract the prompt on line 1, stripping banner & leading newlines.
        // \x1b[1;1H positions cursor directly at top-left to eliminate any single gap from the top.
        if (isCmd && !hasExtractedFirstCmdPrompt) {
          initialCmdBuffer += text
          const promptIdx = initialCmdBuffer.indexOf('>')
          if (promptIdx !== -1) {
            hasExtractedFirstCmdPrompt = true
            const lastNl = initialCmdBuffer.lastIndexOf('\n', promptIdx)
            let promptText = lastNl === -1 ? initialCmdBuffer.slice(0, promptIdx + 1) : initialCmdBuffer.slice(lastNl + 1, promptIdx + 1)
            promptText = promptText.replace(/^[\r\n]+/, '').trimStart()
            const remainder = initialCmdBuffer.slice(promptIdx + 1)
            text = '\x1b[1;1H' + promptText + remainder
          } else {
            // Buffer is still accumulating the banner, wait for the '>' character
            return
          }
        }

        // For PowerShell: filter echoed command on Enter so it does not duplicate on screen
        if (isPs) {
          const state = activeLineStates.get(sessionId)
          if (state?.pendingEchoFilter && text.startsWith(state.pendingEchoFilter)) {
            text = text.slice(state.pendingEchoFilter.length).replace(/^[\r\n]+/, '')
            state.pendingEchoFilter = undefined
          }
          const isPrompt = /(?:PS [a-zA-Z]:\\[^>\r\n]*>\s*$|[>\u276f\u25b6\$\#]\s*$)/.test(text)
          if (isPrompt && state) {
            state.isExecuting = false
            state.currentLine = ''
            state.cursorPos = 0
            state.historyIndex = -1
          }
        }

        if (isCmd) {
          text = text.replace(/\f/g, '\x1b[2J\x1b[H')
          const promptMatch = text.match(/(?:^|[\r\n])([a-zA-Z]:\\[^>\r\n]*)>\s*$/)
          if (promptMatch) {
            if (promptMatch[1]) {
              activeSessionCwds.set(sessionId, promptMatch[1].trim())
            }
            const state = activeLineStates.get(sessionId)
            if (state) {
              state.isExecuting = false
              state.currentLine = ''
              state.cursorPos = 0
              state.historyIndex = -1
            }
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
        activeSessionShells.delete(sessionId)
        activeSessionCwds.delete(sessionId)
        activeLineStates.delete(sessionId)
        if (!sender.isDestroyed()) {
          sender.send(`terminal:exit:${sessionId}`, code ?? 0)
        }
      })

      proc.on('error', (err: Error) => {
        activeSessions.delete(sessionId)
        activeBuffers.delete(sessionId)
        activeSessionShells.delete(sessionId)
        activeSessionCwds.delete(sessionId)
        activeLineStates.delete(sessionId)
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
  ipcMain.handle('terminal:write', async (event, payload: WritePayload) => {
    const { sessionId, data } = payload || {}
    if (!sessionId || data == null) return false

    const proc = activeSessions.get(sessionId)
    if (!proc || !proc.stdin || proc.stdin.destroyed) {
      return false
    }

    try {
      const isWin = os.platform() === 'win32'
      const sessionShell = activeSessionShells.get(sessionId) || ''
      const isCmd = isWin && /cmd(\.exe)?$/i.test(sessionShell)
      const isPs = isWin && /(powershell|pwsh)(\.exe)?$/i.test(sessionShell)
      const isBash = isWin && /bash(\.exe)?$/i.test(sessionShell)
      const needsLineDiscipline = isCmd || isPs

      // Interactive line discipline for CMD.exe and PowerShell in piped mode:
      // Since Windows shells over standard pipes do not echo keystrokes or provide line-editing,
      // we provide real-time character echoing, backspace, cursor navigation, history,
      // and tab completion so typing is immediately visible and fluid.
      if (needsLineDiscipline) {
        let lineState = activeLineStates.get(sessionId)
        if (!lineState) {
          lineState = {
            currentLine: '',
            cursorPos: 0,
            history: [],
            historyIndex: -1,
            tempLine: '',
            isExecuting: false
          }
          activeLineStates.set(sessionId, lineState)
        }

        const sendEcho = (echoStr: string) => {
          if (!echoStr) return
          let currentBuf = activeBuffers.get(sessionId)
          if (!currentBuf) {
            currentBuf = []
            activeBuffers.set(sessionId, currentBuf)
          }
          currentBuf.push(echoStr)
          if (currentBuf.length > 1000) currentBuf.shift()

          if (event?.sender && !event.sender.isDestroyed()) {
            event.sender.send(`terminal:data:${sessionId}`, echoStr)
          } else {
            const win = getMainWindow()
            if (win && !win.isDestroyed()) {
              win.webContents.send(`terminal:data:${sessionId}`, echoStr)
            }
          }
        }

        // Case A: A command or child process is actively running in the shell
        if (lineState.isExecuting) {
          if (data === '\x03') {
            sendEcho('^C\r\n')
            lineState.currentLine = ''
            lineState.cursorPos = 0
            lineState.historyIndex = -1
            lineState.isExecuting = false
            proc.stdin.write('\x03')
            proc.stdin.write('\r\n')
            return true
          }

          let norm = data
          if (data === '\r' || data === '\n' || data === '\r\n') {
            sendEcho('\r\n')
            norm = '\r\n'
          } else if (data.length > 0 && !data.startsWith('\x1b')) {
            sendEcho(data)
          }
          proc.stdin.write(norm)
          return true
        }

        // Case B: User is typing at the shell prompt

        // 1. Enter (Execute command)
        if (data === '\r' || data === '\n' || data === '\r\n') {
          sendEcho('\r\n')
          lineState.isExecuting = true
          const cmdLine = lineState.currentLine
          if (cmdLine.trim() && lineState.history[lineState.history.length - 1] !== cmdLine) {
            lineState.history.push(cmdLine)
            if (lineState.history.length > 300) lineState.history.shift()
          }

          // If PowerShell, set pending echo filter to prevent duplicate echo on execution
          if (isPs) {
            lineState.pendingEchoFilter = cmdLine
          }

          lineState.currentLine = ''
          lineState.cursorPos = 0
          lineState.historyIndex = -1
          lineState.tempLine = ''
          proc.stdin.write(cmdLine + '\r\n')
          return true
        }

        // 2. Ctrl+C (Cancel typed line and request new prompt)
        if (data === '\x03') {
          sendEcho('^C\r\n')
          lineState.currentLine = ''
          lineState.cursorPos = 0
          lineState.historyIndex = -1
          proc.stdin.write('\r\n')
          return true
        }

        // 3. Backspace
        if (data === '\x7f' || data === '\b' || data === '\x08') {
          if (lineState.cursorPos > 0) {
            lineState.cursorPos--
            const before = lineState.currentLine.slice(0, lineState.cursorPos)
            const after = lineState.currentLine.slice(lineState.cursorPos + 1)
            lineState.currentLine = before + after
            if (after.length === 0) {
              sendEcho('\b \b')
            } else {
              const moveBack = after.length + 1
              sendEcho('\b' + after + ' \x1b[' + moveBack + 'D')
            }
          }
          return true
        }

        // 4. Delete key (\x1b[3~)
        if (data === '\x1b[3~') {
          if (lineState.cursorPos < lineState.currentLine.length) {
            const before = lineState.currentLine.slice(0, lineState.cursorPos)
            const after = lineState.currentLine.slice(lineState.cursorPos + 1)
            lineState.currentLine = before + after
            const moveBack = after.length + 1
            sendEcho(after + ' \x1b[' + moveBack + 'D')
          }
          return true
        }

        // 5. Left Arrow (\x1b[D)
        if (data === '\x1b[D') {
          if (lineState.cursorPos > 0) {
            lineState.cursorPos--
            sendEcho('\x1b[D')
          }
          return true
        }

        // 6. Right Arrow (\x1b[C)
        if (data === '\x1b[C') {
          if (lineState.cursorPos < lineState.currentLine.length) {
            lineState.cursorPos++
            sendEcho('\x1b[C')
          }
          return true
        }

        // 7. Home key (\x1b[H, \x1b[1~, \x1bOH, Ctrl+A)
        if (data === '\x1b[H' || data === '\x1b[1~' || data === '\x1bOH' || data === '\x01') {
          if (lineState.cursorPos > 0) {
            sendEcho('\x1b[' + lineState.cursorPos + 'D')
            lineState.cursorPos = 0
          }
          return true
        }

        // 8. End key (\x1b[F, \x1b[4~, \x1bOF, Ctrl+E)
        if (data === '\x1b[F' || data === '\x1b[4~' || data === '\x1bOF' || data === '\x05') {
          const diff = lineState.currentLine.length - lineState.cursorPos
          if (diff > 0) {
            sendEcho('\x1b[' + diff + 'C')
            lineState.cursorPos = lineState.currentLine.length
          }
          return true
        }

        // 9. Up Arrow (\x1b[A) - Command history backward
        if (data === '\x1b[A') {
          if (lineState.history.length > 0) {
            if (lineState.historyIndex === -1) {
              lineState.tempLine = lineState.currentLine
              lineState.historyIndex = lineState.history.length - 1
            } else if (lineState.historyIndex > 0) {
              lineState.historyIndex--
            }
            const target = lineState.history[lineState.historyIndex]
            const erase =
              (lineState.cursorPos > 0 ? '\x1b[' + lineState.cursorPos + 'D' : '') +
              ' '.repeat(lineState.currentLine.length) +
              (lineState.currentLine.length > 0 ? '\x1b[' + lineState.currentLine.length + 'D' : '')
            lineState.currentLine = target
            lineState.cursorPos = target.length
            sendEcho(erase + target)
          }
          return true
        }

        // 10. Down Arrow (\x1b[B) - Command history forward
        if (data === '\x1b[B') {
          if (lineState.historyIndex !== -1) {
            lineState.historyIndex++
            let target = ''
            if (lineState.historyIndex >= lineState.history.length) {
              lineState.historyIndex = -1
              target = lineState.tempLine
            } else {
              target = lineState.history[lineState.historyIndex]
            }
            const erase =
              (lineState.cursorPos > 0 ? '\x1b[' + lineState.cursorPos + 'D' : '') +
              ' '.repeat(lineState.currentLine.length) +
              (lineState.currentLine.length > 0 ? '\x1b[' + lineState.currentLine.length + 'D' : '')
            lineState.currentLine = target
            lineState.cursorPos = target.length
            sendEcho(erase + target)
          }
          return true
        }

        // 11. Tab (\t) - Smart directory/file completion
        if (data === '\t') {
          const sessionCwd = activeSessionCwds.get(sessionId) || WorkspaceManager.workspacePath || process.cwd()
          const beforeCursor = lineState.currentLine.slice(0, lineState.cursorPos)
          const tokenMatch = beforeCursor.match(/([^\s"']+)$/)
          if (tokenMatch) {
            const rawToken = tokenMatch[1]
            try {
              const dirToSearch = path.isAbsolute(rawToken)
                ? path.dirname(rawToken)
                : path.resolve(sessionCwd, path.dirname(rawToken))
              const basePrefix = path.basename(rawToken).toLowerCase()
              if (fs.existsSync(dirToSearch)) {
                const entries = fs.readdirSync(dirToSearch)
                const matches = entries.filter((e) => e.toLowerCase().startsWith(basePrefix))
                if (matches.length > 0) {
                  const chosen = matches[0]
                  const completed = rawToken.includes('\\') || rawToken.includes('/')
                    ? path.join(path.dirname(rawToken), chosen)
                    : chosen
                  const beforeToken = beforeCursor.slice(0, tokenMatch.index)
                  const afterCursor = lineState.currentLine.slice(lineState.cursorPos)
                  const newLine = beforeToken + completed + afterCursor
                  const erase =
                    (lineState.cursorPos > 0 ? '\x1b[' + lineState.cursorPos + 'D' : '') +
                    ' '.repeat(lineState.currentLine.length) +
                    (lineState.currentLine.length > 0 ? '\x1b[' + lineState.currentLine.length + 'D' : '')
                  lineState.currentLine = newLine
                  lineState.cursorPos = beforeToken.length + completed.length
                  sendEcho(erase + newLine + (afterCursor.length > 0 ? '\x1b[' + afterCursor.length + 'D' : ''))
                }
              }
            } catch {}
          }
          return true
        }

        // 12. Multi-line paste or text containing newlines
        if (data.includes('\r') || data.includes('\n')) {
          const parts = data.split(/\r?\n/)
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            if (i < parts.length - 1) {
              const fullLine = lineState.currentLine + part
              sendEcho(part + '\r\n')
              lineState.currentLine = ''
              lineState.cursorPos = 0
              lineState.isExecuting = true
              if (isPs) {
                lineState.pendingEchoFilter = fullLine
              }
              proc.stdin.write(fullLine + '\r\n')
            } else if (part.length > 0) {
              lineState.currentLine += part
              lineState.cursorPos += part.length
              sendEcho(part)
            }
          }
          return true
        }

        // 13. Regular printable characters & pasted single-line text
        if (typeof data === 'string' && data.length > 0 && !data.startsWith('\x1b')) {
          const before = lineState.currentLine.slice(0, lineState.cursorPos)
          const after = lineState.currentLine.slice(lineState.cursorPos)
          lineState.currentLine = before + data + after
          lineState.cursorPos += data.length
          if (after.length === 0) {
            sendEcho(data)
          } else {
            sendEcho(data + after + '\x1b[' + after.length + 'D')
          }
          return true
        }

        return true
      }

      // Non-Windows shells (Bash, Zsh, Fish) have native interactive readline
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
        terminateProcessTree(proc)
      } catch {}
      activeSessions.delete(sessionId)
      activeBuffers.delete(sessionId)
      activeSessionShells.delete(sessionId)
      activeSessionCwds.delete(sessionId)
      activeLineStates.delete(sessionId)
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
      terminateProcessTree(proc)
    } catch {}
    activeSessions.delete(id)
  }
  activeBuffers.clear()
  activeSessionShells.clear()
  activeSessionCwds.clear()
  activeLineStates.clear()
}
