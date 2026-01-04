import React, { useEffect } from 'react'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { Download, RefreshCw, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import './UpdateToast.css'

const UpdateToast = () => {
  const { status, updateInfo, progress, error, download, install, check } = useUpdateStore()
  
  // Auto-hide error/toast after delay?
  // For 'downloading' and 'ready', keep open.
  
  if (status === 'idle') return null

  // Optional: Don't show "checking" or "not-available" to keep it non-intrusive?
  // User asked for "sign there is a new update or not", so maybe show "checking" -> "up to date" then hide.
  
  const isSilent = status === 'checking' || status === 'not-available'
  // But user complained "shows no sign", so maybe they WANT to see "Checking..." then "Up to date".
  // Let's show everything for now, can refine later.

  const handleDownload = () => download()
  const handleInstall = () => install()
  const handleClose = () => useUpdateStore.setState({ status: 'idle' })

  return (
    <div className={`update-toast status-${status}`}>
      <div className="toast-content">
        {status === 'checking' && (
          <>
            <Loader2 className="toast-icon spin" size={16} />
            <span>Checking for updates...</span>
          </>
        )}

        {status === 'not-available' && (
          <>
            <CheckCircle className="toast-icon" size={16} />
            <span>You are up to date.</span>
            <button className="toast-close" onClick={handleClose}><X size={14} /></button>
          </>
        )}

        {status === 'available' && (
          <>
            <Download className="toast-icon" size={16} />
            <div className="toast-text">
              <div className="toast-title">Update Available</div>
              <div className="toast-desc">v{updateInfo?.version}</div>
            </div>
            <button className="toast-action" onClick={handleDownload}>Download</button>
            <button className="toast-close" onClick={handleClose}><X size={14} /></button>
          </>
        )}

        {status === 'downloading' && (
          <>
            <Loader2 className="toast-icon spin" size={16} />
             <div className="toast-text">
              <div className="toast-title">Downloading...</div>
              <div className="toast-progress-bar">
                <div 
                  className="toast-progress-fill" 
                  style={{ width: `${progress?.percent || 0}%` }}
                />
              </div>
            </div>
          </>
        )}

        {status === 'ready' && (
          <>
            <RefreshCw className="toast-icon" size={16} />
            <div className="toast-text">
              <div className="toast-title">Update Ready</div>
              <div className="toast-desc">Restart to apply</div>
            </div>
            <button className="toast-action" onClick={handleInstall}>Restart</button>
            <button className="toast-close" onClick={handleClose}><X size={14} /></button>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="toast-icon error" size={16} />
            <div className="toast-text">
              <div className="toast-title">Update Failed</div>
              <div className="toast-desc">Check logs</div>
            </div>
            <button className="toast-close" onClick={handleClose}><X size={14} /></button>
          </>
        )}
      </div>
    </div>
  )
}

export default UpdateToast
