import { requestToolApproval, useAIApprovalStore } from '../safety'

export type WorkspaceChangeAction = 'delete' | 'clear' | 'replace'

const ACTION_LABELS: Record<WorkspaceChangeAction, string> = {
  delete: 'Approve Deletion',
  clear: 'Approve Clear File',
  replace: 'Approve Full Replacement'
}

export async function confirmWorkspaceChange(
  action: WorkspaceChangeAction,
  target: string,
  details: string
): Promise<boolean> {
  try {
    if (useAIApprovalStore.getState().mountedCardCount > 0) {
      return await requestToolApproval({
        toolName: action,
        actionLabel: ACTION_LABELS[action] || 'Approve Workspace Change',
        target,
        details,
        riskLevel: action === 'delete' || action === 'clear' ? 'high' : 'medium'
      })
    }
    const confirm = (window as any).api?.confirmWorkspaceChange
    if (typeof confirm !== 'function') return true
    return Boolean(
      await confirm({
        action,
        target: String(target).slice(0, 300),
        details: String(details).slice(0, 500)
      })
    )
  } catch (error) {
    console.warn('[AIWorkspaceChange] Confirmation could not be shown:', error)
    return false
  }
}
