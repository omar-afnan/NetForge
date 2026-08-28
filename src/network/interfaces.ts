import type { Device, NetworkInterface } from './types'

export function getInterfaceStatus(device: Device, interfaceName: string): NetworkInterface | undefined {
  return device.interfaces.find((iface) => iface.name === interfaceName || iface.id === interfaceName)
}
