import type { ARPEntry, Device, NetworkLink } from './types'
import { getDeviceByIp, getInterfaceById } from './devices'
import { getNeighborDeviceIds } from './links'
import { isSameSubnet } from './ip'

/**
 * The set of devices reachable from `startDeviceId` at Layer 2 - i.e. within
 * the same broadcast domain. The BFS only ever continues *through* switches: a
 * router or a host is the edge of a broadcast domain, so it is included in the
 * result but never expanded past. (A router with legs on two switches will
 * therefore appear in both segments' domains; every caller filters the result
 * by the relevant interface's subnet, so that stays correct.)
 */
function collectL2Domain(
  devices: Device[],
  links: NetworkLink[],
  startDeviceId: string,
): Set<string> {
  const byId = new Map(devices.map((d) => [d.id, d]))
  const domain = new Set<string>([startDeviceId])
  const queue: string[] = []

  const expand = (id: string) => {
    for (const neighborId of getNeighborDeviceIds(links, devices, id)) {
      if (domain.has(neighborId)) continue
      domain.add(neighborId)
      if (byId.get(neighborId)?.type === 'switch') queue.push(neighborId)
    }
  }

  expand(startDeviceId)
  while (queue.length > 0) expand(queue.shift()!)

  return domain
}

export function getARPTable(device: Device, devices: Device[], links: NetworkLink[]): ARPEntry[] {
  const entries: ARPEntry[] = []
  const seen = new Set<string>()

  for (const iface of device.interfaces) {
    if (!iface.ipAddress || !iface.subnetMask || iface.status !== 'up') continue

    const domain = collectL2Domain(devices, links, device.id)
    for (const memberId of domain) {
      const member = devices.find((d) => d.id === memberId)
      if (!member || member.id === device.id) continue

      for (const remoteIface of member.interfaces) {
        if (!remoteIface.ipAddress || !remoteIface.subnetMask || remoteIface.status !== 'up') continue
        if (!isSameSubnet(iface.ipAddress, remoteIface.ipAddress, iface.subnetMask)) continue

        const key = `${remoteIface.ipAddress}-${iface.id}`
        if (seen.has(key)) continue
        seen.add(key)

        entries.push({
          ipAddress: remoteIface.ipAddress,
          macAddress: remoteIface.macAddress,
          interfaceId: iface.id,
          interfaceName: iface.name,
          age: Math.floor(Math.random() * 120) + 1,
        })
      }
    }
  }

  return entries.sort((a, b) => a.ipAddress.localeCompare(b.ipAddress))
}

export function resolveArp(
  device: Device,
  targetIp: string,
  devices: Device[],
  links: NetworkLink[],
): ARPEntry | undefined {
  return getARPTable(device, devices, links).find((entry) => entry.ipAddress === targetIp)
}

export function findDeviceOnSubnet(
  devices: Device[],
  links: NetworkLink[],
  sourceDevice: Device,
  egressInterfaceId: string,
  targetIp: string,
): Device | undefined {
  const egress = getInterfaceById(sourceDevice, egressInterfaceId)
  const egressIp = egress?.ipAddress
  const egressMask = egress?.subnetMask
  if (!egressIp || !egressMask) return undefined

  const domain = collectL2Domain(devices, links, sourceDevice.id)
  for (const memberId of domain) {
    const member = devices.find((d) => d.id === memberId)
    if (!member) continue
    const match = member.interfaces.find((iface) => {
      if (!iface.ipAddress || iface.status !== 'up') return false
      return iface.ipAddress === targetIp && isSameSubnet(iface.ipAddress, egressIp, egressMask)
    })
    if (match) return member
  }

  return getDeviceByIp(devices, targetIp)
}
