import React from 'react'
import { FolderDown } from 'lucide-react'
import './css/externaldropOverlay.css'

export interface ExternalDropOverlayProps {
  targetName?: string
  label?: string
  count?: number
  icon?: React.ComponentType<{ size?: number; className?: string }>
}

const ExternalDropOverlay: React.FC<ExternalDropOverlayProps> = ({
  targetName = 'Vault',
  label,
  count,
  icon: Icon = FolderDown
}) => {
  return (
    <div className="external-drop-overlay">
      <div className="external-drop-pill">
        <Icon size={14} className="external-drop-icon" />
        <span className="external-drop-text">
          {label || `Drop into ${targetName}`}
        </span>
        {count && count > 1 ? (
          <span className="external-drop-badge">{count}</span>
        ) : null}
      </div>
    </div>
  )
}

export default React.memo(ExternalDropOverlay)
