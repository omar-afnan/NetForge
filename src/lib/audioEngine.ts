/**
 * AudioEngine — synthesized Web Audio feedback for NetForge network events.
 *
 * All sounds are generated programmatically via the Web Audio API so there are
 * no asset dependencies.  The engine is a singleton; call the exported helpers
 * from anywhere in the app.
 *
 * Usage:
 *   import { playPingSuccess, playPingFailure, playLinkUp, playLinkDown } from '@/lib/audioEngine'
 *
 * The AudioContext is created lazily on first play to satisfy browser autoplay
 * policies.
 */

let _ctx: AudioContext | null = null

function ctx(): AudioContext {
  if (!_ctx) {
    _ctx = new AudioContext()
  }
  // Resume if suspended (browser policy after user gesture requirement).
  if (_ctx.state === 'suspended') void _ctx.resume()
  return _ctx
}

/** Short sine beep at `freq` Hz, `duration` seconds, fading out. */
function tone(freq: number, duration = 0.12, volume = 0.28): void {
  const c = ctx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.frequency.value = freq
  osc.type = 'sine'
  gain.gain.setValueAtTime(volume, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + duration + 0.01)
}

/** White-noise burst used for failure/error sounds. */
function noise(duration = 0.18, volume = 0.12): void {
  const c = ctx()
  const bufLen = Math.ceil(c.sampleRate * duration)
  const buf = c.createBuffer(1, bufLen, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const gain = c.createGain()
  src.connect(gain)
  gain.connect(c.destination)
  gain.gain.setValueAtTime(volume, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  src.start(c.currentTime)
}

/** Rising two-tone chime — ping success. */
export function playPingSuccess(): void {
  tone(880, 0.10, 0.25)
  setTimeout(() => tone(1320, 0.14, 0.25), 90)
}

/** Low buzz + noise — ping failure. */
export function playPingFailure(): void {
  tone(220, 0.25, 0.20)
  setTimeout(() => noise(0.18, 0.12), 50)
}

/** Two quick high pings — link came up. */
export function playLinkUp(): void {
  tone(660, 0.07, 0.18)
  setTimeout(() => tone(990, 0.10, 0.22), 70)
}

/** Single low tone — link went down. */
export function playLinkDown(): void {
  tone(330, 0.20, 0.18)
}

/** Rising "task complete" fanfare. */
export function playTaskComplete(): void {
  tone(523, 0.10, 0.22)
  setTimeout(() => tone(659, 0.10, 0.22), 100)
  setTimeout(() => tone(784, 0.10, 0.22), 200)
  setTimeout(() => tone(1047, 0.18, 0.26), 300)
}

/** Soft click — UI interaction feedback. */
export function playUIClick(): void {
  tone(1200, 0.04, 0.10)
}

/** Error / warning buzzer. */
export function playError(): void {
  tone(180, 0.22, 0.22)
  setTimeout(() => tone(160, 0.18, 0.18), 180)
}
