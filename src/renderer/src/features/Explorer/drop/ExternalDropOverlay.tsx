import React from 'react'
import { FolderDown } from 'lucide-react'
import './css/externaldropOverlay.css'

export interface ExternalDropOverlayProps {
  targetName?: string
  label?: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
}

const ExternalDropOverlay: React.FC<ExternalDropOverlayProps> = ({
  targetName = 'Vault',
  label,
  icon: Icon = FolderDown
}) => {
  return (
    <div className="external-drop-overlay">
      <div className="external-drop-pill">
        <Icon size={14} className="external-drop-icon" />
        <span className="external-drop-text">
          {label || `Drop into ${targetName}`}
        </span>
      </div>
    </div>
  )
}

export default React.memo(ExternalDropOverlay)
