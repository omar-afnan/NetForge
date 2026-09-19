import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/celebrate', () => ({ celebrateLab: () => {} }))

import { ALL_LABS } from '@/data/labs'
import { useNetworkStore } from '@/store/networkStore'
import { scanLab } from '@/assistant/diagnose'
import { executeChange } from '@/assistant/engine.core'
import { verifyAndCompleteLab, verifyLab } from './verification'

/**
 * Lab regression suite. For every troubleshooting lab:
 *   1. healthy topology -> everything reachable
 *   2. inject the lab's faults -> expected connectivity failures
 *   3. run diagnosis -> problems + a fix plan
 *   4. apply the plan (the same code path the copilot / takeover uses)
 *   5. simulator confirms connectivity is restored
 *   6. lab completion is recorded ONLY after that verification
 */

interface LabCase {
  id: string
  /** Every failing row must be from one of these sources (undefined = not checked). */
  failingSources?: string[]
  /** At least this many ordered pairs fail after injection. */
  minFailing: number
  /** A failing row's reason must match (undefined = matrix stays green, objective fails instead). */
  reason?: RegExp
  /** The verification reason while unsolved. */
  unsolvedReason?: RegExp
}

const CASES: LabCase[] = [
  { id: 'wrong-gateway', failingSources: ['PC-02'], minFailing: 4, reason: /ARP resolution failed for gateway/ },
  { id: 'interface-down', minFailing: 24, reason: /Egress interface down/ },
  { id: 'missing-route', failingSources: ['PC-01', 'PC-02', 'PC-03'], minFailing: 12, reason: /No route to destination/ },
  { id: 'dhcp-lab', minFailing: 12, reason: /Invalid default gateway|Destination host unreachable/ },
  { id: 'dns-lab', minFailing: 0, unsolvedReason: /Objective not met/ },
  { id: 'nat-lab', failingSources: ['PC-01', 'PC-02', 'PC-03'], minFailing: 12, reason: /Next hop unreachable/ },
  { id: 'acl-lab', minFailing: 12, reason: /ARP resolution failed/ },
  { id: 'final-boss', minFailing: 20 },
]

const troubleshootingLabs = ALL_LABS.filter((l) => l.id !== 'starter')

function load(labId: string, opts: { healthy?: boolean } = {}) {
  const lab = ALL_LABS.find((l) => l.id === labId)!
  useNetworkStore.getState().loadLab(opts.healthy ? { ...lab, failures: [] } : lab)
  // The lab under test must be the "current" lab for completion purposes.
  return lab
}

beforeEach(() => {
  localStorage.clear()
  useNetworkStore.getState().resetAllLabs()
})

it('every troubleshooting lab has a regression case', () => {
  expect(CASES.map((c) => c.id).sort()).toEqual(troubleshootingLabs.map((l) => l.id).sort())
})

