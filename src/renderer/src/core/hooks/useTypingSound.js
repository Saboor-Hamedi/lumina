import { useEffect, useCallback } from 'react'
import { useSettingsStore } from '../store/useSettingsStore'

// Shared AudioContext and pre-generated buffer
let audioCtx = null
let clickBuffer = null

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }

  // Generate the sound buffer exactly once. This guarantees ZERO lag and NO CPU overhead during typing.
  if (!clickBuffer && audioCtx) {
    const sampleRate = audioCtx.sampleRate
    const length = Math.floor(sampleRate * 0.06) // 60ms click
    clickBuffer = audioCtx.createBuffer(1, length, sampleRate)
    const data = clickBuffer.getChannelData(0)

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate

      // Fast attack (2ms), exponential decay
      const envelope = t < 0.002 ? t / 0.002 : Math.exp(-(t - 0.002) * 60)

      // High-frequency noise for the plastic impact + a tiny resonance sweep
      const noise = (Math.random() * 2 - 1) * 0.6
      const resonance = Math.sin(2 * Math.PI * (800 - 4000 * t) * t) * 0.4

      data[i] = (noise + resonance) * envelope
    }
  }
  return audioCtx
}

export function useTypingSound() {
  const enabled = useSettingsStore((state) => state.settings?.typeSound === true)
  const volume = useSettingsStore((state) => state.settings?.typeSoundVolume ?? 50)

  const playSound = useCallback(() => {
    if (!enabled) return

    try {
      const ctx = initAudio()
      if (!ctx || !clickBuffer) return

      const source = ctx.createBufferSource()
      source.buffer = clickBuffer

      const gain = ctx.createGain()
      gain.gain.value = (volume / 100) * 0.4 // Master output level modifier

      source.connect(gain)
      gain.connect(ctx.destination)

      source.start()
    } catch (e) {
      console.warn('Audio playback error:', e)
    }
  }, [enabled, volume])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e) => {
      // Play only for actual typing (printable chars + some control keys)
      if (e.key.length !== 1 && !['Backspace', 'Enter', ' ', 'Tab'].includes(e.key)) return

      // Don't play if Ctrl/Alt/Meta is held (keyboard shortcuts)
      if (e.ctrlKey || e.altKey || e.metaKey) return

      // Fast check: Is focus inside the CodeMirror or ProseMirror editor?
      const target = e.target
      if (!target) return
      
      const isEditor = target.classList?.contains('cm-content') || 
                       target.classList?.contains('ProseMirror') ||
                       (target.closest && (target.closest('.cm-editor') || target.closest('.ProseMirror')))
      
      if (isEditor) {
        playSound()
      }
    }

    // Capture phase so we get it before anything stops propagation
    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [enabled, playSound])

  return { playSound }
}
