import type { WebMCPToolResult } from '../types'
import { getInterfaceStatus } from '@/network/interfaces'
import { getDeviceByHostname } from '@/network/devices'
import { useNetworkStore } from '@/store/networkStore'

export function getInterfaceStatusTool(device: string, iface: string): WebMCPToolResult {
  const { devices } = useNetworkStore.getState()
  const found = getDeviceByHostname(devices, device) ?? devices.find((d) => d.id === device)

  if (!found) {
    return { success: false, error: `Device ${device} not found` }
  }

  const status = getInterfaceStatus(found, iface)
  if (!status) {
    return { success: false, error: `Device ${device} does not have interface ${iface}` }
  }

  return { success: true, data: status }
}
