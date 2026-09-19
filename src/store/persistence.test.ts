import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sanitizePersistedNetwork, sanitizeLabProgress } from './networkStore'
import { sanitizeSettings } from './settingsStore'
import { sanitizeLessons } from './progressStore'
import { sanitizeScores } from './masteryStore'
import { sanitizeDeviceLab } from './deviceLabStore'
import { sanitizeHistory } from '@/components/issues/issueWorkspace'
import { starterLab } from '@/data/labs/starterLab'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

/** Load the network store fresh, after seeding localStorage. */
async function freshNetworkStore(seed?: Record<string, string>) {
  localStorage.clear()
  for (const [k, v] of Object.entries(seed ?? {})) localStorage.setItem(k, v)
  vi.resetModules()
  return (await import('./networkStore')).useNetworkStore
}

describe('network store persistence', () => {
  const good = () => ({
    lab: clone(starterLab),
    baseline: { devices: clone(starterLab.devices), links: clone(starterLab.links) },
    devices: clone(starterLab.devices),
    links: clone(starterLab.links),
    failures: [],
    selectedDeviceId: starterLab.devices[0].id,
    selectedLinkId: null,
  })

  it('accepts a valid current-version payload', () => {
    const out = sanitizePersistedNetwork(good())!
    expect(out.devices).toHaveLength(starterLab.devices.length)
    expect(out.links).toHaveLength(starterLab.links.length)
    expect(out.selectedDeviceId).toBe(starterLab.devices[0].id)
  })

  it.each([null, 42, 'x', [], {}, { devices: 'no', links: [] }, { devices: [], links: 'no' }])(
    'rejects garbage %j',
    (raw) => {
      expect(sanitizePersistedNetwork(raw)).toBeNull()
    },
  )

  it('drops devices with bad type/missing id and links that dangle', () => {
    const raw: any = good()
    raw.devices.push({ id: 'x', hostname: 'X', type: 'toaster', interfaces: [] })
    raw.devices.push({ hostname: 'no-id', type: 'pc', interfaces: [] })
    raw.devices.push(null)
    raw.links.push({
      id: 'dangling',
      sourceDeviceId: 'ghost',
      targetDeviceId: raw.devices[0].id,
      sourceInterfaceId: 'a',
      targetInterfaceId: 'b',
    })
    const out = sanitizePersistedNetwork(raw)!
    expect(out.devices.map((d) => d.id)).not.toContain('x')
    expect(out.links.map((l) => l.id)).not.toContain('dangling')
    expect(out.devices).toHaveLength(starterLab.devices.length)
  })

  it('repairs unexpected values instead of passing them to the simulator', () => {
    const raw: any = good()
    const pc = raw.devices.find((d: any) => d.type === 'pc')
    pc.interfaces[0].ipAddress = '999.1.1.1'
    pc.interfaces[0].status = 'sideways'
    pc.defaultGateway = 'not-an-ip'
    pc.position = { x: 'a', y: null }
    pc.status = 'exploded'
    const out = sanitizePersistedNetwork(raw)!
    const fixed = out.devices.find((d) => d.id === pc.id)!
    expect(fixed.interfaces[0].ipAddress).toBeUndefined()
    expect(fixed.interfaces[0].status).toBe('up')
    expect(fixed.defaultGateway).toBeUndefined()
    expect(fixed.position).toBeUndefined()
    expect(fixed.status).toBe('healthy')
  })

  it('tolerates missing optional fields (lab, baseline, failures)', () => {
    const out = sanitizePersistedNetwork({ devices: good().devices, links: good().links })!
    expect(out.lab.id).toBe(starterLab.id)
    expect(out.failures).toEqual([])
    expect(out.baseline.devices.length).toBe(out.devices.length)
  })

  it('clears selection ids that point at nothing', () => {
    const raw: any = good()
    raw.selectedDeviceId = 'gone'
    raw.selectedLinkId = 'gone'
    const out = sanitizePersistedNetwork(raw)!
    expect(out.selectedDeviceId).toBeNull()
    expect(out.selectedLinkId).toBeNull()
  })

  it('boots the real store from legacy (unversioned) data', async () => {
    const store = await freshNetworkStore({
      'netforge-network': JSON.stringify({ ...good(), packetTrace: { junk: true }, packets: [1, 2] }),
    })
    expect(store.getState().devices).toHaveLength(starterLab.devices.length)
    expect(store.getState().packetTrace).toBeNull()
    expect(store.getState().simulator).toBeTruthy()
  })

  it('boots the real store from corrupt data and from unavailable storage', async () => {
    const corrupt = await freshNetworkStore({ 'netforge-network': '{{{oops', 'netforge-lab-progress': '[[[' })
    expect(corrupt.getState().completedLabs).toEqual({})
    expect(Array.isArray(corrupt.getState().devices)).toBe(true)

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    vi.resetModules()
    const blocked = (await import('./networkStore')).useNetworkStore
    expect(() => blocked.getState().addDevice('pc', { x: 0, y: 0 })).not.toThrow()
  })

  it('writes a versioned envelope with only durable state', async () => {
    const store = await freshNetworkStore()
    store.getState().addDevice('pc', { x: 1, y: 1 })
    const saved = JSON.parse(localStorage.getItem('netforge-network')!)
    expect(saved.v).toBe(1)
    expect(saved.data.devices.length).toBeGreaterThan(0)
    expect(saved.data.simulator).toBeUndefined()
    expect(saved.data.packets).toBeUndefined()
  })

  it('lab progress: keeps valid entries, scrubs starter, coerces bad numbers', () => {
    const out = sanitizeLabProgress({
      starter: { completed: true },
      'wrong-gateway': { completed: 'yes', completedAt: 5, attempts: -3, hintsUsed: 'x', aiAssisted: true },
      bad: 'nope',
    })!
    expect(out.starter).toBeUndefined()
    expect(out.bad).toBeUndefined()
    expect(out['wrong-gateway']).toEqual({ completed: false, completedAt: '', attempts: 0, hintsUsed: 0, aiAssisted: true })
    expect(sanitizeLabProgress([])).toBeNull()
  })
})

