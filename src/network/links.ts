import type { NetworkLink } from './types'

export function getLinksForDevice(links: NetworkLink[], deviceId: string): NetworkLink[] {
  return links.filter(
    (link) => link.sourceDeviceId === deviceId || link.targetDeviceId === deviceId,
  )
}
