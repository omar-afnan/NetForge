import type { Device, DeviceType, NetworkInterface, NetworkLink } from './types'
import { getNetworkAddress, intToIp, ipToInt, isValidIpv4 } from './ip'
import { findFreeInterface } from './cables'

const HOSTNAME_PREFIX: Record<DeviceType, string> = {
  pc: 'PC',
  switch: 'SW',
  router: 'R',
  server: 'SRV',
}

const SWITCH_PORT_COUNT = 8
const ROUTER_PORT_COUNT = 3

function randomMac(): string {
  const byte = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
  return `00:50:56:${byte()}:${byte()}:${byte()}`
}

function iface(id: string, name: string): NetworkInterface {
  return { id, name, macAddress: randomMac(), status: 'up' }
}

export function nextHostname(devices: Device[], type: DeviceType): string {
  const prefix = HOSTNAME_PREFIX[type]
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, 'i')
  let max = 0
  for (const device of devices) {
    const match = pattern.exec(device.hostname)
    if (match) max = Math.max(max, Number.parseInt(match[1], 10))
  }
  return `${prefix}-${String(max + 1).padStart(2, '0')}`
}

/**
 * Copy the addressing pattern from an existing device of the same type:
 * same subnet + mask + gateway, first unused host address.
 */
function autoAddressConfig(
  devices: Device[],
  type: DeviceType,
): { ip?: string; mask?: string; gateway?: string } {
  const template = devices.find((device) => device.type === type)
  if (!template) return {}

  const primary = template.interfaces.find((entry) => entry.ipAddress && entry.subnetMask)
  if (!primary?.ipAddress || !primary.subnetMask || !isValidIpv4(primary.ipAddress)) return {}

  const used = new Set(
    devices.flatMap((device) =>
      device.interfaces.map((entry) => entry.ipAddress).filter((ip): ip is string => Boolean(ip)),
    ),
  )

  const network = ipToInt(getNetworkAddress(primary.ipAddress, primary.subnetMask))
  const mask = ipToInt(primary.subnetMask)

  for (let host = 1; host < 255; host += 1) {
    const candidate = intToIp((network + host) >>> 0)
    if (((network + host) & mask) >>> 0 !== network) break
    if (!used.has(candidate)) {
      return {
        ip: candidate,
        mask: primary.subnetMask,
        gateway: template.defaultGateway,
      }
    }
  }
  return {}
}

export function createDevice(
  id: string,
  type: DeviceType,
  hostname: string,
  position: { x: number; y: number },
  existing: Device[],
): Device {
  const address = autoAddressConfig(existing, type)
  let interfaces: NetworkInterface[]

  switch (type) {
    case 'router':
      interfaces = Array.from({ length: ROUTER_PORT_COUNT }, (_, index) =>
        iface(`${id}-gi${index}`, `Gi0/${index}`),
      )
      break
    case 'switch': {
      interfaces = [iface(`${id}-mgmt`, 'Mgmt0')]
      for (let port = 1; port <= SWITCH_PORT_COUNT; port += 1) {
        interfaces.push(iface(`${id}-fa${port}`, `Fa0/${port}`))
      }
      interfaces.push(iface(`${id}-gi1`, 'Gi0/1'))
      break
    }
    case 'server':
      interfaces = [iface(`${id}-eth0`, 'Eth0')]
      break
    case 'pc':
    default:
      interfaces = [iface(`${id}-eth0`, 'Eth0')]
      break
  }

  if (address.ip && address.mask) {
    interfaces = interfaces.map((entry, index) =>
      index === 0
        ? { ...entry, ipAddress: address.ip, subnetMask: address.mask }
        : entry,
    )
  }

  const device: Device = {
    id,
    hostname,
    type,
    status: 'healthy',
    position,
    interfaces,
  }

  if (type === 'server') device.role = 'Server'
  if (address.gateway && (type === 'pc' || type === 'server')) device.defaultGateway = address.gateway

  return device
}

export type LinkPlan =
  | { ok: true; sourceInterfaceId: string; targetInterfaceId: string }
  | { ok: false; reason: string }

/** Pick a free port on both ends and validate that a new cable can be made. */
export function planLink(
  devices: Device[],
  links: NetworkLink[],
  sourceDeviceId: string,
  targetDeviceId: string,
): LinkPlan {
  if (sourceDeviceId === targetDeviceId) {
    return { ok: false, reason: 'Cannot wire a device to itself' }
  }

  const source = devices.find((device) => device.id === sourceDeviceId)
  const target = devices.find((device) => device.id === targetDeviceId)
  if (!source || !target) {
    return { ok: false, reason: 'Device not found' }
  }

  const sourceIface = findFreeInterface(source, links)
  if (!sourceIface) {
    return { ok: false, reason: `No free ports on ${source.hostname}` }
  }

  const targetIface = findFreeInterface(target, links)
  if (!targetIface) {
    return { ok: false, reason: `No free ports on ${target.hostname}` }
  }

  return { ok: true, sourceInterfaceId: sourceIface.id, targetInterfaceId: targetIface.id }
}