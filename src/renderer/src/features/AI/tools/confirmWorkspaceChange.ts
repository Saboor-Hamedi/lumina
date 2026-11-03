export type WorkspaceChangeAction = 'delete' | 'clear' | 'replace'

export async function confirmWorkspaceChange(
  action: WorkspaceChangeAction,
  target: string,
  details: string
): Promise<boolean> {
  try {
    const confirm = (window as any).api?.confirmWorkspaceChange
    if (typeof confirm !== 'function') return true
    return Boolean(await confirm({ action, target: String(target).slice(0, 300), details: String(details).slice(0, 500) }))
  } catch (error) {
    console.warn('[AIWorkspaceChange] Confirmation could not be shown:', error)
    return false
  }
}
