import type { WebMCPToolResult } from '../types'
import { useNetworkStore } from '@/store/networkStore'

export function getNetworkTopology(): WebMCPToolResult {
  const { devices, links } = useNetworkStore.getState()
  return { success: true, data: { devices, links } }
}
