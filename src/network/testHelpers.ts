import type { Device, NetworkLink } from './types'
import { NetworkSimulator } from './simulator'
import { buildStarterTopology } from '@/data/labs/starterLab'

/**
 * Shared fixtures for simulator / lab tests. Everything works on plain
 * `{ devices, links }` snapshots so tests can mutate freely and rebuild a
 * `NetworkSimulator` — the same thing the network store does on every change.
 */
export interface Net {
  devices: Device[]
  links: NetworkLink[]
}

/** Fresh healthy 3-router enterprise topology (PC-01..03, SRV-01..04). */
export function healthyNet(): Net {
  return structuredClone(buildStarterTopology())
}

export function sim(net: Net): NetworkSimulator {
  return new NetworkSimulator(net.devices, net.links)
}

export function dev(net: Net, hostname: string): Device {
  const found = net.devices.find((d) => d.hostname === hostname)
  if (!found) throw new Error(`no device ${hostname}`)
  return found
}

export function link(net: Net, id: string): NetworkLink {
  const found = net.links.find((l) => l.id === id)
  if (!found) throw new Error(`no link ${id}`)
  return found
}

/** Mirror of the store's removeDevice: drops the device and every attached link. */
export function removeDevice(net: Net, hostname: string): void {
  const id = dev(net, hostname).id
  net.devices = net.devices.filter((d) => d.id !== id)
  net.links = net.links.filter((l) => l.sourceDeviceId !== id && l.targetDeviceId !== id)
}

export const ENDPOINTS = {
  pcs: ['PC-01', 'PC-02', 'PC-03'],
  servers: ['SRV-01', 'SRV-02', 'SRV-03', 'SRV-04'],
}
