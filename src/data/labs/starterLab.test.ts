import { describe, expect, it } from 'vitest'
import { buildStarterTopology } from './starterLab'
import { ALL_LABS } from './index'
import { NetworkSimulator } from '@/network/simulator'

describe('starter (competition) lab', () => {
  const { devices, links } = buildStarterTopology()
  const sim = new NetworkSimulator(devices, links)

  it('same-subnet hosts reach each other across SW-01', () => {
    const r = sim.ping('PC-01', 'PC-02')
    expect(r.success).toBe(true)
  })

  it('a PC reaches a server three routers away', () => {
    const r = sim.ping('PC-01', 'SRV-01')
    expect(r.success).toBe(true)
    expect(r.hops).toEqual(expect.arrayContaining(['PC-01', 'R-01', 'R-02', 'R-03', 'SRV-01']))
  })

  it('the whole baseline topology is healthy (every host pair reachable)', () => {
    const hosts = devices.filter((d) => d.type === 'pc' || d.type === 'server').map((d) => d.hostname)
    for (const a of hosts) {
      for (const b of hosts) {
        if (a === b) continue
        expect(sim.ping(a, b).success, `${a} -> ${b}`).toBe(true)
      }
    }
  })
})

describe('lab catalogue', () => {
  it('every lab has a unique id and at least one device', () => {
    const ids = ALL_LABS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const l of ALL_LABS) {
      expect(l.devices.length).toBeGreaterThan(0)
      expect(l.links.length).toBeGreaterThan(0)
    }
  })
})
