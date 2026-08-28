import type { Device, NetworkLink } from './types'
import { getInterfaceById } from './devices'

export function getLinksForDevice(links: NetworkLink[], deviceId: string): NetworkLink[] {
  return links.filter(
    (link) => link.sourceDeviceId === deviceId || link.targetDeviceId === deviceId,
  )
}

export function getNeighborDeviceIds(
  links: NetworkLink[],
  devices: Device[],
  deviceId: string,
): string[] {
  const neighbors = new Set<string>()

  for (const link of getLinksForDevice(links, deviceId)) {
    if (link.status !== 'up') continue

    const source = devices.find((d) => d.id === link.sourceDeviceId)
    const target = devices.find((d) => d.id === link.targetDeviceId)
    if (!source || !target) continue

    const sourceIface = getInterfaceById(source, link.sourceInterfaceId)
    const targetIface = getInterfaceById(target, link.targetInterfaceId)
    if (sourceIface?.status !== 'up' || targetIface?.status !== 'up') continue

    if (link.sourceDeviceId === deviceId) neighbors.add(link.targetDeviceId)
    if (link.targetDeviceId === deviceId) neighbors.add(link.sourceDeviceId)
  }

  return [...neighbors]
}
