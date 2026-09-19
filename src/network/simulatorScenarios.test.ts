import { describe, expect, it } from 'vitest'
import { dev, healthyNet, link, removeDevice, sim } from './testHelpers'
import { NetworkSimulator } from './simulator'

/**
 * Regression suite for NetworkSimulator — the source of truth for every
 * connectivity decision (labs, copilot, takeover, WebMCP). Each scenario starts
 * from the healthy starter topology:
 *
 *   PC-01..03 ─ SW-01 ─ R-01 ═ R-02 ═ R-03 ─ SW-03 ─ SRV-01..04
 *   10.1.10.0/24   10.1.0.0/30   10.1.0.4/30   10.1.20.0/24
 */

describe('healthy baseline', () => {
  it('same-subnet, cross-router and multi-router paths all succeed', () => {
    const s = sim(healthyNet())
    expect(s.ping('PC-01', 'PC-02').success).toBe(true)
    expect(s.ping('SRV-01', 'SRV-04').success).toBe(true)
    const across = s.ping('PC-01', 'SRV-01')
    expect(across.success).toBe(true)
    expect(across.hops).toEqual(['PC-01', 'R-01', 'R-02', 'R-03', 'SRV-01'])
  })

  it('routes symmetrically across multiple routers (return path works)', () => {
    const s = sim(healthyNet())
    expect(s.ping('SRV-03', 'PC-02').hops).toEqual(['SRV-03', 'R-03', 'R-02', 'R-01', 'PC-02'])
  })
})

describe('host configuration faults', () => {
  it('wrong gateway (in-subnet but nobody answers) fails ARP for the gateway', () => {
    const net = healthyNet()
    dev(net, 'PC-02').defaultGateway = '10.1.10.254'
    const r = sim(net).ping('PC-02', 'SRV-01')
    expect(r.success).toBe(false)
    expect(r.failureReason).toBe('ARP resolution failed for gateway')
    // local traffic is unaffected
    expect(sim(net).ping('PC-02', 'PC-01').success).toBe(true)
    expect(sim(net).ping('PC-01', 'SRV-01').success).toBe(true)
  })

  it('gateway outside the host subnet is rejected as invalid', () => {
    const net = healthyNet()
    dev(net, 'PC-01').defaultGateway = '10.9.9.1'
    expect(sim(net).ping('PC-01', 'SRV-01').failureReason).toBe('Invalid default gateway')
  })

  it('missing default gateway blocks off-subnet traffic only', () => {
    const net = healthyNet()
    delete dev(net, 'PC-01').defaultGateway
    expect(sim(net).ping('PC-01', 'SRV-01').failureReason).toBe('No default gateway configured')
    expect(sim(net).ping('PC-01', 'PC-03').success).toBe(true)
  })

  it('a too-narrow mask leaves the gateway off-subnet', () => {
    const net = healthyNet()
    dev(net, 'PC-03').interfaces[0].subnetMask = '255.255.255.248' // .12 now in 10.1.10.8/29, gateway .1 falls outside
    const r = sim(net).ping('PC-03', 'SRV-01')
    expect(r.success).toBe(false)
    expect(r.failureReason).toBe('Invalid default gateway')
  })

  it('an over-wide mask does not let a host reach across a router', () => {
    const net = healthyNet()
    dev(net, 'PC-01').interfaces[0].subnetMask = '255.0.0.0'
    const r = sim(net).ping('PC-01', 'SRV-01')
    expect(r.success).toBe(false)
    expect(r.failureReason).toMatch(/ARP/)
  })

  it('an interface with no IP cannot originate traffic', () => {
    const net = healthyNet()
    delete dev(net, 'PC-01').interfaces[0].ipAddress
    const r = sim(net).ping('PC-01', 'PC-02')
    expect(r.success).toBe(false)
    expect(r.failureReason).toBe('Invalid source or destination')
  })
})

