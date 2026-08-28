import type { CableKind, Device, NetworkLink } from './types'

export interface CableMeta {
  kind: CableKind
  label: string
  color: string
  bandwidthMbps: number
  dash?: string
}

export const CABLE_PRESETS: Record<CableKind, CableMeta> = {
  copper: { kind: 'copper', label: 'Copper', color: '#2ec8f0', bandwidthMbps: 1000 },
  fiber: { kind: 'fiber', label: 'Fiber', color: '#a78bfa', bandwidthMbps: 10000 },
  serial: { kind: 'serial', label: 'Serial', color: '#fbbf24', bandwidthMbps: 2, dash: '7 4' },
  wireless: { kind: 'wireless', label: 'Wireless', color: '#f472b6', bandwidthMbps: 54, dash: '2 5' },
}

export const CABLE_KINDS: CableKind[] = ['copper', 'fiber', 'serial', 'wireless']

export function cableMeta(kind?: CableKind): CableMeta {
  return CABLE_PRESETS[kind ?? 'copper']
}

/** Interface ids on a device that are already terminated by a cable. */
export function usedInterfaceIds(links: NetworkLink[], deviceId: string): Set<string> {
  const used = new Set<string>()
  for (const link of links) {
    if (link.sourceDeviceId === deviceId) used.add(link.sourceInterfaceId)
    if (link.targetDeviceId === deviceId) used.add(link.targetInterfaceId)
  }
  return used
}

/**
 * First interface on the device without a cable attached.
 * Management ports are skipped so they stay free for out-of-band access.
 */
export function findFreeInterface(
  device: Device,
  links: NetworkLink[],
): Device['interfaces'][number] | undefined {
  const used = usedInterfaceIds(links, device.id)
  return device.interfaces.find(
    (iface) => !used.has(iface.id) && !iface.name.toLowerCase().startsWith('mgmt'),
  )
}

export function formatBandwidth(bandwidthMbps?: number): string {
  const mbps = bandwidthMbps ?? CABLE_PRESETS.copper.bandwidthMbps
  if (mbps >= 1000) return `${mbps / 1000} Gbps`
  return `${mbps} Mbps`
}