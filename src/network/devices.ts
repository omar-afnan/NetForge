import type { Device } from './types'

export function getDeviceById(devices: Device[], id: string): Device | undefined {
  return devices.find((device) => device.id === id)
}

export function getDeviceByHostname(devices: Device[], hostname: string): Device | undefined {
  return devices.find((device) => device.hostname === hostname)
}