describe.each(CASES)('lab $id', (c) => {
  it('healthy topology: every endpoint pair reaches, lab objective satisfied', () => {
    load(c.id, { healthy: true })
    const v = verifyLab()
    expect(v.total).toBe(42)
    expect(v.passing).toBe(42)
    expect(v.solved).toBe(true)
  })

  it('fault injection breaks the expected connectivity and the lab is not solved', () => {
    load(c.id)
    const v = verifyLab()
    const failing = v.matrix.filter((t) => !t.success)
    expect(failing.length).toBeGreaterThanOrEqual(c.minFailing)
    if (c.failingSources) expect(failing.every((t) => c.failingSources!.includes(t.source))).toBe(true)
    if (c.reason) expect(failing.some((t) => c.reason!.test(t.detail))).toBe(true)
    expect(v.solved).toBe(false)
    if (c.unsolvedReason) expect(v.reason).toMatch(c.unsolvedReason)
    // Verification must not record a completion for an unsolved lab.
    expect(verifyAndCompleteLab(c.id, false).solved).toBe(false)
    expect(useNetworkStore.getState().completedLabs[c.id]).toBeUndefined()
  })

  it('diagnosis finds the problem and proposes fixes', () => {
    load(c.id)
    const scan = scanLab()
    expect(scan.problems.length).toBeGreaterThan(0)
    expect(scan.plan.length).toBeGreaterThan(0)
    // Every proposed change targets a device or link that exists right now.
    const { devices, links } = useNetworkStore.getState()
    for (const change of scan.plan) {
      if (change.kind === 'link-status') expect(links.some((l) => l.id === (change.payload as { linkId: string }).linkId)).toBe(true)
      else expect(devices.some((d) => d.hostname === change.deviceRef)).toBe(true)
    }
  })

  it('applying the proposed fixes restores connectivity and only then completes the lab', () => {
    load(c.id)
    let applied = 0
    for (let round = 0; round < 4 && !verifyLab().solved; round++) {
      for (const change of scanLab().plan) {
        const outcome = executeChange(change)
        expect(outcome.ok, `${change.summary}: ${outcome.report}`).toBe(true)
        applied++
      }
    }
    expect(applied).toBeGreaterThan(0)

    const v = verifyLab()
    expect(v.reason).toBeUndefined()
    expect(v.solved).toBe(true)
    expect(v.passing).toBe(v.total)

    // Applying changes alone never marks a lab complete...
    expect(useNetworkStore.getState().completedLabs[c.id]).toBeUndefined()
    // ...the verifier does.
    expect(verifyAndCompleteLab(c.id, true).solved).toBe(true)
    const record = useNetworkStore.getState().completedLabs[c.id]
    expect(record).toMatchObject({ completed: true, aiAssisted: true })
  })

  it('reset restores the broken lab and clears its completion', () => {
    load(c.id)
    for (let round = 0; round < 4 && !verifyLab().solved; round++) scanLab().plan.forEach(executeChange)
    verifyAndCompleteLab(c.id, false)
    expect(useNetworkStore.getState().completedLabs[c.id]).toBeTruthy()
    useNetworkStore.getState().resetLab()
    expect(useNetworkStore.getState().completedLabs[c.id]).toBeUndefined()
    expect(verifyLab().solved).toBe(false)
  })
})

describe('verifier guards', () => {
  it('the starter sandbox and blank workspace can never be "solved"', () => {
    useNetworkStore.getState().loadLab(ALL_LABS.find((l) => l.id === 'starter')!)
    expect(verifyAndCompleteLab('starter', true).solved).toBe(false)
    expect(useNetworkStore.getState().completedLabs.starter).toBeUndefined()
  })

  it('an empty topology is never solved (no vacuous truth)', () => {
    const lab = ALL_LABS.find((l) => l.id === 'wrong-gateway')!
    useNetworkStore.getState().loadLab({ ...lab, devices: [], links: [], failures: [] })
    const v = verifyLab()
    expect(v.total).toBe(0)
    expect(v.solved).toBe(false)
  })

  it('deleting the failing endpoint does not "fix" a lab', () => {
    load('wrong-gateway')
    const pc02 = useNetworkStore.getState().devices.find((d) => d.hostname === 'PC-02')!
    useNetworkStore.getState().removeDevice(pc02.id)
    const v = verifyLab()
    // Remaining pairs all pass, yet the lab is unsolved because an endpoint vanished.
    expect(v.passing).toBe(v.total)
    expect(v.solved).toBe(false)
    expect(v.reason).toMatch(/PC-02/)
    expect(verifyAndCompleteLab('wrong-gateway', false).solved).toBe(false)
  })

  it('a stale caller cannot complete a lab that is no longer loaded', () => {
    load('wrong-gateway', { healthy: true })
    const stale = verifyAndCompleteLab('missing-route', true)
    expect(stale.solved).toBe(false)
    expect(useNetworkStore.getState().completedLabs['missing-route']).toBeUndefined()
  })

  it('a healthy lab verifies as solved exactly once per completion', () => {
    load('wrong-gateway', { healthy: true })
    verifyAndCompleteLab('wrong-gateway', false)
    const first = useNetworkStore.getState().completedLabs['wrong-gateway']
    expect(first.attempts).toBe(1)
  })
})
