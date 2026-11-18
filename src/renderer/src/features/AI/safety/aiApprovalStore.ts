/**
 * aiApprovalStore.ts
 *
 * Zustand store managing inline Approve / Reject requests for risky AI tool
 * actions (e.g. file deletion, clearing content, destructive mutations).
 */

import { create } from 'zustand'

export type ApprovalRiskLevel = 'medium' | 'high'

export interface PendingToolApproval {
  id: string
  toolName: string
  actionLabel: string
  target: string
  details: string
  riskLevel: ApprovalRiskLevel
  createdAt: number
}

interface AIApprovalStoreState {
  pendingApprovals: PendingToolApproval[]
  mountedCardCount: number
  registerApprovalCard: () => () => void
  resolveApproval: (id: string, approved: boolean) => void
  clearAllApprovals: () => void
}

const approvalResolvers = new Map<string, (approved: boolean) => void>()

export const useAIApprovalStore = create<AIApprovalStoreState>((set) => ({
  pendingApprovals: [],
  mountedCardCount: 0,

  registerApprovalCard: () => {
    set((state) => ({ mountedCardCount: state.mountedCardCount + 1 }))
    return () => {
      set((state) => ({ mountedCardCount: Math.max(0, state.mountedCardCount - 1) }))
    }
  },

  resolveApproval: (id: string, approved: boolean) => {
    const resolver = approvalResolvers.get(id)
    if (resolver) {
      approvalResolvers.delete(id)
      resolver(approved)
    }
    set((state) => ({
      pendingApprovals: state.pendingApprovals.filter((item) => item.id !== id)
    }))
  },

  clearAllApprovals: () => {
    approvalResolvers.forEach((resolve) => resolve(false))
    approvalResolvers.clear()
    set({ pendingApprovals: [] })
  }
}))

export interface RequestApprovalParams {
  toolName: string
  actionLabel: string
  target: string
  details: string
  riskLevel?: ApprovalRiskLevel
  abortSignal?: AbortSignal
}

/**
 * Suspends tool execution until the user clicks Approve or Reject in the inline
 * LuminaApprovalCard, or auto-rejects if the current AI request is aborted.
 */
export function requestToolApproval({
  toolName,
  actionLabel,
  target,
  details,
  riskLevel = 'high',
  abortSignal
}: RequestApprovalParams): Promise<boolean> {
  if (abortSignal?.aborted) {
    return Promise.resolve(false)
  }

  const id = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  return new Promise<boolean>((resolve) => {
    const onAbort = () => {
      useAIApprovalStore.getState().resolveApproval(id, false)
    }

    approvalResolvers.set(id, (approved: boolean) => {
      if (abortSignal) {
        abortSignal.removeEventListener('abort', onAbort)
      }
      resolve(approved)
    })

    if (abortSignal) {
      abortSignal.addEventListener('abort', onAbort, { once: true })
    }

    useAIApprovalStore.setState((state) => ({
      pendingApprovals: [
        ...state.pendingApprovals,
        {
          id,
          toolName,
          actionLabel,
          target: String(target).slice(0, 260),
          details: String(details).slice(0, 400),
          riskLevel,
          createdAt: Date.now()
        }
      ]
    }))
  })
}
