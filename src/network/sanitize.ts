import type { CableKind, Device, DeviceType, NetworkInterface, NetworkLink, StaticRoute } from './types'
import type { FailureInjection, FailureType } from './failures'
import { isValidIpv4, maskToPrefix } from './ip'
import { isRecord, nonNegInt, oneOf, optStr, str } from '@/lib/persist'

/**
 * Defensive rebuilding of topology data that came from outside the running
 * app (localStorage today; any future import/share feature). Everything is
 * copied field by field, so unexpected keys and wrong types never reach the
 * simulator. Entries that cannot be repaired are dropped, not guessed.
 */

const DEVICE_TYPES = ['pc', 'switch', 'router', 'server'] as const satisfies readonly DeviceType[]
const CABLE_KINDS = ['copper', 'fiber', 'serial', 'wireless'] as const satisfies readonly CableKind[]
const DEVICE_STATUS = ['healthy', 'degraded', 'failed'] as const
const FAILURE_TYPES = [
  'wrong_ip', 'wrong_subnet', 'wrong_gateway', 'missing_route', 'wrong_next_hop',
  'interface_down', 'link_failure', 'arp_problem', 'routing_misconfig',
] as const satisfies readonly FailureType[]

const MAX_DEVICES = 200
const MAX_INTERFACES = 64
const MAX_LINKS = 500
const MAX_ROUTES = 200

export function isValidMask(mask: unknown): mask is string {
  if (typeof mask !== 'string' || !isValidIpv4(mask)) return false
  try {
    maskToPrefix(mask)
    return true
  } catch {
    return false
  }
}

function validIp(value: unknown): string | undefined {
  return typeof value === 'string' && isValidIpv4(value) ? value : undefined
}

function sanitizeInterface(raw: unknown): NetworkInterface | null {
  if (!isRecord(raw)) return null
  const id = optStr(raw.id, 100)
  if (!id) return null
  const ip = validIp(raw.ipAddress)
  const mask = isValidMask(raw.subnetMask) ? raw.subnetMask : undefined
  const iface: NetworkInterface = {
    id,
    name: str(raw.name, id, 50),
    macAddress: str(raw.macAddress, '00:00:00:00:00:00', 32),
    status: oneOf(raw.status, ['up', 'down'] as const) ?? 'up',
  }
  // An address is only meaningful together with a valid mask.
  if (ip && mask) {
    iface.ipAddress = ip
    iface.subnetMask = mask
  }
  const linkId = optStr(raw.connectedLinkId, 100)
  if (linkId) iface.connectedLinkId = linkId
  return iface
}

function sanitizeRoute(raw: unknown): StaticRoute | null {
  if (!isRecord(raw)) return null
  const destination = validIp(raw.destination)
  const nextHop = validIp(raw.nextHop)
  if (!destination || !nextHop || !isValidMask(raw.mask)) return null
  const route: StaticRoute = { destination, mask: raw.mask, nextHop }
  const interfaceId = optStr(raw.interfaceId, 100)
  if (interfaceId) route.interfaceId = interfaceId
  return route
}

function sanitizeDevice(raw: unknown): Device | null {
  if (!isRecord(raw)) return null
  const id = optStr(raw.id, 100)
  const hostname = optStr(raw.hostname, 64)
  const type = oneOf(raw.type, DEVICE_TYPES)
  if (!id || !hostname || !type || !Array.isArray(raw.interfaces)) return null

  const seen = new Set<string>()
  const interfaces: NetworkInterface[] = []
  for (const entry of raw.interfaces.slice(0, MAX_INTERFACES)) {
    const iface = sanitizeInterface(entry)
    if (iface && !seen.has(iface.id)) {
      seen.add(iface.id)
      interfaces.push(iface)
    }
  }

  const device: Device = {
    id,
    hostname,
    type,
    interfaces,
    status: oneOf(raw.status, DEVICE_STATUS) ?? 'healthy',
  }
  const gateway = validIp(raw.defaultGateway)
  if (gateway) device.defaultGateway = gateway
  if (Array.isArray(raw.staticRoutes)) {
    device.staticRoutes = raw.staticRoutes
      .slice(0, MAX_ROUTES)
      .map(sanitizeRoute)
      .filter((r): r is StaticRoute => r !== null)
  }
  const role = optStr(raw.role, 64)
  if (role) device.role = role
  if (
    isRecord(raw.position) &&
    typeof raw.position.x === 'number' && Number.isFinite(raw.position.x) &&
    typeof raw.position.y === 'number' && Number.isFinite(raw.position.y)
  ) {
    device.position = { x: raw.position.x, y: raw.position.y }
  }
  return device
}

