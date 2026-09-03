import React from 'react'
import { FolderDown } from 'lucide-react'
import './ExternalDropOverlay.css'

const ExternalDropOverlay = ({ targetName = 'Vault' }) => {
  return (
    <div className="external-drop-overlay">
      <div className="external-drop-pill">
        <FolderDown size={14} className="external-drop-icon" />
        <span className="external-drop-text">Drop into {targetName}</span>
      </div>
    </div>
  )
}

export default React.memo(ExternalDropOverlay)
