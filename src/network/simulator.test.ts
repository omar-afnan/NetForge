import { describe, expect, it } from 'vitest'
import { NetworkSimulator } from './simulator'
import type { Device, NetworkLink } from './types'

/**
 * Build PC-A ─ SW1 ─ R1 ─ SW2 ─ PC-C  (PC-B also hangs off SW1).
 *   10.0.1.0/24 on the left, 10.0.2.0/24 on the right.
 * Every value is overridable so a test can inject a fault.
 */
function topology(opts: {
  aMask?: string
  noGateway?: boolean
  bStatus?: 'up' | 'down'
} = {}): { devices: Device[]; links: NetworkLink[] } {
  const { aMask = '255.255.255.0', noGateway = false, bStatus = 'up' } = opts
  const aGateway = noGateway ? undefined : '10.0.1.1'

  const iface = (id: string, name: string, ip: string, mask: string, mac: string, link: string, status: 'up' | 'down' = 'up') => ({
    id, name, ipAddress: ip, subnetMask: mask, macAddress: mac, status, connectedLinkId: link,
  })

  const pcA: Device = {
    id: 'a', hostname: 'PC-A', type: 'pc', status: 'healthy',
    defaultGateway: aGateway,
    interfaces: [iface('a-e0', 'Eth0', '10.0.1.10', aMask, 'AA:00:00:00:00:0A', 'la')],
  }
  const pcB: Device = {
    id: 'b', hostname: 'PC-B', type: 'pc', status: 'healthy',
    defaultGateway: '10.0.1.1',
    interfaces: [iface('b-e0', 'Eth0', '10.0.1.20', '255.255.255.0', 'AA:00:00:00:00:0B', 'lb', bStatus)],
  }
  const pcC: Device = {
    id: 'c', hostname: 'PC-C', type: 'pc', status: 'healthy',
    defaultGateway: '10.0.2.1',
    interfaces: [iface('c-e0', 'Eth0', '10.0.2.10', '255.255.255.0', 'AA:00:00:00:00:0C', 'le')],
  }
  const sw1: Device = {
    id: 'sw1', hostname: 'SW1', type: 'switch', status: 'healthy',
    interfaces: [
      { id: 'sw1-f1', name: 'Fa0/1', macAddress: 'BB:00:00:00:01:01', status: 'up', connectedLinkId: 'la' },
      { id: 'sw1-f2', name: 'Fa0/2', macAddress: 'BB:00:00:00:01:02', status: 'up', connectedLinkId: 'lb' },
      { id: 'sw1-f3', name: 'Fa0/3', macAddress: 'BB:00:00:00:01:03', status: 'up', connectedLinkId: 'lc' },
    ],
  }
  const sw2: Device = {
    id: 'sw2', hostname: 'SW2', type: 'switch', status: 'healthy',
    interfaces: [
      { id: 'sw2-f1', name: 'Fa0/1', macAddress: 'BB:00:00:00:02:01', status: 'up', connectedLinkId: 'ld' },
      { id: 'sw2-f2', name: 'Fa0/2', macAddress: 'BB:00:00:00:02:02', status: 'up', connectedLinkId: 'le' },
    ],
  }
  const r1: Device = {
    id: 'r1', hostname: 'R1', type: 'router', status: 'healthy',
    interfaces: [
      iface('r1-g0', 'Gi0/0', '10.0.1.1', '255.255.255.0', 'CC:00:00:00:00:01', 'lc'),
      iface('r1-g1', 'Gi0/1', '10.0.2.1', '255.255.255.0', 'CC:00:00:00:00:02', 'ld'),
    ],
  }

  const link = (id: string, sd: string, si: string, td: string, ti: string): NetworkLink => ({
    id, sourceDeviceId: sd, sourceInterfaceId: si, targetDeviceId: td, targetInterfaceId: ti, status: 'up', kind: 'copper',
  })

  return {
    devices: [pcA, pcB, pcC, sw1, sw2, r1],
    links: [
      link('la', 'a', 'a-e0', 'sw1', 'sw1-f1'),
      link('lb', 'b', 'b-e0', 'sw1', 'sw1-f2'),
      link('lc', 'sw1', 'sw1-f3', 'r1', 'r1-g0'),
      link('ld', 'r1', 'r1-g1', 'sw2', 'sw2-f1'),
      link('le', 'c', 'c-e0', 'sw2', 'sw2-f2'),
    ],
  }
}

describe('NetworkSimulator.ping', () => {
  it('same-subnet ping across a switch succeeds', () => {
    const { devices, links } = topology()
    const r = new NetworkSimulator(devices, links).ping('PC-A', 'PC-B')
    expect(r.success).toBe(true)
    expect(r.hops).toContain('PC-A')
    expect(r.hops).toContain('PC-B')
    expect(r.packetLoss).toBe(0)
  })

  it('routed ping across R1 into another subnet succeeds', () => {
    const { devices, links } = topology()
    const r = new NetworkSimulator(devices, links).ping('PC-A', 'PC-C')
    expect(r.success).toBe(true)
    expect(r.hops).toEqual(expect.arrayContaining(['PC-A', 'R1', 'PC-C']))
  })

  it('fails with no default gateway when the destination is off-subnet', () => {
    const { devices, links } = topology({ noGateway: true })
    const r = new NetworkSimulator(devices, links).ping('PC-A', 'PC-C')
    expect(r.success).toBe(false)
    expect(r.failureReason).toMatch(/gateway/i)
  })

  it('fails to reach a non-existent host (ARP goes unanswered)', () => {
    const { devices, links } = topology()
    const r = new NetworkSimulator(devices, links).ping('PC-A', '10.0.1.99')
    expect(r.success).toBe(false)
    expect(r.failureReason).toMatch(/ARP/i)
  })

  it('a too-wide mask does NOT let a host reach across a router (L2 domain stops at R1)', () => {
    // /16 makes PC-A believe 10.0.2.10 is a local neighbour, so it tries to ARP
    // for it directly - but PC-C is behind R1 and not in PC-A's broadcast
    // domain, so there is no answer and the ping must fail.
    const { devices, links } = topology({ aMask: '255.255.0.0' })
    const r = new NetworkSimulator(devices, links).ping('PC-A', 'PC-C')
    expect(r.success).toBe(false)
    expect(r.failureReason).toMatch(/ARP/i)
  })

  it('fails when the destination interface is down', () => {
    const { devices, links } = topology({ bStatus: 'down' })
    const r = new NetworkSimulator(devices, links).ping('PC-A', 'PC-B')
    expect(r.success).toBe(false)
  })

  it('reports an invalid destination', () => {
    const { devices, links } = topology()
    const r = new NetworkSimulator(devices, links).ping('PC-A', 'NOPE')
    expect(r.success).toBe(false)
    expect(r.failureReason).toMatch(/invalid/i)
  })
})

describe('NetworkSimulator.getRoutingTable', () => {
  it('derives connected routes for both of R1 interfaces', () => {
    const { devices, links } = topology()
    const routes = new NetworkSimulator(devices, links).getRoutingTable('R1')
    const nets = routes.map((r) => `${r.destination}/${r.mask}`)
    expect(nets).toContain('10.0.1.0/255.255.255.0')
    expect(nets).toContain('10.0.2.0/255.255.255.0')
    expect(routes.every((r) => r.type === 'connected')).toBe(true)
  })
})
