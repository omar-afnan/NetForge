import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/celebrate', () => ({ celebrateLab: () => {} }))
vi.mock('./llm', () => ({ requestLLMPlan: vi.fn(async () => null), askLLM: vi.fn(async () => null) }))

import { ALL_LABS } from '@/data/labs'
import { useNetworkStore } from '@/store/networkStore'
import { useCopilotStore } from '@/store/copilotStore'
import { executeChange } from './engine.core'
import { runLabAssist } from './labAssist'
import { requestLLMPlan as mockedRequest } from './llm'
import {
  MAX_PLAN_CHANGES,
  parseLLMPlan,
  sanitizeChange,
  validateChange,
  validateReferences,
  validateSemantics,
} from './changeValidation'
import type { ProposedChange } from './types'
import { verifyLab } from '@/features/labs/verification'

const requestLLMPlan = vi.mocked(mockedRequest)

function loadLab(id: string) {
  useNetworkStore.getState().loadLab(ALL_LABS.find((l) => l.id === id)!)
  return () => ({ devices: useNetworkStore.getState().devices, links: useNetworkStore.getState().links })
}

const change = (kind: string, deviceRef: string | undefined, payload: Record<string, unknown>): ProposedChange => {
  const r = sanitizeChange({ kind, deviceRef, payload, summary: 's' })
  if (!('change' in r)) throw new Error(`fixture rejected: ${r.reason}`)
  return r.change
}

beforeEach(() => {
  localStorage.clear()
  useNetworkStore.getState().resetAllLabs()
  requestLLMPlan.mockReset()
  requestLLMPlan.mockResolvedValue(null)
})
afterEach(() => vi.useRealTimers())

/* ─────────────────────────── stage 1: schema ─────────────────────────── */

