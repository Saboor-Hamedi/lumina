/**
 * Email Sound Service
 * Dedicated module for synthesizing and playing incoming email notification chimes.
 * Keeps all audio synthesis and audio context management isolated from UI components.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null

  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }

  return audioCtx
}

// Pre-unlock AudioContext on first user interaction to satisfy browser autoplay policies
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext()
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
  }
  window.addEventListener('click', unlockAudio, { once: true, passive: true })
  window.addEventListener('keydown', unlockAudio, { once: true, passive: true })
}

/**
 * Plays a gentle, uplifting 3-note crystal glass chime (G5 -> B5 -> E6).
 * Soft attack with natural exponential decay, designed specifically for non-intrusive email arrival.
 */
export function playNewEmailTone(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime

    // 3-note ascending crystal arpeggio: G5 (784Hz) -> B5 (987.77Hz) -> E6 (1318.5Hz)
    const notes = [
      { freq: 783.99, start: 0.0, duration: 0.22, peak: 0.22 },
      { freq: 987.77, start: 0.08, duration: 0.24, peak: 0.26 },
      { freq: 1318.51, start: 0.16, duration: 0.55, peak: 0.3 }
    ]

    notes.forEach(({ freq, start, duration, peak }) => {
      const noteStart = now + start

      // Primary tone (warm sine wave)
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, noteStart)

      // Natural soft attack (3ms) to avoid audio click, followed by smooth exponential decay
      gain.gain.setValueAtTime(0.001, noteStart)
      gain.gain.linearRampToValueAtTime(peak, noteStart + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(noteStart)
      osc.stop(noteStart + duration)

      // Subtle harmonic overtone for a pleasant glass bell sparkle
      const overtone = ctx.createOscillator()
      const overtoneGain = ctx.createGain()

      overtone.type = 'sine'
      overtone.frequency.setValueAtTime(freq * 2, noteStart)

      overtoneGain.gain.setValueAtTime(0.001, noteStart)
      overtoneGain.gain.linearRampToValueAtTime(peak * 0.18, noteStart + 0.005)
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration * 0.5)

      overtone.connect(overtoneGain)
      overtoneGain.connect(ctx.destination)

      overtone.start(noteStart)
      overtone.stop(noteStart + duration * 0.5)
    })
  } catch (err) {
    console.warn('[emailSoundService] Could not play notification tone:', err)
  }
}
