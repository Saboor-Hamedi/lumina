import { useEffect } from 'react'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { Download, RefreshCw, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import './UpdateToast.css'

const UpdateToast = () => {
  const { status, updateInfo, progress, download, install } = useUpdateStore()

  const handleDownload = () => download()
  const handleInstall = () => install()
  const handleClose = () => useUpdateStore.setState({ status: 'idle' })

  // Auto-close "checking" state after 10 seconds if it gets stuck
  useEffect(() => {
    if (status === 'checking') {
      const timer = setTimeout(() => {
        useUpdateStore.setState({ status: 'idle' })
      }, 10000) // 10 seconds timeout
      return () => clearTimeout(timer)
    }
  }, [status])

  if (status === 'idle') return null

  return (
    <div className={`update-toast status-${status}`}>
      <div className="toast-content">
        {status === 'checking' && (
          <>
            <Loader2 className="toast-icon spin" size={16} />
            <span>Checking for updates...</span>
            <button className="toast-close" onClick={handleClose}><X size={14} /></button>
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
