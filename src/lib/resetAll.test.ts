import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/celebrate', () => ({ celebrateLab: () => {} }))

import { ALL_LABS } from '@/data/labs'
import { useNetworkStore } from '@/store/networkStore'
import { useLearnProgress } from '@/store/progressStore'
import { useConceptMastery } from '@/store/masteryStore'
import { useDeviceLabStore } from '@/store/deviceLabStore'
import { useSettingsStore } from '@/store/settingsStore'
import { verifyAndCompleteLab } from '@/features/labs/verification'
import { scanLab } from '@/assistant/diagnose'
import { executeChange } from '@/assistant/engine.core'
import { ALL_STORAGE_KEYS, resetAllProgress } from './resetAll'

beforeEach(() => localStorage.clear())

function dirtyEverything() {
  const net = useNetworkStore.getState()
  net.loadLab(ALL_LABS.find((l) => l.id === 'wrong-gateway')!)
  scanLab().plan.forEach(executeChange)
  verifyAndCompleteLab('wrong-gateway', false)
  useLearnProgress.getState().toggleLesson('subnetting', 'ipv4-cidr')
  useConceptMastery.getState().bump('cidr', 40)
  useDeviceLabStore.getState().completeLesson('router', 'hostname')
  useSettingsStore.getState().updateSettings({ glowEffects: false })
}

describe('resetAllProgress', () => {
  it('clears memory and storage, and a reload cannot bring the old topology back', async () => {
    dirtyEverything()
    expect(localStorage.getItem('netforge-network')).not.toBeNull()

    resetAllProgress()

    // Nothing NetForge owns is left in storage (the network store used to re-save itself).
    for (const key of ALL_STORAGE_KEYS) expect(localStorage.getItem(key), key).toBeNull()

    // Simulated refresh: every store boots from defaults.
    vi.resetModules()
    const net = (await import('@/store/networkStore')).useNetworkStore.getState()
    expect(net.completedLabs).toEqual({})
    expect(net.lab.id).toBe('blank')
    expect(net.devices).toHaveLength(0)
    expect((await import('@/store/progressStore')).useLearnProgress.getState().lessons).toEqual({})
    expect((await import('@/store/masteryStore')).useConceptMastery.getState().scores.cidr).toBe(0)
    expect((await import('@/store/settingsStore')).useSettingsStore.getState().glowEffects).toBe(true)
    expect((await import('@/store/deviceLabStore')).useDeviceLabStore.getState().progress.router).toEqual([])
  })
})

describe('Device Lab persistence', () => {
  it('lesson progress and device config survive a refresh', async () => {
    useDeviceLabStore.getState().completeLesson('router', 'hostname')
    useDeviceLabStore.getState().sendCommand('router', 'enable')
    expect(JSON.parse(localStorage.getItem('netforge-device-lab')!).v).toBe(1)

    vi.resetModules()
    const fresh = (await import('@/store/deviceLabStore')).useDeviceLabStore.getState()
    expect(fresh.progress.router).toContain('hostname')
    expect(fresh.router.mode).toBe('privileged')
    expect(fresh.routerConsole.length).toBeGreaterThan(2)
  })
})
