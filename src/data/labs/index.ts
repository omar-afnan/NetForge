import type { LabDefinition } from './starterLab'
import { starterLab } from './starterLab'
import { gatewayFailureLab } from './gatewayFailure'
import { interfaceFailureLab } from './interfaceFailure'
import { routingFailureLab } from './routingFailure'
import { dhcpLab, dnsLab, natLab } from './serviceFailures'
import { securityLab, finalBossLab } from './securityFailure'

export const ALL_LABS: LabDefinition[] = [
  starterLab,
  gatewayFailureLab,
  interfaceFailureLab,
  routingFailureLab,
  dhcpLab,
  dnsLab,
  natLab,
  securityLab,
  finalBossLab,
]