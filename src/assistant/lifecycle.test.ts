import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/celebrate', () => ({ celebrateLab: () => {} }))
vi.mock('./llm', () => ({ requestLLMPlan: vi.fn(async () => null), askLLM: vi.fn(async () => null) }))

import { ALL_LABS } from '@/data/labs'
import { useNetworkStore } from '@/store/networkStore'
import { useCopilotStore } from '@/store/copilotStore'
import { runLabAssist } from './labAssist'
import { scanLab } from './diagnose'
import { executeChange } from './engine.core'
import { verifyAndCompleteLab, verifyLab } from '@/features/labs/verification'

/**
 * Ported from the removed scripts/verifyLifecycle.ts: lab switching hygiene,
 * completion persistence across a reload, and the takeover's visible feed.
 */

const net = () => useNetworkStore.getState()
const copilot = () => useCopilotStore.getState()
const load = (id: string) => net().loadLab(ALL_LABS.find((l) => l.id === id)!)

beforeEach(() => {
  localStorage.clear()
  net().resetAllLabs()
  load('wrong-gateway')
})
afterEach(() => vi.useRealTimers())

describe('lab open / switch hygiene', () => {
  it('opening a lab gives a fresh chat and an idle takeover', () => {
    expect(copilot().messages).toHaveLength(1)
    expect(copilot().labAssist).toMatchObject({ phase: 'idle', summary: null, busy: false })
    expect(copilot().labAssist.feed).toHaveLength(0)
    expect(copilot().pendingPlan).toBeNull()
    expect(net().devices.find((d) => d.hostname === 'PC-02')!.defaultGateway).toBe('10.1.10.254')
  })

  it('switching labs clears chat, plan, takeover feed, packets, trace and selection', () => {
    copilot().pushMessage({ id: 'u1', role: 'user', kind: 'text', text: 'hi' })
    copilot().setPendingPlan({ id: 'p', title: 't', rationale: [], changes: [] })
    copilot().pushTakeoverLine('stale line')
    net().logPacket({ source: 'a', destination: 'b', protocol: 'ICMP', path: [], status: 'success' })
    net().setPacketTrace({ id: 't', path: ['a'], success: true })
    net().selectDevice(net().devices[0].id)
    expect(copilot().messages).toHaveLength(2)

    load('interface-down')
    expect(copilot().messages).toHaveLength(1)
    expect(copilot().pendingPlan).toBeNull()
    expect(copilot().labAssist.feed).toHaveLength(0)
    expect(net().packets).toHaveLength(0)
    expect(net().packetTrace).toBeNull()
    expect(net().selectedDeviceId).toBeNull()
  })

  it('completion of one lab survives switching away and back, without leaking to others', () => {
    for (let i = 0; i < 3 && !verifyLab().solved; i++) scanLab().plan.forEach(executeChange)
    expect(verifyAndCompleteLab('wrong-gateway', false).solved).toBe(true)
    load('interface-down')
    expect(net().completedLabs['interface-down']).toBeUndefined()
    load('wrong-gateway')
    expect(net().completedLabs['wrong-gateway']?.completed).toBe(true)
    // the lab itself comes back broken (a fresh attempt)
    expect(verifyLab().solved).toBe(false)
  })
})

describe('completion persistence across a reload', () => {
  it('is written to localStorage and restored by a fresh store instance', async () => {
    for (let i = 0; i < 3 && !verifyLab().solved; i++) scanLab().plan.forEach(executeChange)
    verifyAndCompleteLab('wrong-gateway', true)
    const saved = JSON.parse(localStorage.getItem('netforge-lab-progress')!)
    expect(saved.v).toBe(1)
    expect(saved.data['wrong-gateway']).toMatchObject({ completed: true, aiAssisted: true })

    vi.resetModules() // simulate a page refresh
    const fresh = (await import('@/store/networkStore')).useNetworkStore
    expect(fresh.getState().completedLabs['wrong-gateway']?.completed).toBe(true)
    // the in-progress topology (already fixed) is also restored
    expect(fresh.getState().devices.find((d) => d.hostname === 'PC-02')!.defaultGateway).toBe('10.1.10.1')
  })

  it('reset-all clears completion in memory and in storage', () => {
    for (let i = 0; i < 3 && !verifyLab().solved; i++) scanLab().plan.forEach(executeChange)
    verifyAndCompleteLab('wrong-gateway', false)
    net().resetAllLabs()
    expect(net().completedLabs).toEqual({})
    expect(localStorage.getItem('netforge-lab-progress')).toBeNull()
  })
})

describe('takeover feed', () => {
  it('narrates the gateway change, runs real pings, and completes only after verification', async () => {
    vi.useFakeTimers()
    const done = runLabAssist('wrong-gateway')
    await vi.advanceTimersByTimeAsync(2000)
    expect(copilot().labAssist.phase).toBe('working')
    expect(copilot().labAssist.feed.length).toBeGreaterThan(0)
    expect(net().completedLabs['wrong-gateway']).toBeUndefined() // not before verification
    await vi.runAllTimersAsync()
    await done

    const feed = copilot().labAssist.feed.map((l) => l.text)
    expect(feed.some((t) => /gateway/i.test(t))).toBe(true)
    expect(feed.some((t) => /10\.1\.10\.254 → 10\.1\.10\.1/.test(t))).toBe(true)
    expect(net().packets.length).toBeGreaterThan(0)
    expect(verifyLab().solved).toBe(true)
    expect(net().completedLabs['wrong-gateway']?.completed).toBe(true)
  })
})
