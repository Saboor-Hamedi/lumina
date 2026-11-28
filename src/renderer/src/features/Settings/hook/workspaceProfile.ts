/**
 * workspaceProfile.ts
 *
 * Lightweight, DRY per-workspace theme & AI profile persistence.
 * Remembers each workspace's preferred theme, accent color, and AI mode
 * keyed by normalized workspace path so switching between vaults (e.g. a
 * Coding workspace vs. a Journal workspace) automatically restores its vibe.
 */

export interface WorkspaceProfile {
  theme?: string
  accentColor?: string | null
  activeAIMode?: string
  updatedAt?: number
}

const STORAGE_KEY = 'lumina_workspace_profiles_v1'
const MAX_STORED_PROFILES = 40

export function normalizeWorkspaceProfileKey(workspacePath?: string | null): string {
  if (!workspacePath) return ''
  return workspacePath.trim().replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase()
}

function readAllProfiles(): Record<string, WorkspaceProfile> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, WorkspaceProfile>)
      : {}
  } catch {
    return {}
  }
}

function writeAllProfiles(profiles: Record<string, WorkspaceProfile>): void {
  if (typeof localStorage === 'undefined') return
  try {
    const entries = Object.entries(profiles)
    if (entries.length > MAX_STORED_PROFILES) {
      entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
      profiles = Object.fromEntries(entries.slice(0, MAX_STORED_PROFILES))
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
  } catch {
    // Ignore storage quota or private mode errors
  }
}

export function getWorkspaceProfile(workspacePath?: string | null): WorkspaceProfile | null {
  const key = normalizeWorkspaceProfileKey(workspacePath)
  if (!key) return null
  const all = readAllProfiles()
  return all[key] || null
}

export function saveWorkspaceProfile(
  workspacePath: string | null | undefined,
  patch: Partial<WorkspaceProfile>
): WorkspaceProfile | null {
  const key = normalizeWorkspaceProfileKey(workspacePath)
  if (!key) return null
  const all = readAllProfiles()
  const next: WorkspaceProfile = {
    ...(all[key] || {}),
    ...patch,
    updatedAt: Date.now()
  }
  all[key] = next
  writeAllProfiles(all)
  return next
}

export function removeWorkspaceProfile(workspacePath?: string | null): void {
  const key = normalizeWorkspaceProfileKey(workspacePath)
  if (!key) return
  const all = readAllProfiles()
  if (key in all) {
    delete all[key]
    writeAllProfiles(all)
  }
}
