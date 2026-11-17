/**
 * =========================================================================
 * Alarm & Timer Synthesizer (`alarmSound.ts`)
 * =========================================================================
 *
 * Uses the native Web Audio API to synthesize a crisp, pleasant chime.
 * - Zero network requests, 0 KB audio assets
 * - Works 100% offline and in low-latency mode
 * =========================================================================
 */

let sharedAudioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx()
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {})
    }
    return sharedAudioCtx
  } catch (err) {
    console.warn('[AlarmSound] Web Audio Context unavailable:', err)
    return null
  }
}

/**
 * Plays a modern 3-tone chime (F5 -> A5 -> C6 harmonic progression).
 */
export function playChimeSound(): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const notes = [
    { freq: 698.46, time: 0.0, duration: 0.2 }, // F5
    { freq: 880.0, time: 0.12, duration: 0.25 }, // A5
    { freq: 1046.5, time: 0.26, duration: 0.55 } // C6
  ]

  const now = ctx.currentTime

  notes.forEach(({ freq, time, duration }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now + time)

    // Smooth envelope attack and exponential decay
    gain.gain.setValueAtTime(0.0001, now + time)
    gain.gain.exponentialRampToValueAtTime(0.25, now + time + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now + time)
    osc.stop(now + time + duration + 0.05)
  })
}

/**
 * Plays an urgent alarm pulse (two repeated bright bells).
 */
export function playAlarmSound(): void {
  playChimeSound()
  setTimeout(() => {
    playChimeSound()
  }, 350)
  setTimeout(() => {
    playChimeSound()
  }, 700)
}
