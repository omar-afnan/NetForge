import type { FailureInjection } from '@/network/failures'
import type { LabDefinition } from './starterLab'
import { buildStarterTopology } from './starterLab'

const baseline = buildStarterTopology()

const failures: FailureInjection[] = [
  {
    type: 'missing_route',
    deviceId: 'r-02',
    details: { destination: '10.1.20.0', mask: '255.255.255.0' },
  },
]

export const routingFailureLab: LabDefinition = {
  id: 'missing-route',
  title: 'The Missing Route',
  difficulty: 'intermediate',
  description:
    'Workstations cannot reach any server in the 10.1.20.0/24 farm. The physical path is clean and every interface is up — walk the route tables on each hop of the transit path.',
  issueCount: 1,
  devices: baseline.devices,
  links: baseline.links,
  failures,
}
