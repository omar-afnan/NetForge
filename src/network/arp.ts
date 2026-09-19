import type { ARPEntry, Device, NetworkInterface, NetworkLink } from './types'
import { isSameSubnet } from './ip'

/**
 * Layer-2 model.
 *
 * A frame leaving an interface reaches whatever is cabled to it. Switches
 * flood to every other live port, so the search continues *through* switches
 * only; routers and hosts are the edge of a broadcast domain — they are
 * reachable, but nothing beyond them is. Every hop must be a link that is up
 * with both endpoint interfaces up, so a dead cable, a shut port or a deleted
 * device genuinely cuts the path.
 */

export interface L2Peer {
  device: Device
  iface: NetworkInterface
}

function interfaceById(device: Device, id: string): NetworkInterface | undefined {
  return device.interfaces.find((i) => i.id === id)
}

/** Live neighbours directly cabled to one interface (link up, both ends up). */
function directPeers(devices: Map<string, Device>, links: NetworkLink[], device: Device, iface: NetworkInterface): L2Peer[] {
  if (iface.status !== 'up') return []
  const peers: L2Peer[] = []
  for (const link of links) {
    if (link.status !== 'up') continue
    let otherId: string | undefined
    let otherIfaceId: string | undefined
    if (link.sourceDeviceId === device.id && link.sourceInterfaceId === iface.id) {
      otherId = link.targetDeviceId
      otherIfaceId = link.targetInterfaceId
    } else if (link.targetDeviceId === device.id && link.targetInterfaceId === iface.id) {
      otherId = link.sourceDeviceId
      otherIfaceId = link.sourceInterfaceId
    }
    if (!otherId || !otherIfaceId) continue
    const other = devices.get(otherId)
    const otherIface = other && interfaceById(other, otherIfaceId)
    if (other && otherIface && otherIface.status === 'up') peers.push({ device: other, iface: otherIface })
  }
  return peers
}

/**
 * Every host/router interface in the same broadcast domain as `iface`
 * (excluding the interface itself), found by flooding through switches.
 */
export function l2Peers(devices: Device[], links: NetworkLink[], device: Device, iface: NetworkInterface): L2Peer[] {
  const byId = new Map(devices.map((d) => [d.id, d]))
  const endpoints: L2Peer[] = []
  const seenSwitches = new Set<string>()
  const queue = directPeers(byId, links, device, iface)

  while (queue.length > 0) {
    const peer = queue.shift()!
    if (peer.device.type === 'switch') {
      if (seenSwitches.has(peer.device.id)) continue
      seenSwitches.add(peer.device.id)
      // Flood out of every other live port of the switch.
      for (const port of peer.device.interfaces) {
        if (port.id === peer.iface.id) continue
        queue.push(...directPeers(byId, links, peer.device, port))
      }
    } else if (!(peer.device.id === device.id && peer.iface.id === iface.id)) {
      endpoints.push(peer)
    }
  }
  return endpoints
}

/** Deterministic pseudo-age so repeated `show arp` output is stable. */
function arpAge(ip: string): number {
  let hash = 0
  for (const ch of ip) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return (hash % 120) + 1
}

export function getARPTable(device: Device, devices: Device[], links: NetworkLink[]): ARPEntry[] {
  const entries: ARPEntry[] = []
  const seen = new Set<string>()

  for (const iface of device.interfaces) {
    if (!iface.ipAddress || !iface.subnetMask || iface.status !== 'up') continue

    for (const peer of l2Peers(devices, links, device, iface)) {
      const remote = peer.iface
      if (!remote.ipAddress || !remote.subnetMask) continue
      if (!isSameSubnet(iface.ipAddress, remote.ipAddress, iface.subnetMask)) continue

      const key = `${remote.ipAddress}-${iface.id}`
      if (seen.has(key)) continue
      seen.add(key)

      entries.push({
        ipAddress: remote.ipAddress,
        macAddress: remote.macAddress,
        interfaceId: iface.id,
        interfaceName: iface.name,
        age: arpAge(remote.ipAddress),
      })
    }
  }

  return entries.sort((a, b) => a.ipAddress.localeCompare(b.ipAddress))
}

/**
 * ARP for `targetIp` out of `egress`: the neighbour that answers, or undefined
 * if nothing on that broadcast domain owns the address (wrong IP, down
 * interface, dead link, mask mismatch...).
 */
export function resolveNeighbor(
  device: Device,
  egress: NetworkInterface,
  targetIp: string,
  devices: Device[],
  links: NetworkLink[],
): L2Peer | undefined {
  if (!egress.ipAddress || !egress.subnetMask || egress.status !== 'up') return undefined
  if (!isSameSubnet(egress.ipAddress, targetIp, egress.subnetMask)) return undefined
  return l2Peers(devices, links, device, egress).find(
    (peer) => peer.iface.ipAddress === targetIp && peer.iface.status === 'up',
  )
}

export function resolveArp(
  device: Device,
  targetIp: string,
  devices: Device[],
  links: NetworkLink[],
): ARPEntry | undefined {
  return getARPTable(device, devices, links).find((entry) => entry.ipAddress === targetIp)
}
