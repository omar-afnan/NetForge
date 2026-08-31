import type { FailureInjection } from '@/network/failures'
import type { LabDefinition } from './starterLab'
import { buildStarterTopology } from './starterLab'

// ──────────────────────────────────────────────
// Security lab: a port-security lockdown hit the
// wrong access port, shutting PC-02 out entirely.
// ──────────────────────────────────────────────

const baseline = buildStarterTopology()

const failures: FailureInjection[] = [
  {
    type: 'interface_down',
    deviceId: 'sw-01',
    details: { interfaceId: 'sw-01-fa2' },
  },
]

export const securityLab: LabDefinition = {
  id: 'acl-lab',
  title: 'Locked Out by Port Security',
  difficulty: 'intermediate',
  description:
    'Hardening was applied overnight: port security and an access lockdown. Now PC-02 cannot reach anything - even PC-01 on the same switch. Verify cabling and interface status before blaming the new policy.',
  issueCount: 1,
  devices: baseline.devices,
  links: baseline.links,
  failures,
}

// ──────────────────────────────────────────────
// The final boss: four simultaneous faults across
// four devices, mirroring the curriculum's Level
// "Full Troubleshooting" methodology: isolate
// layer by layer, host → switch → router.
// ──────────────────────────────────────────────

const bossBaseline = buildStarterTopology()

const bossFailures: FailureInjection[] = [
  {
    type: 'wrong_gateway',
    deviceId: 'pc-02',
    details: { from: '10.1.10.1', to: '10.1.10.254' },
  },
  {
    type: 'wrong_subnet',
    deviceId: 'pc-03',
    details: { from: '255.255.255.0', to: '255.255.255.240' },
  },
  {
    type: 'missing_route',
    deviceId: 'r-01',
    details: { destination: '10.1.20.0', mask: '255.255.255.0' },
  },
  {
    type: 'wrong_next_hop',
    deviceId: 'r-03',
    details: { destination: '10.1.10.0', to: '10.1.0.9' },
  },
]

export const finalBossLab: LabDefinition = {
  id: 'final-boss',
  title: 'Full Troubleshooting: Four Faults',
  difficulty: 'advanced',
  description:
    'The morning shift inherited a network with multiple simultaneous faults. PCs, a switch, and two routers are all misconfigured in different ways. Systematically isolate each fault with ping, traceroute, and show commands - then fix every one of them.',
  issueCount: 4,
  devices: bossBaseline.devices,
  links: bossBaseline.links,
  failures: bossFailures,
}