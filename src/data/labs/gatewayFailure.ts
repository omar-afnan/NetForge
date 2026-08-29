import type { FailureInjection } from '@/network/failures'
import type { LabDefinition } from './starterLab'
import { buildStarterTopology } from './starterLab'

// Baseline enterprise topology, cloned so this lab never mutates the starter lab.
const baseline = buildStarterTopology()

const failures: FailureInjection[] = [
  {
    type: 'wrong_gateway',
    deviceId: 'pc-02',
    details: { from: '10.1.10.1', to: '10.1.10.254' },
  },
]

export const gatewayFailureLab: LabDefinition = {
  id: 'wrong-gateway',
  title: 'The Wrong Gateway',
  difficulty: 'beginner',
  description:
    'Users on the workstation LAN can still reach each other, but one machine cannot get anywhere outside its own subnet. The switch and cabling check out - suspect a host configuration error.',
  issueCount: 1,
  devices: baseline.devices,
  links: baseline.links,
  failures,
}