describe('interface and link faults', () => {
  it('a down source interface fails the ping', () => {
    const net = healthyNet()
    dev(net, 'PC-01').interfaces[0].status = 'down'
    expect(sim(net).ping('PC-01', 'PC-02').success).toBe(false)
  })

  it('a down destination interface is unreachable (no ARP reply)', () => {
    const net = healthyNet()
    dev(net, 'SRV-01').interfaces[0].status = 'down'
    const r = sim(net).ping('PC-01', '10.1.20.10')
    expect(r.success).toBe(false)
  })

  it('a down transit router interface fails at the egress', () => {
    const net = healthyNet()
    dev(net, 'R-02').interfaces.find((i) => i.id === 'r-02-gi1')!.status = 'down'
    const r = sim(net).ping('PC-01', 'SRV-01')
    expect(r.success).toBe(false)
    expect(r.failureReason).toBe('Egress interface down')
  })

  it('a down access link isolates only that host', () => {
    const net = healthyNet()
    link(net, 'l1').status = 'down' // PC-01 ─ SW-01
    expect(sim(net).ping('PC-01', 'PC-02').success).toBe(false)
    expect(sim(net).ping('PC-01', 'SRV-01').success).toBe(false)
    expect(sim(net).ping('PC-02', 'SRV-01').success).toBe(true)
  })

  it('a down transit link cuts the two sides apart but not the local segments', () => {
    const net = healthyNet()
    link(net, 'l5').status = 'down' // R-01 ═ R-02
    expect(sim(net).ping('PC-01', 'SRV-01').success).toBe(false)
    expect(sim(net).ping('SRV-01', 'PC-01').success).toBe(false)
    expect(sim(net).ping('PC-01', 'PC-03').success).toBe(true)
    expect(sim(net).ping('SRV-01', 'SRV-04').success).toBe(true)
  })

  it('an isolated device (every link down) reaches nothing', () => {
    const net = healthyNet()
    net.links.filter((l) => l.sourceDeviceId === 'srv-02' || l.targetDeviceId === 'srv-02').forEach((l) => (l.status = 'down'))
    const s = sim(net)
    for (const target of ['SRV-01', 'PC-01', '10.1.20.10']) expect(s.ping('SRV-02', target).success).toBe(false)
    expect(s.ping('SRV-01', '10.1.20.11').success).toBe(false)
  })

  it('a link whose endpoint interface is down does not carry traffic', () => {
    const net = healthyNet()
    dev(net, 'SW-01').interfaces.find((i) => i.id === 'sw-01-fa2')!.status = 'down'
    expect(sim(net).ping('PC-02', 'PC-01').success).toBe(false)
    expect(sim(net).ping('PC-01', 'PC-03').success).toBe(true)
  })
})

