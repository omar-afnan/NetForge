import { describe, expect, it } from 'vitest'
import { BENCHES, evalGoal, findBench, portWorld } from './hardwareBench'

describe('hardware bench data', () => {
  it('every bench has unique ids and consistent step/goal shape', () => {
    const ids = BENCHES.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const b of BENCHES) {
      // goal benches carry no ordered steps; step benches carry no goal
      if (b.goal) expect(b.steps).toHaveLength(0)
      else expect(b.steps.length).toBeGreaterThan(0)
    }
  })

  it('every step / cable / goal-check references a real port id', () => {
    for (const b of BENCHES) {
      const ports = new Set(b.nodes.flatMap((n) => n.ports.map((p) => p.id)))
      const nodeIds = new Set(b.nodes.map((n) => n.id))
      for (const s of b.steps) {
        if (s.from) expect(ports.has(s.from)).toBe(true)
        if (s.to) expect(ports.has(s.to)).toBe(true)
        if (s.target) expect(nodeIds.has(s.target)).toBe(true)
      }
      for (const c of b.initialCables ?? []) {
        expect(ports.has(c.from)).toBe(true)
        expect(ports.has(c.to)).toBe(true)
      }
      for (const chk of b.goal?.checklist ?? []) {
        if (chk.kind === 'powered' || chk.kind === 'uplink') expect(nodeIds.has(chk.node)).toBe(true)
        if (chk.kind === 'cabled') {
          expect(ports.has(chk.from)).toBe(true)
          expect(ports.has(chk.to)).toBe(true)
        }
      }
    }
  })

  it('portWorld returns a finite 3-vector for every port', () => {
    for (const b of BENCHES) {
      for (const n of b.nodes) {
        for (const p of n.ports) {
          const w = portWorld(n, p)
          expect(w).toHaveLength(3)
          expect(w.every((v) => Number.isFinite(v))).toBe(true)
        }
      }
    }
  })
})

describe('evalGoal', () => {
  const bench = findBench('hardware-challenge')!

  it('fails every check on an empty board', () => {
    const rows = evalGoal(bench, [], new Set())
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => !r.ok)).toBe(true)
  })

  it('passes every check once the network is correctly built and powered', () => {
    const cables = [
      { from: 'modem-eth', to: 'router-wan' },
      { from: 'switch-uplink', to: 'router-lan1' },
      { from: 'pc1-nic', to: 'switch-p1' },
      { from: 'pc2-nic', to: 'switch-p2' },
      { from: 'pc3-nic', to: 'switch-p3' },
    ]
    const rows = evalGoal(bench, cables, new Set(['router', 'switch']))
    expect(rows.every((r) => r.ok)).toBe(true)
  })

  it('still fails when one computer is left unplugged', () => {
    const cables = [
      { from: 'modem-eth', to: 'router-wan' },
      { from: 'switch-uplink', to: 'router-lan1' },
      { from: 'pc1-nic', to: 'switch-p1' },
      { from: 'pc2-nic', to: 'switch-p2' },
    ]
    const rows = evalGoal(bench, cables, new Set(['router', 'switch']))
    expect(rows.some((r) => !r.ok)).toBe(true)
  })

  it('fails the powered checks when the switch is off', () => {
    const cables = [
      { from: 'modem-eth', to: 'router-wan' },
      { from: 'switch-uplink', to: 'router-lan1' },
      { from: 'pc1-nic', to: 'switch-p1' },
      { from: 'pc2-nic', to: 'switch-p2' },
      { from: 'pc3-nic', to: 'switch-p3' },
    ]
    const rows = evalGoal(bench, cables, new Set(['router']))
    expect(rows.some((r) => !r.ok && /switch is powered/i.test(r.label))).toBe(true)
  })

  it('accepts the connection order-independently', () => {
    const cables = [
      { from: 'switch-p3', to: 'pc3-nic' },
      { from: 'router-lan1', to: 'switch-uplink' },
      { from: 'pc1-nic', to: 'switch-p1' },
      { from: 'router-wan', to: 'modem-eth' },
      { from: 'pc2-nic', to: 'switch-p2' },
    ]
    const rows = evalGoal(bench, cables, new Set(['router', 'switch']))
    expect(rows.every((r) => r.ok)).toBe(true)
  })
})
