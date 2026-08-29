import type { FailureInjection } from '@/network/failures'
import type { LabDefinition } from './starterLab'
import { buildStarterTopology } from './starterLab'

const baseline = buildStarterTopology()

const failures: FailureInjection[] = [
  {
    type: 'interface_down',
    deviceId: 'r-02',
    details: { interfaceId: 'r-02-gi1' },
  },
]

export const interfaceFailureLab: LabDefinition = {
  id: 'interface-down',
  title: 'Silent Interface',
  difficulty: 'beginner',
  description:
    'Pings from the workstation LAN toward the server farm die in transit between the routers. Layer 2 to the workstations is healthy - check the state of every interface along the transit path.',
  issueCount: 1,
  devices: baseline.devices,
  links: baseline.links,
  failures,
}
