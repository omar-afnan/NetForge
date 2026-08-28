import type { LabDefinition } from './starterLab'
import { starterLab } from './starterLab'
import { gatewayFailureLab } from './gatewayFailure'
import { interfaceFailureLab } from './interfaceFailure'
import { routingFailureLab } from './routingFailure'

export const ALL_LABS: LabDefinition[] = [
  starterLab,
  gatewayFailureLab,
  interfaceFailureLab,
  routingFailureLab,
]