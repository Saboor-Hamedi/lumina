import React from 'react'
import GlobalErrorHandler from '../../../components/GlobalErrorHandler'
import { LazyTerminalPanel } from './useTerminalDock'

export interface TerminalDockSectionProps {
  hasMountedTerminal: boolean
  isTerminalVisible: boolean
  isTerminalMaximized: boolean
  terminalHeight: number
  onStartResize: (e: React.MouseEvent | React.PointerEvent) => void
  onResetHeight: () => void
  onClose: () => void
  onToggleMaximize: () => void
}

export const TerminalDockSection: React.FC<TerminalDockSectionProps> = ({
  hasMountedTerminal,
  isTerminalVisible,
  isTerminalMaximized,
  terminalHeight,
  onStartResize,
  onResetHeight,
  onClose,
  onToggleMaximize
}) => {
  if (!hasMountedTerminal) return null

  return (
    <>
      {isTerminalVisible && !isTerminalMaximized && (
        <div
          className="terminal-resizer top"
          title="Drag to resize terminal (double-click to reset 260px)"
          onPointerDown={onStartResize}
          onDoubleClick={onResetHeight}
        >
          <div className="resizer-knob-horizontal">
            <span className="knob-dot" />
            <span className="knob-dot" />
            <span className="knob-dot" />
          </div>
        </div>
      )}
      <div
        className="shell-terminal-dock"
        style={{
          height: isTerminalMaximized ? 'auto' : `${terminalHeight}px`,
          flex: isTerminalMaximized ? 1 : 'none',
          minHeight: isTerminalMaximized ? 0 : 120,
          width: '100%',
          display: isTerminalVisible ? 'flex' : 'none',
          flexDirection: 'column',
          position: 'relative',
          flexShrink: isTerminalMaximized ? 1 : 0,
          zIndex: 20
        }}
      >
        <GlobalErrorHandler>
          <React.Suspense fallback={null}>
            <LazyTerminalPanel
              onClose={onClose}
              isMaximized={isTerminalMaximized}
              onToggleMaximize={onToggleMaximize}
            />
          </React.Suspense>
        </GlobalErrorHandler>
      </div>
    </>
  )
}