/** Returns null when `raw` is not an array (i.e. nothing usable at all). */
export function sanitizeDevices(raw: unknown): Device[] | null {
  if (!Array.isArray(raw)) return null
  const seen = new Set<string>()
  const out: Device[] = []
  for (const entry of raw.slice(0, MAX_DEVICES)) {
    const device = sanitizeDevice(entry)
    if (device && !seen.has(device.id)) {
      seen.add(device.id)
      out.push(device)
    }
  }
  return out
}

/**
 * Links must reference existing devices (and the interfaces on them); a
 * dangling link would otherwise be silently ignored by some code paths and
 * crash others.
 */
export function sanitizeLinks(raw: unknown, devices: Device[]): NetworkLink[] | null {
  if (!Array.isArray(raw)) return null
  const byId = new Map(devices.map((d) => [d.id, d]))
  const seen = new Set<string>()
  const out: NetworkLink[] = []
  for (const entry of raw.slice(0, MAX_LINKS)) {
    if (!isRecord(entry)) continue
    const id = optStr(entry.id, 100)
    const sourceDeviceId = optStr(entry.sourceDeviceId, 100)
    const targetDeviceId = optStr(entry.targetDeviceId, 100)
    const sourceInterfaceId = optStr(entry.sourceInterfaceId, 100)
    const targetInterfaceId = optStr(entry.targetInterfaceId, 100)
    if (!id || !sourceDeviceId || !targetDeviceId || !sourceInterfaceId || !targetInterfaceId) continue
    if (seen.has(id) || sourceDeviceId === targetDeviceId) continue
    const source = byId.get(sourceDeviceId)
    const target = byId.get(targetDeviceId)
    if (!source || !target) continue
    if (!source.interfaces.some((i) => i.id === sourceInterfaceId)) continue
    if (!target.interfaces.some((i) => i.id === targetInterfaceId)) continue
    seen.add(id)
    const link: NetworkLink = {
      id,
      sourceDeviceId,
      sourceInterfaceId,
      targetDeviceId,
      targetInterfaceId,
      status: oneOf(entry.status, ['up', 'down'] as const) ?? 'up',
    }
    const kind = oneOf(entry.kind, CABLE_KINDS)
    if (kind) link.kind = kind
    if (typeof entry.bandwidthMbps === 'number' && Number.isFinite(entry.bandwidthMbps) && entry.bandwidthMbps > 0) {
      link.bandwidthMbps = entry.bandwidthMbps
    }
    out.push(link)
  }
  return out
}

export function sanitizeFailures(raw: unknown): FailureInjection[] {
  if (!Array.isArray(raw)) return []
  const out: FailureInjection[] = []
  for (const entry of raw.slice(0, 50)) {
    if (!isRecord(entry)) continue
    const type = oneOf(entry.type, FAILURE_TYPES)
    const deviceId = optStr(entry.deviceId, 100)
    if (!type || !deviceId) continue
    const details: Record<string, unknown> = {}
    if (isRecord(entry.details)) {
      for (const [k, v] of Object.entries(entry.details)) {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') details[k] = v
      }
    }
    out.push({ type, deviceId, details })
  }
  return out
}

export interface SanitizedLab {
  id: string
  title: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  description: string
  issueCount: number
  devices: Device[]
  links: NetworkLink[]
  failures?: FailureInjection[]
}

export function sanitizeLab(raw: unknown): SanitizedLab | null {
  if (!isRecord(raw)) return null
  const id = optStr(raw.id, 100)
  const devices = sanitizeDevices(raw.devices)
  if (!id || !devices) return null
  const links = sanitizeLinks(raw.links, devices)
  if (!links) return null
  return {
    id,
    title: str(raw.title, id, 200),
    difficulty: oneOf(raw.difficulty, ['beginner', 'intermediate', 'advanced'] as const) ?? 'beginner',
    description: str(raw.description, '', 2000),
    issueCount: nonNegInt(raw.issueCount),
    devices,
    links,
    failures: sanitizeFailures(raw.failures),
  }
}
