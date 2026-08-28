import type { Device, NetworkLink } from './types'

export type FailureType =
  | 'wrong_ip'
  | 'wrong_subnet'
  | 'wrong_gateway'
  | 'missing_route'
  | 'wrong_next_hop'
  | 'interface_down'
  | 'link_failure'
  | 'arp_problem'
  | 'routing_misconfig'

export interface FailureInjection {
  type: FailureType
  deviceId: string
  details: Record<string, unknown>
}

export const FAILURE_TYPE_LABELS: Record<FailureType, string> = {
  wrong_ip: 'Wrong interface IP',
  wrong_subnet: 'Wrong subnet mask',
  wrong_gateway: 'Wrong default gateway',
  missing_route: 'Missing static route',
  wrong_next_hop: 'Wrong next-hop address',
  interface_down: 'Interface shut down',
  link_failure: 'Cable failure',
  arp_problem: 'ARP problem',
  routing_misconfig: 'Routing misconfiguration',
}

function readDetail(details: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = details[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
}

function deviceName(devices: Device[], deviceId: string): string {
  return devices.find((device) => device.id === deviceId)?.hostname ?? deviceId
}

/** Human-readable summary of an injected fault (for tooling / the issue tracker). */
export function describeFailure(injection: FailureInjection, devices: Device[]): string {
  const host = deviceName(devices, injection.deviceId)
  const details = injection.details

  switch (injection.type) {
    case 'wrong_ip':
      return `${host} interface address changed to ${readDetail(details, ['to', 'ip']) ?? '?'}`
    case 'wrong_subnet':
      return `${host} subnet mask changed to ${readDetail(details, ['mask', 'to']) ?? '?'}`
    case 'wrong_gateway':
      return `${host} default gateway set to ${readDetail(details, ['to', 'gateway']) ?? '?'}`
    case 'missing_route':
      return `${host} lost its route to ${readDetail(details, ['destination']) ?? '?'}`
    case 'wrong_next_hop':
    case 'routing_misconfig':
      return `${host} routes ${readDetail(details, ['destination']) ?? '?'} via ${readDetail(details, ['to', 'nextHop']) ?? '?'}`
    case 'interface_down':
      return `${host} interface ${readDetail(details, ['interfaceId', 'interface']) ?? '?'} is shut down`
    case 'link_failure':
      return `Cable ${readDetail(details, ['linkId']) ?? `on ${host}`} is disconnected`
    case 'arp_problem':
      return `${host} has an ARP problem`
  }
}

function findTargetInterface(device: Device, details: Record<string, unknown>) {
  const interfaceId = readDetail(details, ['interfaceId'])
  if (interfaceId) {
    const byId = device.interfaces.find((iface) => iface.id === interfaceId)
    if (byId) return byId
  }
  const interfaceName = readDetail(details, ['interface'])
  if (interfaceName) {
    const byName = device.interfaces.find((iface) => iface.name === interfaceName)
    if (byName) return byName
  }
  return device.interfaces.find((iface) => iface.ipAddress && iface.status === 'up')
}

function linkTouches(link: NetworkLink, deviceId: string, interfaceId?: string): boolean {
  const sourceMatch = link.sourceDeviceId === deviceId
  const targetMatch = link.targetDeviceId === deviceId
  if (!interfaceId) return sourceMatch || targetMatch
  return (
    (sourceMatch && link.sourceInterfaceId === interfaceId) ||
    (targetMatch && link.targetInterfaceId === interfaceId)
  )
}

function applyFailure(
  devices: Device[],
  links: NetworkLink[],
  injection: FailureInjection,
): { devices: Device[]; links: NetworkLink[] } {
  const { type, deviceId, details } = injection
  const device = devices.find((entry) => entry.id === deviceId)

  switch (type) {
    case 'wrong_ip':
    case 'wrong_subnet': {
      if (!device) return { devices, links }
      const target = findTargetInterface(device, details)
      if (!target) return { devices, links }
      const ip = readDetail(details, ['ip', 'to'])
      const mask = readDetail(details, ['mask'])
      return {
        devices: devices.map((entry) =>
          entry.id !== deviceId
            ? entry
            : {
                ...entry,
                interfaces: entry.interfaces.map((iface) =>
                  iface.id === target.id
                    ? {
                        ...iface,
                        ...(ip ? { ipAddress: ip } : {}),
                        ...(mask ? { subnetMask: mask } : {}),
                      }
                    : iface,
                ),
              },
        ),
        links,
      }
    }

    case 'wrong_gateway': {
      const gateway = readDetail(details, ['to', 'gateway'])
      return {
        devices: devices.map((entry) =>
          entry.id === deviceId ? { ...entry, defaultGateway: gateway } : entry,
        ),
        links,
      }
    }

    case 'missing_route': {
      if (!device) return { devices, links }
      const destination = readDetail(details, ['destination'])
      const mask = readDetail(details, ['mask'])
      return {
        devices: devices.map((entry) =>
          entry.id !== deviceId
            ? entry
            : {
                ...entry,
                staticRoutes: entry.staticRoutes?.filter(
                  (route) =>
                    !(route.destination === destination && (!mask || route.mask === mask)),
                ),
              },
        ),
        links,
      }
    }

    case 'wrong_next_hop':
    case 'routing_misconfig': {
      if (!device) return { devices, links }
      const destination = readDetail(details, ['destination'])
      const nextHop = readDetail(details, ['to', 'nextHop'])
      return {
        devices: devices.map((entry) =>
          entry.id !== deviceId
            ? entry
            : {
                ...entry,
                staticRoutes: entry.staticRoutes?.map((route) =>
                  route.destination === destination
                    ? { ...route, nextHop: nextHop ?? route.nextHop }
                    : route,
                ),
              },
        ),
        links,
      }
    }

    case 'interface_down': {
      if (!device) return { devices, links }
      const target = findTargetInterface(device, details)
      if (!target) return { devices, links }
      return {
        devices: devices.map((entry) =>
          entry.id !== deviceId
            ? entry
            : {
                ...entry,
                interfaces: entry.interfaces.map((iface) =>
                  iface.id === target.id ? { ...iface, status: 'down' as const } : iface,
                ),
              },
        ),
        links: links.map((link) =>
          linkTouches(link, deviceId, target.id) ? { ...link, status: 'down' as const } : link,
        ),
      }
    }

    case 'link_failure': {
      const linkId = readDetail(details, ['linkId'])
      if (linkId) {
        return {
          devices,
          links: links.map((link) =>
            link.id === linkId ? { ...link, status: 'down' as const } : link,
          ),
        }
      }
      const interfaceId = readDetail(details, ['interfaceId', 'interface'])
      return {
        devices,
        links: links.map((link) =>
          linkTouches(link, deviceId, interfaceId) ? { ...link, status: 'down' as const } : link,
        ),
      }
    }

    case 'arp_problem':
      // ARP tables are derived from the live L2 domain at query time, so there is
      // nothing static to mutate. Reserved for a future ARP-cache simulation.
      console.warn(`Failure type "${type}" is not supported yet; skipped.`)
      return { devices, links }
  }
}

/**
 * Produce the broken network for a lab: folds each failure injection into
 * immutable copies of the baseline devices/links.
 */
export function applyFailures(
  devices: Device[],
  links: NetworkLink[],
  failures: FailureInjection[],
): { devices: Device[]; links: NetworkLink[] } {
  return failures.reduce(
    (state, injection) => applyFailure(state.devices, state.links, injection),
    { devices, links },
  )
}
