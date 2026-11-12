/** Optional chime for live events (off by default, remembered per browser). */
const KEY = "hyrr.sound.newApplicant"

export function newApplicantSoundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "on"
  } catch {
    return false
  }
}

export function setNewApplicantSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off")
  } catch {
    // storage blocked: the setting just doesn't persist
  }
}

/** Two soft notes generated with Web Audio (no audio file to ship or cache). */
export function playChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    ;[880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      const start = now + i * 0.12
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.12, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.4)
    })
    setTimeout(() => void ctx.close(), 900)
  } catch {
    // autoplay blocked or no audio device
  }
}
