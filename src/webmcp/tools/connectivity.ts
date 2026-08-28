import type { WebMCPToolResult } from '../types'
import { useNetworkStore } from '@/store/networkStore'

export function pingTool(source: string, destination: string): WebMCPToolResult {
  const { simulator } = useNetworkStore.getState()
  return { success: true, data: simulator.ping(source, destination) }
}

export function traceRouteTool(source: string, destination: string): WebMCPToolResult {
  const { simulator } = useNetworkStore.getState()
  return { success: true, data: simulator.traceRoute(source, destination) }
}

export function checkConnectivityTool(source: string, destination: string): WebMCPToolResult {
  const { simulator } = useNetworkStore.getState()
  return { success: true, data: simulator.checkConnectivity(source, destination) }
}
