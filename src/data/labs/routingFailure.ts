import type { LabDefinition } from './starterLab'

export const routingFailureLab: LabDefinition = {
  id: 'missing-route',
  title: 'The Missing Route',
  difficulty: 'intermediate',
  description: 'PC-01 cannot reach SRV-03 because R-02 is missing a route.',
  issueCount: 1,
  devices: [],
  links: [],
}
