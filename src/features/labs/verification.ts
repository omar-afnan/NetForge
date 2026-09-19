import { useNetworkStore } from '@/store/networkStore'
import { runConnectivityMatrix } from '@/assistant/tools'
import { getPrimaryInterface } from '@/network/devices'
import type { PingTest } from '@/assistant/types'
import type { PingResult } from '@/network/types'

/**
 * The ONE place that decides whether a lab is solved.
 *
 * Solved means: every PC/server endpoint the lab was built with is still
 * present and addressed, and the live NetworkSimulator can ping every ordered
 * pair of them. Nothing else counts - not an AI's claim, not a plan that
 * "should" work, not the fact that changes were applied. Every completion path
 * (student, copilot plan, AI takeover, WebMCP) goes through here.
 */
export interface LabVerification {
  labId: string
  solved: boolean
  passing: number
  total: number
  matrix: PingTest[]
  /** Why the lab is not solved (undefined when solved). */
  reason?: string
}

/** A ping meets an objective when it succeeds AND lands on the expected device. */
export function objectiveMet(result: PingResult, expectHost: string): boolean {
  return result.success && result.hops[result.hops.length - 1]?.toLowerCase() === expectHost.toLowerCase()
}

export function verifyLab(): LabVerification {
  const { lab, baseline, devices } = useNetworkStore.getState()
  const matrix = runConnectivityMatrix()
  const passing = matrix.filter((t) => t.success).length
  const base = { labId: lab.id, passing, total: matrix.length, matrix }

  if (lab.id === 'starter' || lab.id === 'blank') {
    return { ...base, solved: false, reason: 'This workspace has no lab objective to solve.' }
  }

  // Deleting an endpoint must not "fix" a lab by removing the thing that failed.
  const required = baseline.devices.filter(
    (d) => (d.type === 'pc' || d.type === 'server') && getPrimaryInterface(d)?.ipAddress,
  )
  const missing = required.filter((r) => {
    const live = devices.find((d) => d.id === r.id)
    return !live || !getPrimaryInterface(live)?.ipAddress
  })
  if (missing.length > 0) {
    return { ...base, solved: false, reason: `Required endpoint(s) missing or unaddressed: ${missing.map((d) => d.hostname).join(', ')}` }
  }

  // Lab-specific objectives the pairwise matrix cannot express.
  const { simulator } = useNetworkStore.getState()
  for (const objective of lab.objectives ?? []) {
    const result = simulator.ping(objective.from, objective.to)
    if (!objectiveMet(result, objective.expectHost)) {
      return { ...base, solved: false, reason: `Objective not met: ${objective.description}.` }
    }
  }

  if (matrix.length === 0) return { ...base, solved: false, reason: 'No endpoint pairs to test.' }
  if (passing !== matrix.length) {
    return { ...base, solved: false, reason: `${matrix.length - passing} of ${matrix.length} connectivity tests still failing.` }
  }
  return { ...base, solved: true }
}

/**
 * Re-verify against the simulator and only then record the completion. Safe to
 * call speculatively: a lab that is not actually solved is left untouched.
 * `labId` must be the lab currently on screen (guards stale async callers).
 */
export function verifyAndCompleteLab(labId: string, aiAssisted: boolean): LabVerification {
  const current = useNetworkStore.getState().lab.id
  if (labId !== current) {
    return { labId, solved: false, passing: 0, total: 0, matrix: [], reason: 'That lab is no longer loaded.' }
  }
  const verification = verifyLab()
  if (verification.solved) useNetworkStore.getState().completeLab(labId, aiAssisted)
  return verification
}
