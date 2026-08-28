import type { WebMCPToolResult } from '../types'
import { getDeviceByHostname } from '@/network/devices'
import { useNetworkStore } from '@/store/networkStore'

export function getDeviceConfig(device: string): WebMCPToolResult {
  const { devices } = useNetworkStore.getState()
  const found = getDeviceByHostname(devices, device) ?? devices.find((d) => d.id === device)

  if (!found) {
    return { success: false, error: `Device ${device} not found` }
  }

  return { success: true, data: found }
}
