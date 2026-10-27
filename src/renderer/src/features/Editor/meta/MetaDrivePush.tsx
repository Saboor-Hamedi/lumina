import React, { useState, useEffect, useRef, useCallback } from 'react'
import { CloudUpload, Check, AlertCircle } from 'lucide-react'
import { useUnsaved, UnsavedIndicator as UnsavedIndicatorRaw } from '../../../core/hooks/unsave'
import { useCurrentUser } from '../../../core/hooks/useCurrentUser'
import ToolTip from '../../../components/atoms/ToolTip'
import type { Snippet } from '../../../core/editor/types'

const UnsavedIndicator = UnsavedIndicatorRaw as React.FC<{
  style?: React.CSSProperties
  className?: string
  title?: string
}>

export interface MetaDrivePushProps {
  snippet?: Snippet | null
  title?: string
  isDirty?: boolean
}

/**
 * MetaDrivePush
 *
 * Header action button for on-demand Google Drive synchronization & backup.
 * Provides live visual state indicators: pushing (spinner), success (check), error (alert),
 * and unsaved change badge.
 */
export const MetaDrivePush: React.FC<MetaDrivePushProps> = ({
  snippet,
  title,
  isDirty: propIsDirty = false
}) => {
  const { isUnsaved, clearUnsaved } = useUnsaved(snippet?.id || '')
  const isDirty = Boolean(propIsDirty || isUnsaved)
  const { isLoggedIn } = useCurrentUser()
  const [isPushing, setIsPushing] = useState(false)
  const [justPushed, setJustPushed] = useState(false)
  const [pushError, setPushError] = useState(false)
  const [lastPushedAt, setLastPushedAt] = useState<number | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer))
    timersRef.current = []
  }, [])

  const setTrackedTimeout = useCallback((fn: () => void, delayMs: number) => {
    const timer = setTimeout(() => {
      timersRef.current = timersRef.current.filter((t) => t !== timer)
      fn()
    }, delayMs)
    timersRef.current.push(timer)
    return timer
  }, [])

  useEffect(() => {
    setJustPushed(false)
    setPushError(false)
    clearAllTimers()
    return () => {
      clearAllTimers()
    }
  }, [snippet?.id, clearAllTimers])

  if (!snippet) {
    return null
  }

  const handlePush = async (e: React.MouseEvent) => {
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
        if ((window as any).api?.cancelBackup) {
          await (window as any).api.cancelBackup()
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
      if ((window as any).api?.backupFile) {
        const activeTitle = (title || snippet.title || '').trim()
        let notePayload = {
          ...snippet,
          title: activeTitle || snippet.title
        }

        // If title was updated in editor, save first so local file on disk is renamed and synced
        if (activeTitle && activeTitle !== snippet.title && (window as any).api?.saveSnippet) {
          try {
            const saved = await (window as any).api.saveSnippet(notePayload)
            if (saved) {
              notePayload = { ...notePayload, ...saved }
            }
          } catch (saveErr) {
            console.warn('[MetaDrivePush] Note sync before push error:', saveErr)
          }
        }

        const res = await (window as any).api.backupFile(notePayload)

        if (res?.cancelled) {
          setIsPushing(false)
          return
        }

        if (res?.success) {
          setJustPushed(true)
          setLastPushedAt(Date.now())
          clearUnsaved()
          window.dispatchEvent(
            new CustomEvent('show-toast', {
              detail: {
                message: 'Successfully backed up',
                type: 'success'
              }
            })
          )
          setTrackedTimeout(() => {
            setJustPushed(false)
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
          setTrackedTimeout(() => setPushError(false), 3000)
        }
      }
    } catch (err: any) {
      setPushError(true)
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: {
            message: `❌ ${err?.message || 'Push failed'}`,
            type: 'error'
          }
        })
      )
      setTrackedTimeout(() => setPushError(false), 3000)
    } finally {
      setIsPushing(false)
    }
  }

  const noteName = title || snippet.title || (snippet as any).fileName || 'note'

  const tooltipText = !isLoggedIn
    ? 'Log in to Google Drive first'
    : isPushing
      ? `Pushing "${noteName}"... (Click to cancel)`
      : justPushed
        ? 'Successfully backed up'
        : pushError
          ? 'Failed to push — click to retry'
          : isDirty
            ? `Push changes to Google Drive (Unsaved edits pending push)`
            : lastPushedAt
              ? `Backed up (${new Date(lastPushedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) — click to re-push`
              : `Push "${noteName}" to Google Drive`

  const buttonClasses = [
    'meta-action-btn',
    justPushed && 'is-just-pushed',
    pushError && 'is-push-error',
    isPushing && 'is-pushing',
    isDirty && !justPushed && !pushError && !isPushing && 'is-dirty-pending'
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <ToolTip text={tooltipText} position="bottom">
      <button
        type="button"
        onClick={handlePush}
        disabled={justPushed}
        className={buttonClasses}
        aria-label={tooltipText}
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
              opacity: isPushing ? 1 : isDirty ? 1 : 0.8,
              color: isDirty ? 'var(--text-accent, #a78bfa)' : 'inherit'
            }}
          />
        )}
        <span>Push</span>
        {isDirty && !justPushed && !pushError && !isPushing && (
          <UnsavedIndicator
            style={{ marginLeft: '-1px' }}
            title="Unsaved changes pending push"
          />
        )}
      </button>
    </ToolTip>
  )
}

export default React.memo(MetaDrivePush)
