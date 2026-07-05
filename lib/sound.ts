'use client'

// Soft two-tone chime generated with WebAudio — no asset to load.
// Browsers unlock audio after the first user gesture; failures are silent.
let ctx: AudioContext | null = null

function tone(freq: number, startAt: number, duration: number, peak: number) {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  const t = ctx.currentTime + startAt
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  o.connect(g)
  g.connect(ctx.destination)
  o.start(t)
  o.stop(t + duration + 0.05)
}

export function playNotificationSound() {
  try {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('notifSound') === 'off') return
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    ctx = ctx || new AC()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    tone(880, 0, 0.3, 0.08)      // A5
    tone(1318.5, 0.11, 0.35, 0.06) // E6
  } catch { /* audio blocked — ignore */ }
}

/** Lighter blip for incoming chat messages in an open thread. */
export function playMessageSound() {
  try {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('notifSound') === 'off') return
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    ctx = ctx || new AC()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    tone(659.25, 0, 0.22, 0.06) // E5
  } catch { /* ignore */ }
}
