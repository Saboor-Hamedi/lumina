/**
 * =========================================================================
 * In-App Notification Service (`notificationService.ts`)
 * =========================================================================
 *
 * Dispatches Lumina's native borderless centered modal notification and
 * plays the synthesized Web Audio chime. Zero OS/browser notification popups.
 * =========================================================================
 */

import { playAlarmSound } from './alarmSound'

export interface NotifyOptions {
  readonly title: string
  readonly body: string
  readonly playSound?: boolean
}

export function notifyUser({ title, body, playSound = true }: NotifyOptions): void {
  if (playSound) {
    playAlarmSound()
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('lumina:calendar-alert', {
        detail: { title, body, timestamp: Date.now() }
      })
    )
  }
}
