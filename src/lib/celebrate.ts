import confetti from 'canvas-confetti'

/**
 * Multi-fire "realistic" celebration burst. Firing several small volleys with
 * different spread / velocity / decay mixes the particle shapes and paths so
 * the cone never looks like one perfectly uniform shot.
 */
export function celebrateLab() {
  const count = 200
  const defaults = { origin: { y: 0.7 } }

  const fire = (particleRatio: number, opts: confetti.Options) => {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    })
  }

  fire(0.25, { spread: 26, startVelocity: 55 })
  fire(0.2, { spread: 60 })
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 })
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
  fire(0.1, { spread: 120, startVelocity: 45 })
}