describe('routing faults', () => {
  it('missing route fails at the router with "No route"', () => {
    const net = healthyNet()
    dev(net, 'R-02').staticRoutes = dev(net, 'R-02').staticRoutes!.filter((r) => r.destination !== '10.1.20.0')
    const r = sim(net).ping('PC-01', 'SRV-01')
    expect(r.success).toBe(false)
    expect(r.failureReason).toBe('No route to destination')
    expect(r.hops).toContain('R-02')
  })

  it('missing return route: a ping is one-way, so only the reverse ping exposes it', () => {
    const net = healthyNet()
    dev(net, 'R-03').staticRoutes = []
    expect(sim(net).ping('PC-01', 'SRV-01').success).toBe(true)
    const back = sim(net).ping('SRV-01', 'PC-01')
    expect(back.success).toBe(false)
    expect(back.failureReason).toBe('No route to destination')
  })

  it('next hop that no device owns is unreachable', () => {
    const net = healthyNet()
    dev(net, 'R-01').staticRoutes![0].nextHop = '10.1.0.3' // in the /30, but nobody has it
    const r = sim(net).ping('PC-01', 'SRV-01')
    expect(r.success).toBe(false)
    expect(r.failureReason).toMatch(/Next hop|ARP/)
  })

  it('next hop outside every connected subnet is rejected (no teleporting to a non-adjacent router)', () => {
    const net = healthyNet()
    // 10.1.20.1 exists (R-03) but is nowhere near R-01's connected networks.
    dev(net, 'R-01').staticRoutes![0].nextHop = '10.1.20.1'
    const r = sim(net).ping('PC-01', 'SRV-01')
    expect(r.success).toBe(false)
  })

  it('a next hop that is a real but wrong neighbour creates a loop / failure, never a success', () => {
    const net = healthyNet()
    // R-03 sends 10.1.10.0/24 back toward R-03's own far side
    dev(net, 'R-03').staticRoutes![0].nextHop = '10.1.0.9'
    const r = sim(net).ping('SRV-01', 'PC-01')
    expect(r.success).toBe(false)
  })

  it('a static route added without an egress interface still forwards (interface inferred from next hop)', () => {
    const net = healthyNet()
    const r2 = dev(net, 'R-02')
    r2.staticRoutes = r2.staticRoutes!.filter((r) => r.destination !== '10.1.20.0')
    expect(sim(net).ping('PC-01', 'SRV-01').success).toBe(false)
    r2.staticRoutes.push({ destination: '10.1.20.0', mask: '255.255.255.0', nextHop: '10.1.0.6' })
    expect(sim(net).ping('PC-01', 'SRV-01').success).toBe(true)
  })

  it('a route with a down egress interface is not used', () => {
    const net = healthyNet()
    const r2 = dev(net, 'R-02')
    r2.interfaces.find((i) => i.id === 'r-02-gi1')!.status = 'down'
    expect(sim(net).ping('PC-01', 'SRV-01').success).toBe(false)
  })

  it('a two-router routing loop is detected instead of hanging', () => {
    const net = healthyNet()
    dev(net, 'R-03').staticRoutes = [{ destination: '10.1.10.0', mask: '255.255.255.0', nextHop: '10.1.0.5', interfaceId: 'r-03-gi0' }]
    dev(net, 'R-02').staticRoutes = [
      { destination: '10.1.10.0', mask: '255.255.255.0', nextHop: '10.1.0.6', interfaceId: 'r-02-gi1' },
      { destination: '10.1.20.0', mask: '255.255.255.0', nextHop: '10.1.0.6', interfaceId: 'r-02-gi1' },
    ]
    const r = sim(net).ping('SRV-01', 'PC-01')
    expect(r.success).toBe(false)
    expect(r.failureReason).toBe('Routing loop detected')
  })

  it('longest-prefix match wins over a broader route', () => {
    const net = healthyNet()
    const r1 = dev(net, 'R-01')
    // Add a broad, wrong default-ish route; the specific /24 must still win.
    r1.staticRoutes!.push({ destination: '10.0.0.0', mask: '255.0.0.0', nextHop: '10.1.0.3' })
    expect(sim(net).ping('PC-01', 'SRV-01').success).toBe(true)
  })
})

describe('duplicate IPs', () => {
  it('a duplicated server address is flagged, not silently delivered to whichever device is first', () => {
    const net = healthyNet()
    dev(net, 'SRV-02').interfaces[0].ipAddress = '10.1.20.10' // clashes with SRV-01
    const s = sim(net)
    expect(s.findDuplicateIps()).toEqual([
      { ip: '10.1.20.10', devices: ['SRV-01', 'SRV-02'] },
    ])
    const r = s.ping('PC-01', '10.1.20.10')
    expect(r.success).toBe(false)
    expect(r.failureReason).toBe('Duplicate IP address')
  })

  it('a healthy topology has no duplicates; down interfaces do not count', () => {
    expect(sim(healthyNet()).findDuplicateIps()).toEqual([])
    const net = healthyNet()
    const clash = dev(net, 'SRV-02').interfaces[0]
    clash.ipAddress = '10.1.20.10'
    clash.status = 'down'
    expect(sim(net).findDuplicateIps()).toEqual([])
  })
})

