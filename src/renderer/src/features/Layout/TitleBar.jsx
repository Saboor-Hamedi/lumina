import React from 'react'
import { Square, X, Minus, Search, MessageSquare } from 'lucide-react'
import { useVaultStore } from '../../core/store/useVaultStore'
import logoUrl from '../../assets/logo.png'
import ToolTip from '../../components/atoms/ToolTip'
import './TitleBar.css'

const TitleBar = ({ onToggleAIChat }) => {
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
    <div className="title-bar" data-testid="title-bar">
      <div className="title-left">
        <div className="app-logo">
          <div
            style={{
              width: 14,
              height: 14,
              backgroundColor: 'var(--text-accent)',
              maskImage: `url(${logoUrl})`,
              WebkitMaskImage: `url(${logoUrl})`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center'
            }}
          />
          <span className="app-name" data-testid="app-name">
            Lumina
          </span>
        </div>
      </div>

      <div className="title-center">
        <div 
          className="unified-search-bar"
          onClick={() => window.dispatchEvent(new CustomEvent('open-ask-anything'))}
        >
          <span className="search-icon"><Search size={12} /></span>
          <span className="search-placeholder">Ask anything or Search...</span>
          <span className="search-shortcut">Ctrl+P</span>
        </div>
      </div>

      <div className="title-right">
        <div className="window-controls" data-testid="window-controls">
          <ToolTip text="AI Chat" position="bottom">
            <button onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chat'))} className="control-btn" style={{ color: 'var(--text-accent)' }}>
              <MessageSquare size={14} strokeWidth={2} />
            </button>
          </ToolTip>
          <ToolTip text="Minimize" position="bottom">
            <button onClick={handleMinimize} className="control-btn">
              <Minus size={14} strokeWidth={2} />
            </button>
          </ToolTip>
          <ToolTip text="Maximize" position="bottom">
            <button onClick={handleToggleMaximize} className="control-btn">
              <Square size={14} strokeWidth={2} />
            </button>
          </ToolTip>
          <ToolTip text="Close" position="bottom">
            <button onClick={handleClose} className="control-btn close">
              <X size={14} strokeWidth={2} />
            </button>
          </ToolTip>
        </div>
      </div>
    </div>
  )
}

export default TitleBar
