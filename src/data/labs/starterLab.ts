import type { Device, NetworkLink } from '@/network/types'

export interface LabDefinition {
  id: string
  title: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  description: string
  issueCount: number
  devices: Device[]
  links: NetworkLink[]
}

export const starterLab: LabDefinition = {
  id: 'starter',
  title: 'Starter Lab',
  difficulty: 'beginner',
  description: 'A healthy baseline network topology.',
  issueCount: 0,
  devices: [],
  links: [],
}