describe('topology edits', () => {
  it('empty topology: every operation fails cleanly', () => {
    const s = new NetworkSimulator([], [])
    expect(s.ping('PC-01', 'PC-02')).toMatchObject({ success: false, failureReason: 'Invalid source or destination', packetLoss: 100 })
    expect(s.traceRoute('a', 'b')[0]).toMatchObject({ status: 'failed' })
    expect(s.getRoutingTable('x')).toEqual([])
    expect(s.getARPTable('x')).toEqual([])
    expect(s.checkConnectivity('a', 'b').success).toBe(false)
  })

  it('a deleted device makes its address unreachable and does not crash', () => {
    const net = healthyNet()
    removeDevice(net, 'SRV-01')
    const s = sim(net)
    expect(s.ping('PC-01', '10.1.20.10').success).toBe(false)
    expect(s.ping('SRV-01', 'PC-01').failureReason).toBe('Invalid source or destination')
    expect(s.ping('PC-01', 'SRV-02').success).toBe(true)
  })

  it('a deleted router partitions the network', () => {
    const net = healthyNet()
    removeDevice(net, 'R-02')
    expect(sim(net).ping('PC-01', 'SRV-01').success).toBe(false)
    expect(sim(net).ping('SRV-01', 'SRV-03').success).toBe(true)
  })

  it('a deleted switch strands everything behind it', () => {
    const net = healthyNet()
    removeDevice(net, 'SW-03')
    expect(sim(net).ping('PC-01', 'SRV-01').success).toBe(false)
    expect(sim(net).ping('SRV-01', 'SRV-02').success).toBe(false)
  })

  it('a deleted link stops traffic; dangling link references never throw', () => {
    const net = healthyNet()
    net.links = net.links.filter((l) => l.id !== 'l6')
    expect(sim(net).ping('PC-01', 'SRV-01').success).toBe(false)

    const dangling = healthyNet()
    dangling.devices = dangling.devices.filter((d) => d.hostname !== 'SW-03') // links still reference it
    expect(() => sim(dangling).ping('PC-01', 'SRV-01')).not.toThrow()
    expect(() => sim(dangling).traceRoute('PC-01', 'SRV-01')).not.toThrow()
    expect(() => sim(dangling).getARPTable('PC-01')).not.toThrow()
  })

  it('pinging an unknown device or a malformed address fails safely', () => {
    const s = sim(healthyNet())
    for (const bad of ['GHOST', '', '1..3.4', '999.1.1.1', '10.1.20.999']) {
      const r = s.ping('PC-01', bad)
      expect(r.success, `dest ${JSON.stringify(bad)}`).toBe(false)
    }
    expect(() => s.ping('PC-01', '1..3.4')).not.toThrow()
  })

  it('pinging an unassigned address on a connected subnet fails', () => {
    const r = sim(healthyNet()).ping('PC-01', '10.1.20.200')
    expect(r.success).toBe(false)
  })

  it('pinging yourself succeeds', () => {
    expect(sim(healthyNet()).ping('PC-01', 'PC-01').success).toBe(true)
  })
})

describe('multiple simultaneous failures', () => {
  it('reports the first broken hop and recovers as each fault is fixed', () => {
    const net = healthyNet()
    dev(net, 'PC-02').defaultGateway = '10.1.10.254'
    const r01 = dev(net, 'R-01')
    const saved = r01.staticRoutes!.slice()
    r01.staticRoutes = []
    link(net, 'l9').status = 'down' // SRV-02 access link

    expect(sim(net).ping('PC-02', 'SRV-01').failureReason).toBe('ARP resolution failed for gateway')
    expect(sim(net).ping('PC-01', 'SRV-01').failureReason).toBe('No route to destination')

    dev(net, 'PC-02').defaultGateway = '10.1.10.1'
    expect(sim(net).ping('PC-02', 'SRV-01').failureReason).toBe('No route to destination')

    r01.staticRoutes = saved
    expect(sim(net).ping('PC-02', 'SRV-01').success).toBe(true)
    expect(sim(net).ping('PC-02', 'SRV-02').success).toBe(false)

    link(net, 'l9').status = 'up'
    expect(sim(net).ping('PC-02', 'SRV-02').success).toBe(true)
  })
})

