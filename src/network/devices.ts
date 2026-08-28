import type { Device, NetworkInterface } from './types'

export function getDeviceById(devices: Device[], id: string): Device | undefined {
  return devices.find((device) => device.id === id)
}

export function getDeviceByHostname(devices: Device[], hostname: string): Device | undefined {
  const normalized = hostname.trim().toUpperCase()
  return devices.find((device) => device.hostname.toUpperCase() === normalized)
}

export function getDeviceByIp(devices: Device[], ip: string): Device | undefined {
  return devices.find((device) =>
    device.interfaces.some((iface) => iface.ipAddress === ip && iface.status === 'up'),
  )
}

export function getInterfaceByIp(device: Device, ip: string): NetworkInterface | undefined {
  return device.interfaces.find((iface) => iface.ipAddress === ip)
}

export function getPrimaryInterface(device: Device): NetworkInterface | undefined {
  return device.interfaces.find((iface) => iface.ipAddress && iface.status === 'up')
}

export function getInterfaceById(device: Device, interfaceId: string): NetworkInterface | undefined {
  return device.interfaces.find((iface) => iface.id === interfaceId || iface.name === interfaceId)
}

export function resolveDeviceRef(devices: Device[], ref: string): Device | undefined {
  return getDeviceByHostname(devices, ref) ?? getDeviceById(devices, ref) ?? getDeviceByIp(devices, ref)
}

export function resolveIpRef(devices: Device[], ref: string): string | undefined {
  if (ref.includes('.')) return ref
  const device = resolveDeviceRef(devices, ref)
  if (!device) return undefined
  return getPrimaryInterface(device)?.ipAddress
}