describe('AI plan parsing (strict schema)', () => {
  const wrap = (changes: unknown, extra: Record<string, unknown> = {}) => JSON.stringify({ reasoning: 'r', changes, ...extra })
  const okChange = { kind: 'gateway', deviceRef: 'PC-02', summary: 'x', payload: { gateway: '10.1.10.1' } }

  it.each([
    ['empty string', ''],
    ['plain prose', 'I fixed everything, the lab is solved!'],
    ['truncated JSON', '{"reasoning":"r","changes":[{"kind":"gate'],
    ['a JSON array', '[1,2,3]'],
    ['a JSON string', '"solved"'],
    ['null', 'null'],
    ['no changes key', '{"reasoning":"all good","solved":true}'],
    ['changes not an array', '{"changes":{"kind":"gateway"}}'],
    ['oversized reply', `{"changes":[],"pad":"${'x'.repeat(30_000)}"}`],
  ])('returns null for %s', (_name, reply) => {
    expect(parseLLMPlan(reply)).toBeNull()
  })

  it('accepts a fenced JSON block surrounded by prose', () => {
    const plan = parseLLMPlan('Sure!\n```json\n' + wrap([okChange]) + '\n```\nDone.')!
    expect(plan.changes).toHaveLength(1)
    expect(plan.reasoning).toBe('r')
  })

  it('treats an empty change list as a valid "nothing to do" plan', () => {
    const plan = parseLLMPlan(wrap([]))!
    expect(plan.changes).toEqual([])
    expect(plan.rejected).toEqual([])
  })

  it('marks accepted changes as AI-sourced with fresh ids (model-supplied ids ignored)', () => {
    const plan = parseLLMPlan(wrap([{ ...okChange, id: 'evil-id', source: 'local' }]))!
    expect(plan.changes[0].source).toBe('ai')
    expect(plan.changes[0].id).not.toBe('evil-id')
  })

  it.each([
    ['unknown kind', { kind: 'factory-reset', deviceRef: 'PC-02', payload: {} }],
    ['missing kind', { deviceRef: 'PC-02', payload: {} }],
    ['non-string kind', { kind: 7, deviceRef: 'PC-02', payload: {} }],
    ['not an object', 'gateway'],
    ['null entry', null],
    ['missing deviceRef', { kind: 'gateway', payload: { gateway: '10.1.10.1' } }],
    ['blank deviceRef', { kind: 'gateway', deviceRef: '  ', payload: { gateway: '10.1.10.1' } }],
    ['gateway not an IP', { kind: 'gateway', deviceRef: 'PC-02', payload: { gateway: 'router' } }],
    ['gateway octet > 255', { kind: 'gateway', deviceRef: 'PC-02', payload: { gateway: '10.1.10.256' } }],
    ['gateway with blank octet', { kind: 'gateway', deviceRef: 'PC-02', payload: { gateway: '10..10.1' } }],
    ['gateway as number', { kind: 'gateway', deviceRef: 'PC-02', payload: { gateway: 167774721 } }],
    ['interface without ip', { kind: 'interface', deviceRef: 'PC-02', payload: { interfaceRef: 'Eth0', prefix: 24 } }],
    ['interface without mask/prefix', { kind: 'interface', deviceRef: 'PC-02', payload: { interfaceRef: 'Eth0', ip: '10.1.10.5' } }],
    ['prefix 33', { kind: 'interface', deviceRef: 'PC-02', payload: { interfaceRef: 'Eth0', ip: '10.1.10.5', prefix: 33 } }],
    ['prefix -1', { kind: 'interface', deviceRef: 'PC-02', payload: { interfaceRef: 'Eth0', ip: '10.1.10.5', prefix: -1 } }],
    ['fractional prefix', { kind: 'interface', deviceRef: 'PC-02', payload: { interfaceRef: 'Eth0', ip: '10.1.10.5', prefix: 24.5 } }],
    ['string prefix', { kind: 'interface', deviceRef: 'PC-02', payload: { interfaceRef: 'Eth0', ip: '10.1.10.5', prefix: '24' } }],
    ['non-contiguous mask', { kind: 'interface', deviceRef: 'PC-02', payload: { interfaceRef: 'Eth0', ip: '10.1.10.5', mask: '255.0.255.0' } }],
    ['status not up/down', { kind: 'interface-status', deviceRef: 'PC-02', payload: { interfaceRef: 'Eth0', status: 'sideways' } }],
    ['link-status without linkId', { kind: 'link-status', payload: { status: 'up' } }],
    ['route-add without nextHop', { kind: 'route-add', deviceRef: 'R-01', payload: { destination: '10.1.20.0', prefix: 24 } }],
    ['route-add bad nextHop', { kind: 'route-add', deviceRef: 'R-01', payload: { destination: '10.1.20.0', prefix: 24, nextHop: 'x' } }],
  ])('rejects %s', (_name, bad) => {
    const plan = parseLLMPlan(wrap([bad, okChange]))!
    expect(plan.changes).toHaveLength(1) // only the good one survives
    expect(plan.rejected).toHaveLength(1)
  })

  it('caps the plan size', () => {
    const plan = parseLLMPlan(wrap(Array.from({ length: 40 }, () => okChange)))!
    expect(plan.changes).toHaveLength(MAX_PLAN_CHANGES)
    expect(plan.rejected.join(' ')).toMatch(/limit/)
  })

  it('strips control characters and caps free text; unknown payload keys are dropped', () => {
    const plan = parseLLMPlan(
      wrap([{ ...okChange, summary: 'a\u0000b\u001bc' + 'z'.repeat(500), detail: 'd'.repeat(999), payload: { gateway: '10.1.10.1', __proto__: { polluted: 1 }, extra: 'x' } }]),
    )!
    const c = plan.changes[0]
    expect(c.summary).not.toMatch(/[\u0000-\u001f]/)
    expect(c.summary.length).toBeLessThanOrEqual(200)
    expect(c.detail!.length).toBeLessThanOrEqual(300)
    expect(c.payload).toEqual({ gateway: '10.1.10.1' })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('never lets a claim of success through: the "solved" field is ignored', () => {
    const plan = parseLLMPlan(wrap([], { solved: true, labSolved: true, complete: true }))!
    expect(plan).not.toHaveProperty('solved')
    expect(Object.keys(plan).sort()).toEqual(['changes', 'reasoning', 'rejected'])
  })
})

/* ───────────────── stages 2-3: references and values ────────────────── */

describe('AI change validation against the live topology', () => {
  let net: ReturnType<typeof loadLab>
  beforeEach(() => {
    net = loadLab('wrong-gateway')
  })

  const verdict = (c: ProposedChange) => validateChange(c, net())
  const reason = (c: ProposedChange) => {
    const v = verdict(c)
    return v.ok ? undefined : v.reason
  }

  it('accepts the correct fix', () => {
    expect(verdict(change('gateway', 'PC-02', { gateway: '10.1.10.1' })).ok).toBe(true)
  })

  it('rejects references to devices, interfaces and links that do not exist', () => {
    expect(reason(change('gateway', 'GHOST-99', { gateway: '10.1.10.1' }))).toMatch(/does not exist/)
    expect(reason(change('interface-status', 'R-01', { interfaceRef: 'Gi9/9', status: 'up' }))).toMatch(/no interface/)
    expect(reason(change('link-status', undefined, { linkId: 'nope', status: 'up' }))).toMatch(/does not exist/)
    expect(reason(change('gateway', 'this', { gateway: '10.1.10.1' }))).toMatch(/does not exist/) // no "selected device" indirection
    expect(reason(change('gateway', '10.1.10.11', { gateway: '10.1.10.1' }))).toMatch(/does not exist/) // no lookup by IP
  })

  it('rejects gateways that are off-subnet, unusable, or on a router', () => {
    expect(reason(change('gateway', 'PC-02', { gateway: '10.9.9.9' }))).toMatch(/not on any subnet/)
    expect(reason(change('gateway', 'PC-02', { gateway: '224.0.0.1' }))).toMatch(/unicast/)
    expect(reason(change('gateway', 'PC-02', { gateway: '127.0.0.1' }))).toMatch(/unicast/)
    expect(reason(change('gateway', 'PC-02', { gateway: '10.1.10.11' }))).toMatch(/own address/)
    expect(reason(change('gateway', 'R-01', { gateway: '10.1.0.2' }))).toMatch(/only hosts/)
  })

  it('rejects unusable interface addresses', () => {
    const iface = (ip: string, extra: Record<string, unknown> = { prefix: 24 }) =>
      change('interface', 'PC-02', { interfaceRef: 'Eth0', ip, ...extra })
    expect(reason(iface('10.1.10.0'))).toMatch(/network address/)
    expect(reason(iface('10.1.10.255'))).toMatch(/broadcast/)
    expect(reason(iface('10.1.10.10'))).toMatch(/already used by PC-01/)
    expect(reason(iface('0.1.2.3'))).toMatch(/unicast/)
    expect(reason(iface('239.1.1.1'))).toMatch(/unicast/)
    expect(reason(iface('10.1.10.50', { prefix: 31 }))).toMatch(/not usable/)
    expect(reason(iface('10.1.10.50', { prefix: 0 }))).toMatch(/not usable/)
    expect(verdict(iface('10.1.10.50')).ok).toBe(true)
    expect(verdict(iface('10.1.10.11')).ok).toBe(true) // its own current address
  })

  it('keeps routes on routers and next hops on connected networks', () => {
    const add = (dev: string, nextHop: string, dest = '10.1.99.0') =>
      change('route-add', dev, { destination: dest, prefix: 24, nextHop })
    expect(reason(add('PC-01', '10.1.10.1'))).toMatch(/belong on routers/)
    expect(reason(add('R-01', '10.7.7.7'))).toMatch(/not on a network directly connected/)
    expect(reason(add('R-01', '10.1.0.1'))).toMatch(/own address/)
    expect(reason(add('R-01', '10.1.0.2', '10.1.20.0'))).toMatch(/already has that route/)
    expect(verdict(add('R-01', '10.1.0.2')).ok).toBe(true)
    expect(reason(change('route-remove', 'R-01', { destination: '10.99.0.0', prefix: 16 }))).toMatch(/no static route/)
    expect(verdict(change('route-remove', 'R-01', { destination: '10.1.20.0', prefix: 24 })).ok).toBe(true)
  })

  it('reference validation alone does not judge values (plan-time vs apply-time)', () => {
    const c = change('gateway', 'PC-02', { gateway: '10.9.9.9' })
    expect(validateReferences(c, net()).ok).toBe(true)
    expect(validateSemantics(c, net()).ok).toBe(false)
  })

  it('an order-dependent plan is judged step by step as it executes', () => {
    const state = () => useNetworkStore.getState()
    // Renumber PC-02 to a new subnet, THEN point its gateway at the new subnet.
    state().updateDevice(state().devices.find((d) => d.hostname === 'PC-02')!.id, { defaultGateway: undefined as never })
    const gw = change('gateway', 'PC-02', { gateway: '10.1.30.1' })
    expect(validateChange(gw, net()).ok).toBe(false)
    expect(executeChange(change('interface', 'PC-02', { interfaceRef: 'Eth0', ip: '10.1.30.5', prefix: 24 })).ok).toBe(true)
    expect(validateChange(gw, net()).ok).toBe(true)
  })
})

describe('executeChange refuses invalid AI changes without touching state', () => {
  it('leaves devices and links byte-for-byte unchanged', () => {
    loadLab('wrong-gateway')
    const before = JSON.stringify(useNetworkStore.getState().devices) + JSON.stringify(useNetworkStore.getState().links)
    const bad: ProposedChange[] = [
      change('gateway', 'PC-02', { gateway: '10.9.9.9' }),
      change('gateway', 'GHOST', { gateway: '10.1.10.1' }),
      change('interface', 'PC-02', { interfaceRef: 'Eth0', ip: '10.1.10.10', prefix: 24 }),
      change('interface', 'PC-02', { interfaceRef: 'Nope', ip: '10.1.10.77', prefix: 24 }),
      change('interface-status', 'PC-02', { interfaceRef: 'Nope', status: 'down' }),
      change('route-add', 'PC-02', { destination: '10.5.0.0', prefix: 24, nextHop: '10.1.10.1' }),
      change('link-status', undefined, { linkId: 'nope', status: 'down' }),
    ]
    for (const c of bad) {
      const r = executeChange(c)
      expect(r.ok, c.summary).toBe(false)
      expect(r.report).toMatch(/Rejected/)
    }
    expect(JSON.stringify(useNetworkStore.getState().devices) + JSON.stringify(useNetworkStore.getState().links)).toBe(before)
  })

  it('a locally-sourced change to a missing link no longer reports success', () => {
    loadLab('wrong-gateway')
    const r = executeChange({ id: 'x', kind: 'link-status', summary: 's', payload: { linkId: 'nope', status: 'up' } })
    expect(r.ok).toBe(false)
  })
})

/* ───────────────────────── the takeover run itself ─────────────────────── */

async function takeover(labId: string) {
  vi.useFakeTimers()
  const done = runLabAssist(labId)
  await vi.runAllTimersAsync()
  await done
  vi.useRealTimers()
  const s = useCopilotStore.getState().labAssist
  return { outcome: s.outcome, summary: s.summary, completed: !!useNetworkStore.getState().completedLabs[labId]?.completed }
}

const aiPlan = (changes: ProposedChange[], reasoning = 'AI reasoning', rejected: string[] = []) => ({ reasoning, changes, rejected })

describe('AI takeover: proposal -> validation -> apply -> simulator -> completion', () => {
  it('local planner (no AI available) solves a multi-fault lab and completes it via the verifier', async () => {
    loadLab('final-boss')
    const r = await takeover('final-boss')
    expect(r.outcome).toBe('success')
    expect(r.completed).toBe(true)
    expect(verifyLab().solved).toBe(true)
  })

  it('a valid AI plan is applied and then verified by the simulator', async () => {
    loadLab('wrong-gateway')
    requestLLMPlan.mockResolvedValueOnce(aiPlan([change('gateway', 'PC-02', { gateway: '10.1.10.1' })]))
    const r = await takeover('wrong-gateway')
    expect(r.outcome).toBe('success')
    expect(r.completed).toBe(true)
    expect(useNetworkStore.getState().devices.find((d) => d.hostname === 'PC-02')!.defaultGateway).toBe('10.1.10.1')
  })

  it('invalid AI changes are never applied; the local planner then solves the lab and only the simulator marks it complete', async () => {
    loadLab('wrong-gateway')
    const bogusOnly = aiPlan([
      change('gateway', 'PC-02', { gateway: '10.9.9.9' }),
      change('gateway', 'GHOST', { gateway: '10.1.10.1' }),
    ])
    const seen: string[] = []
    requestLLMPlan.mockImplementation(async () => {
      seen.push(String(useNetworkStore.getState().devices.find((d) => d.hostname === 'PC-02')!.defaultGateway))
      return bogusOnly
    })
    const r = await takeover('wrong-gateway')
    expect(seen[0]).toBe('10.1.10.254') // nothing applied before/after the first (rejected) round
    expect(useNetworkStore.getState().devices.find((d) => d.hostname === 'PC-02')!.defaultGateway).toBe('10.1.10.1') // fixed by the LOCAL planner
    expect(r.completed).toBe(verifyLab().solved)
    expect(r.completed).toBe(true)
  })

  it('an AI that merely CLAIMS the lab is solved does not solve it', async () => {
    loadLab('missing-route')
    requestLLMPlan.mockResolvedValue(aiPlan([], 'Everything is fixed. Lab solved! Mark it complete.'))
    const r = await takeover('missing-route')
    expect(r.completed).toBe(false)
    expect(r.outcome).toBe('partial')
    expect(verifyLab().solved).toBe(false)
  })

  it('a well-formed but ineffective AI change is applied, yet completion still follows the simulator only', async () => {
    loadLab('missing-route')
    requestLLMPlan.mockResolvedValue(aiPlan([change('interface-status', 'PC-01', { interfaceRef: 'Eth0', status: 'up' })]))
    const r = await takeover('missing-route')
    // The AI's change did nothing; the local planner fixed the route in round 2.
    expect(r.completed).toBe(verifyLab().solved)
    expect(useNetworkStore.getState().devices.find((d) => d.hostname === 'R-02')!.staticRoutes!.some((x) => x.destination === '10.1.20.0')).toBe(true)
  })

  it('a harmful-but-valid AI change (shutting an interface) is undone by the local planner; completion tracks the simulator', async () => {
    loadLab('wrong-gateway')
    requestLLMPlan.mockResolvedValue(aiPlan([change('interface-status', 'R-01', { interfaceRef: 'Gi0/0', status: 'down' })]))
    const r = await takeover('wrong-gateway')
    expect(useNetworkStore.getState().devices.find((d) => d.hostname === 'R-01')!.interfaces.find((i) => i.name === 'Gi0/0')!.status).toBe('up')
    expect(r.completed).toBe(verifyLab().solved)
  })

  it('a healthy-but-faultless sandbox is never marked complete by the takeover', async () => {
    useNetworkStore.getState().loadLab(ALL_LABS.find((l) => l.id === 'starter')!)
    const r = await takeover('starter')
    expect(r.outcome).toBe('noop')
    expect(r.completed).toBe(false)
  })

  it('switching labs mid-run aborts the takeover: nothing is applied to or completed on the new lab', async () => {
    loadLab('missing-route')
    vi.useFakeTimers()
    const done = runLabAssist('missing-route')
    await vi.advanceTimersByTimeAsync(1500)
    loadLab('nat-lab') // student loads another lab while the AI is working
    const before = JSON.stringify(useNetworkStore.getState().devices)
    await vi.runAllTimersAsync()
    await done
    vi.useRealTimers()
    expect(JSON.stringify(useNetworkStore.getState().devices)).toBe(before)
    expect(useNetworkStore.getState().completedLabs['missing-route']).toBeUndefined()
    expect(useNetworkStore.getState().completedLabs['nat-lab']).toBeUndefined()
  })

  it('a second takeover cannot start while one is running', async () => {
    loadLab('wrong-gateway')
    vi.useFakeTimers()
    const first = runLabAssist('wrong-gateway')
    const second = runLabAssist('wrong-gateway')
    await vi.runAllTimersAsync()
    await Promise.all([first, second])
    vi.useRealTimers()
    expect(useNetworkStore.getState().completedLabs['wrong-gateway']?.attempts).toBe(1)
  })
})