describe('ARP', () => {
  it('lists only same-subnet neighbours reachable at L2', () => {
    const arp = sim(healthyNet()).getARPTable('PC-01')
    expect(arp.map((e) => e.ipAddress)).toEqual(['10.1.10.1', '10.1.10.11', '10.1.10.12'])
    expect(arp.every((e) => /^[0-9A-F:]{17}$/i.test(e.macAddress))).toBe(true)
  })

  it('does not learn hosts across a router', () => {
    const ips = sim(healthyNet()).getARPTable('PC-01').map((e) => e.ipAddress)
    expect(ips).not.toContain('10.1.20.10')
  })

  it('drops entries when the link or the remote interface goes down', () => {
    const net = healthyNet()
    link(net, 'l2').status = 'down'
    expect(sim(net).getARPTable('PC-01').map((e) => e.ipAddress)).not.toContain('10.1.10.11')
    const net2 = healthyNet()
    dev(net2, 'PC-03').interfaces[0].status = 'down'
    expect(sim(net2).getARPTable('PC-01').map((e) => e.ipAddress)).not.toContain('10.1.10.12')
  })

  it('is empty for a device with no live interface', () => {
    const net = healthyNet()
    dev(net, 'PC-01').interfaces[0].status = 'down'
    expect(sim(net).getARPTable('PC-01')).toEqual([])
  })

  it('ARP entry ages are stable between calls (deterministic output)', () => {
    const s = sim(healthyNet())
    expect(s.getARPTable('PC-01')).toEqual(s.getARPTable('PC-01'))
  })
})

describe('traceroute', () => {
  it('lists every forwarding hop with its address on success', () => {
    const hops = sim(healthyNet()).traceRoute('PC-01', 'SRV-01')
    expect(hops.map((h) => h.device)).toEqual(['PC-01', 'R-01', 'R-02', 'R-03', 'SRV-01'])
    expect(hops.every((h) => h.status === 'forwarded')).toBe(true)
    expect(hops.map((h) => h.hop)).toEqual([1, 2, 3, 4, 5])
    expect(hops[1].ip).toBe('10.1.10.1')
  })

  it('ends with a failed hop naming the device and reason when it breaks', () => {
    const net = healthyNet()
    dev(net, 'R-02').staticRoutes = []
    const hops = sim(net).traceRoute('PC-01', 'SRV-01')
    const last = hops[hops.length - 1]
    expect(last).toMatchObject({ status: 'failed', device: 'R-02', failureReason: 'No route to destination' })
    expect(hops.slice(0, -1).every((h) => h.status === 'forwarded')).toBe(true)
  })

  it('checkConnectivity agrees with ping', () => {
    const net = healthyNet()
    expect(sim(net).checkConnectivity('PC-01', 'SRV-01').success).toBe(true)
    link(net, 'l7').status = 'down'
    const bad = sim(net).checkConnectivity('PC-01', 'SRV-01')
    expect(bad.success).toBe(false)
    expect(bad.failureReason).toBeTruthy()
    expect(sim(net).ping('PC-01', 'SRV-01').success).toBe(false)
  })
})

describe('NAT / DNS / DHCP', () => {
  // The simulator models L2/L3 forwarding only. NAT, DNS and DHCP are taught
  // through concept widgets and through labs that express them as L3 faults
  // (see labs.test.ts). These tests pin that boundary so nobody assumes the
  // engine translates addresses or resolves names.
  it('does not resolve DNS names: a name that is not a hostname cannot be pinged', () => {
    expect(sim(healthyNet()).ping('PC-01', 'www.corp.local').success).toBe(false)
  })

  it('does not perform NAT: the destination IP is never rewritten in transit', () => {
    const r = sim(healthyNet()).ping('PC-01', '10.1.20.10')
    expect(r.destination).toBe('10.1.20.10')
    expect(r.hops[r.hops.length - 1]).toBe('SRV-01')
  })

  it('a DHCP-style bad lease (address from the wrong subnet) isolates the host from its own LAN', () => {
    const net = healthyNet()
    dev(net, 'PC-02').interfaces[0].ipAddress = '10.1.20.50'
    const s = sim(net)
    expect(s.ping('PC-02', 'PC-01').success).toBe(false)
    expect(s.ping('PC-01', 'PC-02').success).toBe(false)
  })

  it('a stale-DNS style change (server renumbered) makes the old address unreachable', () => {
    const net = healthyNet()
    dev(net, 'SRV-01').interfaces[0].ipAddress = '10.1.20.99'
    const s = sim(net)
    expect(s.ping('PC-01', '10.1.20.10').success).toBe(false)
    expect(s.ping('PC-01', '10.1.20.99').success).toBe(true)
    expect(s.ping('PC-01', 'SRV-01').success).toBe(true) // by hostname it still resolves
  })
})
