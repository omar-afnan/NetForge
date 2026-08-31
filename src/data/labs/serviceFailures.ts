import type { FailureInjection } from '@/network/failures'
import type { LabDefinition } from './starterLab'
import { buildStarterTopology } from './starterLab'

// ──────────────────────────────────────────────
// DHCP / DNS / NAT themed labs. The simulator
// models L3 faults, so these labs tell a service
// story using address/mask/route faults: exactly
// what a broken DHCP pool or stale DNS record
// looks like from the host's point of view.
// ──────────────────────────────────────────────

const dhcpBaseline = buildStarterTopology()

const dhcpFailures: FailureInjection[] = [
  {
    // Misconfigured DHCP pool handing out an address from the SERVER subnet.
    type: 'wrong_ip',
    deviceId: 'pc-02',
    details: { from: '10.1.10.11', to: '10.1.20.50' },
  },
]

export const dhcpLab: LabDefinition = {
  id: 'dhcp-lab',
  title: 'DHCP Pool Gone Wrong',
  difficulty: 'intermediate',
  description:
    'DHCP was just deployed. PC-02 accepted a lease, but now it cannot reach anything - not even its own subnet. Inspect the lease PC-02 received and compare the pool scope with the workstation LAN.',
  issueCount: 1,
  devices: dhcpBaseline.devices,
  links: dhcpBaseline.links,
  failures: dhcpFailures,
}

const dnsBaseline = buildStarterTopology()

const dnsFailures: FailureInjection[] = [
  {
    // Stale DNS record: everyone resolves www.corp.local to an address the
    // web server no longer owns.
    type: 'wrong_ip',
    deviceId: 'srv-01',
    details: { from: '10.1.20.10', to: '10.1.20.99' },
  },
]

export const dnsLab: LabDefinition = {
  id: 'dns-lab',
  title: 'Stale DNS Record',
  difficulty: 'intermediate',
  description:
    'Users report the intranet site is down, but the server team insists SRV-01 is running. DNS still resolves the site name - to an address the server no longer holds. Find the mismatch between DNS and reality.',
  issueCount: 1,
  devices: dnsBaseline.devices,
  links: dnsBaseline.links,
  failures: dnsFailures,
}

const natBaseline = buildStarterTopology()

const natFailures: FailureInjection[] = [
  {
    // The "NAT edge" (R-02) lost its path toward the server network, so
    // translated traffic from the workstation LAN dies mid-path.
    type: 'wrong_next_hop',
    deviceId: 'r-02',
    details: { destination: '10.1.20.0', to: '10.1.0.9' },
  },
]

export const natLab: LabDefinition = {
  id: 'nat-lab',
  title: 'The Broken NAT Edge',
  difficulty: 'advanced',
  description:
    'Traffic from the workstation LAN toward the server network is translated at R-02 and then vanishes. Private addressing works internally; the edge does not. Trace the path and find where translations go to die.',
  issueCount: 1,
  devices: natBaseline.devices,
  links: natBaseline.links,
  failures: natFailures,
}