describe('settings store persistence', () => {
  it('falls back per-field and drops unknown keys', () => {
    const out = sanitizeSettings({ glowEffects: 'yes', compactTables: true, defaultTerminalDevice: 7, evil: 1 })!
    expect(out.glowEffects).toBe(true)
    expect(out.compactTables).toBe(true)
    expect(out.defaultTerminalDevice).toBe('PC-01')
    expect(out).not.toHaveProperty('evil')
    expect(sanitizeSettings('x')).toBeNull()
  })
})

describe('learn progress persistence', () => {
  it('keeps only well-formed lesson entries', () => {
    const out = sanitizeLessons({ lessons: { 'a/b': { completedAt: '2026-01-01' }, 'c/d': 5, 'e/f': null } })!
    expect(Object.keys(out)).toEqual(['a/b'])
    expect(sanitizeLessons({ lessons: [] })).toBeNull()
    expect(sanitizeLessons({})).toBeNull()
  })
})

describe('mastery persistence', () => {
  it('clamps, ignores unknown concepts and non-numbers', () => {
    const out = sanitizeScores({ scores: { cidr: 999, tcp: -5, udp: 'x', bogus: 50, dns: NaN, nat: 42.6 } })!
    expect(out.cidr).toBe(100)
    expect(out.tcp).toBe(0)
    expect(out.udp).toBe(0)
    expect(out.dns).toBe(0)
    expect(out.nat).toBe(43)
    expect(out).not.toHaveProperty('bogus')
    expect(sanitizeScores(null)).toBeNull()
  })
})

describe('device lab persistence', () => {
  it('returns a complete valid state from an empty object', () => {
    const out = sanitizeDeviceLab({})!
    expect(out.router.kind).toBe('router')
    expect(out.switch.kind).toBe('switch')
    expect(out.router.interfaces.length).toBeGreaterThan(0)
    expect(out.routerConsole.length).toBeGreaterThan(0)
    expect(out.progress).toEqual({ router: [], switch: [], server: [], pc: [] })
  })

  it('discards devices of the wrong kind and repairs bad field types', () => {
    const out = sanitizeDeviceLab({
      router: { kind: 'switch', hostname: 'HACK' },
      switch: {
        kind: 'switch',
        hostname: 42,
        mode: 'root',
        interfaces: [{ name: 'x' }, null],
        routes: 'no',
        badSecrets: -1,
        history: [1, 'show run'],
      },
      pc: { kind: 'pc', hostname: 'P', ip: '300.1.1.1', services: 'nope' },
      routerConsole: [{ text: 'ok', tone: 'weird' }, 5],
    })!
    expect(out.router.hostname).toBe('R1')
    expect(out.switch.hostname).toBe('SW1')
    expect(out.switch.mode).toBe('user')
    expect(out.switch.interfaces.length).toBeGreaterThan(0)
    expect(out.switch.routes).toEqual([])
    expect(out.switch.badSecrets).toBe(0)
    expect(out.switch.history).toEqual(['show run'])
    expect(out.pc.ip).toBeNull()
    expect(out.pc.services).toEqual({ web: false, dns: false, dhcp: false })
    expect(out.routerConsole).toEqual([expect.objectContaining({ text: 'ok', tone: 'out' })])
  })

  it('rejects non-objects', () => {
    expect(sanitizeDeviceLab(null)).toBeNull()
    expect(sanitizeDeviceLab([1])).toBeNull()
  })
})

describe('issue history persistence', () => {
  it('accepts legacy arrays and new envelopes, dropping junk', () => {
    const rec = { labId: 'a', issueTitle: 't', solvedBy: 'AI', attempts: 2, aiAssistance: 'Hint', time: '10:00' }
    expect(sanitizeHistory([rec, 5, { labId: '' }])).toEqual([rec])
    expect(sanitizeHistory({ records: [rec] })).toEqual([rec])
    expect(sanitizeHistory({ records: 'x' })).toBeNull()
    expect(sanitizeHistory([{ ...rec, solvedBy: 'Alien', aiAssistance: 'x' }])![0]).toMatchObject({
      solvedBy: 'Student',
      aiAssistance: 'None',
    })
  })
})
