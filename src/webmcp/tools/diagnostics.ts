import type { WebMCPToolResult } from '../types'
import { useNetworkStore } from '@/store/networkStore'

export function getNetworkIssues(): WebMCPToolResult {
  const { issues } = useNetworkStore.getState()
  return { success: true, data: issues }
}
