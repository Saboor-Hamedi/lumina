import { Terminal } from './Terminal'

interface TerminalPanelProps {
  onClose?: () => void
  isMaximized?: boolean
  onToggleMaximize?: () => void
}

export function TerminalPanel({ onClose, isMaximized, onToggleMaximize }: TerminalPanelProps = {}) {
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <Terminal
        onClose={onClose}
        isMaximized={isMaximized}
        onToggleMaximize={onToggleMaximize}
      />
    </div>
  )
}

export default TerminalPanel
