import React from 'react'
import { Square, X, Minus } from 'lucide-react'
import { useVaultStore } from '../../core/store/useVaultStore'
import logoUrl from '../../assets/logo.png'
import './TitleBar.css'

const TitleBar = () => {
  const handleMinimize = () => window.api?.minimize()
  const handleToggleMaximize = () => window.api?.toggleMaximize()
  const handleClose = () => window.api?.closeWindow()

  const [version, setVersion] = React.useState('')
  const selectedSnippet = useVaultStore((s) => s.selectedSnippet)

  React.useEffect(() => {
    if (window.api?.getVersion) {
      window.api.getVersion().then(setVersion)
    }
  }, [])

  return (
    <div className="title-bar">
      <div className="title-left">
        <div className="app-logo">
          <img src={logoUrl} alt="Lumina Logo" style={{ width: 14, height: 14, objectFit: 'contain' }} />
          <span className="app-name">Lumina</span>
        </div>
      </div>

      <div className="title-center">
        {selectedSnippet ? (
          <span className="doc-title">{selectedSnippet.title}</span>
        ) : version ? (
          <span className="doc-title dim">v{version}</span>
        ) : null}
      </div>

      <div className="title-right">
        <div className="window-controls">
          <button onClick={handleMinimize} className="control-btn" title="Minimize">
            <Minus size={12} />
          </button>
          <button onClick={handleToggleMaximize} className="control-btn" title="Maximize">
            <Square size={11} />
          </button>
          <button onClick={handleClose} className="control-btn close" title="Close">
            <X size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default TitleBar
