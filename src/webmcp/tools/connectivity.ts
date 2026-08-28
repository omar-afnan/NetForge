import type { WebMCPToolResult } from '../types'
import { checkConnectivity } from '@/network/diagnostics'
import { ping } from '@/network/ping'
import { traceRoute } from '@/network/traceroute'

export function pingTool(source: string, destination: string): WebMCPToolResult {
  return { success: true, data: ping(source, destination) }
}

export function traceRouteTool(source: string, destination: string): WebMCPToolResult {
  return { success: true, data: traceRoute(source, destination) }
}

export function checkConnectivityTool(source: string, destination: string): WebMCPToolResult {
  return { success: true, data: checkConnectivity(source, destination) }
}
