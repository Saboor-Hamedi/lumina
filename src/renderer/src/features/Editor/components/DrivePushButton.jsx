import React, { useState, useEffect, useRef } from 'react'
import { CloudUpload, Check, AlertCircle } from 'lucide-react'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import ToolTip from '../../../components/atoms/ToolTip'

export const DrivePushButton = ({ snippet, title, isDirty: propIsDirty = false }) => {
  const dirtySnippetIds = useWorkspaceStore((s) => s.dirtySnippetIds)
  const isDirty = Boolean(propIsDirty || (snippet?.id && dirtySnippetIds.includes(snippet.id)))
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [justPushed, setJustPushed] = useState(false)
  const [pushError, setPushError] = useState(false)
  const [lastPushedAt, setLastPushedAt] = useState(null)
  const [wasPushedSinceEdit, setWasPushedSinceEdit] = useState(true)
  const btnRef = useRef(null)

  useEffect(() => {
    if (isDirty) {
      setWasPushedSinceEdit(false)
    }
  }, [isDirty])

  // Check login state on mount and on window focus/user change
  useEffect(() => {
    let mounted = true

    const checkLogin = async () => {
      try {
        if (window.api?.getGoogleUser) {
          const user = await window.api.getGoogleUser()
          if (mounted) {
            setIsLoggedIn(Boolean(user && user.token))
          }
        }
      } catch {
        if (mounted) setIsLoggedIn(false)
      }
    }

    checkLogin()

    const handleUserChanged = () => checkLogin()
    window.addEventListener('google-user-changed', handleUserChanged)
    window.addEventListener('focus', handleUserChanged)

    return () => {
      mounted = false
      window.removeEventListener('google-user-changed', handleUserChanged)
      window.removeEventListener('focus', handleUserChanged)
    }
  }, [])

  if (!snippet) {
    return null
  }

  const handlePush = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isLoggedIn) {
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: {
            message: 'Log in to Google Drive first',
            type: 'info'
          }
        })
      )
      return
    }

    if (isPushing) {
      try {
        if (window.api?.cancelBackup) {
          await window.api.cancelBackup()
        }
      } catch {}
      setIsPushing(false)
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: {
            message: 'Push cancelled',
            type: 'info'
          }
        })
      )
      return
    }

    setIsPushing(true)
    setPushError(false)

    try {
      if (window.api?.backupFile) {
        const activeTitle = (title || snippet.title || '').trim()
        let notePayload = {
          ...snippet,
          title: activeTitle || snippet.title
        }

        // If title was updated in editor, save first so local file on disk is renamed and synced
        if (activeTitle && activeTitle !== snippet.title && window.api?.saveSnippet) {
          try {
            const saved = await window.api.saveSnippet(notePayload)
            if (saved) {
              notePayload = { ...notePayload, ...saved }
            }
          } catch (saveErr) {
            console.warn('[DrivePushButton] Note sync before push error:', saveErr)
          }
        }

        const res = await window.api.backupFile(notePayload)

        if (res?.cancelled) {
          setIsPushing(false)
          return
        }

        if (res?.success) {
          setJustPushed(true)
          setLastPushedAt(Date.now())
          setWasPushedSinceEdit(true)
          if (snippet?.id) {
            useWorkspaceStore.getState().setDirty(snippet.id, false)
          }
          if (btnRef.current) {
            btnRef.current.style.background = 'transparent'
            btnRef.current.style.borderColor = 'transparent'
          }
          window.dispatchEvent(
            new CustomEvent('show-toast', {
              detail: {
                message: 'Successfully backed up',
                type: 'success'
              }
            })
          )
          setTimeout(() => {
            setJustPushed(false)
            if (btnRef.current) {
              btnRef.current.style.background = 'transparent'
              btnRef.current.style.borderColor = 'transparent'
            }
          }, 2500)
        } else {
          setPushError(true)
          const errorMsg = res?.error || 'Failed to push note'
          window.dispatchEvent(
            new CustomEvent('show-toast', {
              detail: {
                message: `❌ ${errorMsg}`,
                type: 'error'
              }
            })
          )
          setTimeout(() => setPushError(false), 3000)
        }
      }
    } catch (err) {
      setPushError(true)
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: {
            message: `❌ ${err.message || 'Push failed'}`,
            type: 'error'
          }
        })
      )
      setTimeout(() => setPushError(false), 3000)
    } finally {
      setIsPushing(false)
    }
  }

  const noteName = title || snippet.title || snippet.fileName || 'note'

  return (
    <>
      <style>{`
        @keyframes drivePushSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes drivePushPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.95); }
        }
        .drive-push-icon-rotating {
          animation: drivePushSpin 1s linear infinite, drivePushPulse 1.2s ease-in-out infinite;
        }
      `}</style>
      <ToolTip
        text={
          !isLoggedIn
            ? 'Log in to Google Drive first'
            : isPushing
              ? `Pushing "${noteName}"... (Click to cancel)`
              : justPushed
                ? 'Successfully backed up'
                : pushError
                  ? 'Failed to push — click to retry'
                  : (!wasPushedSinceEdit || isDirty)
                    ? `Push changes to Google Drive (Unsaved edits pending push)`
                    : lastPushedAt
                      ? `Backed up (${new Date(lastPushedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) — click to re-push`
                      : `Push "${noteName}" to Google Drive`
        }
        position="bottom"
      >
        <button
          ref={btnRef}
          onClick={handlePush}
          disabled={justPushed}
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            borderRadius: '5px',
            height: '21px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            cursor: justPushed ? 'default' : 'pointer',
            color: justPushed
              ? '#22c55e'
              : pushError
                ? '#ef4444'
                : isPushing
                  ? 'var(--text-accent, #a78bfa)'
                  : (!wasPushedSinceEdit || isDirty)
                    ? 'var(--text-main, #f8fafc)'
                    : 'var(--text-muted, #94a3b8)',
            transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
            padding: '0 6px',
            gap: '4px',
            fontSize: '11px',
            fontWeight: (!wasPushedSinceEdit || isDirty) ? 500 : 400
          }}
          onMouseEnter={(e) => {
            if (!isPushing && !justPushed && !pushError) {
              e.currentTarget.style.color = 'var(--text-main, #f8fafc)'
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isPushing && !justPushed && !pushError) {
              e.currentTarget.style.color = (!wasPushedSinceEdit || isDirty)
                ? 'var(--text-main, #f8fafc)'
                : 'var(--text-muted, #94a3b8)'
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
            }
          }}
        >
          {justPushed ? (
            <Check size={11} style={{ color: '#22c55e' }} />
          ) : pushError ? (
            <AlertCircle size={11} style={{ color: '#ef4444' }} />
          ) : (
            <CloudUpload
              size={11}
              className={isPushing ? 'drive-push-icon-rotating' : ''}
              style={{
                opacity: isPushing ? 1 : (!wasPushedSinceEdit || isDirty) ? 1 : 0.8,
                color: (!wasPushedSinceEdit || isDirty) ? 'var(--text-accent, #a78bfa)' : 'inherit'
              }}
            />
          )}
          <span>Push</span>
          {(!wasPushedSinceEdit || isDirty) && !justPushed && !pushError && !isPushing && (
            <div
              className="dirty-indicator"
              style={{
                marginLeft: '-1px'
              }}
              title="Unsaved changes pending push"
            />
          )}
        </button>
      </ToolTip>
    </>
  )
}

export default DrivePushButton
