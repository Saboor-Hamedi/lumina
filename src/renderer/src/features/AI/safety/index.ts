/**
 * safety/index.ts
 *
 * Clean barrel for Lumina AI's safety, inline Approve/Reject gate, and AI undo system.
 */

export {
  beginAIUndoTurn,
  recordAIFileSnapshot,
  undoAIChanges,
  getAIUndoHistory,
  clearAIUndoHistory,
  type AIFileSnapshot,
  type AIUndoActionKind
} from './aiUndoManager'

export {
  useAIApprovalStore,
  requestToolApproval,
  type PendingToolApproval,
  type ApprovalRiskLevel,
  type RequestApprovalParams
} from './aiApprovalStore'

export { LuminaApprovalCard } from './LuminaApprovalCard'
