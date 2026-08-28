import type { Device, NetworkInterface } from './types'
import { getInterfaceById } from './devices'

export function getInterfaceStatus(device: Device, interfaceName: string): NetworkInterface | undefined {
  return getInterfaceById(device, interfaceName)
}

export function isInterfaceOperational(device: Device, interfaceId: string): boolean {
  const iface = getInterfaceById(device, interfaceId)
  return iface?.status === 'up'
}
