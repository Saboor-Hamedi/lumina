/**
 * LuminaApprovalCard.tsx
 *
 * Inline Approve / Reject confirmation UI rendered inside Lumina chat
 * whenever an AI tool requests permission for a risky or destructive action.
 */

import React, { useEffect } from 'react'
import { ShieldAlert, Check, X } from 'lucide-react'
import { useAIApprovalStore } from './aiApprovalStore'
import './approval.css'

export const LuminaApprovalCard: React.FC = () => {
  const pendingApprovals = useAIApprovalStore((s) => s.pendingApprovals)
  const resolveApproval = useAIApprovalStore((s) => s.resolveApproval)
  const registerApprovalCard = useAIApprovalStore((s) => s.registerApprovalCard)

  useEffect(() => {
    return registerApprovalCard()
  }, [registerApprovalCard])

  if (!pendingApprovals || pendingApprovals.length === 0) return null

  return (
    <div className="lumina-approval-stack" role="region" aria-label="Pending AI Approvals">
      {pendingApprovals.map((item) => (
        <div
          key={item.id}
          className={`lumina-approval-card risk-${item.riskLevel}`}
          role="alertdialog"
          aria-labelledby={`approval-title-${item.id}`}
        >
          <div className="lumina-approval-header">
            <span className="lumina-approval-icon" aria-hidden="true">
              <ShieldAlert size={14} />
            </span>
            <span id={`approval-title-${item.id}`} className="lumina-approval-title">
              {item.actionLabel}
            </span>
            <span className="lumina-approval-tool">{item.toolName}</span>
          </div>

          <div className="lumina-approval-body">
            <div className="lumina-approval-target">{item.target}</div>
            {item.details && <div className="lumina-approval-details">{item.details}</div>}
          </div>

          <div className="lumina-approval-actions">
            <button
              type="button"
              className="lumina-approval-btn reject"
              onClick={() => resolveApproval(item.id, false)}
            >
              <X size={13} />
              <span>Reject</span>
            </button>
            <button
              type="button"
              className="lumina-approval-btn approve"
              onClick={() => resolveApproval(item.id, true)}
            >
              <Check size={13} />
              <span>Approve</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default LuminaApprovalCard
