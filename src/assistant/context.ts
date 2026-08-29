import type { Device } from '@/network/types'
import { getPrimaryInterface, resolveDeviceRef } from '@/network/devices'
import { maskToPrefix } from '@/network/ip'
import { useNetworkStore } from '@/store/networkStore'

export function getDevices(): Device[] {
  return useNetworkStore.getState().devices
}

export function getSelectedDevice(): Device | null {
  const { devices, selectedDeviceId } = useNetworkStore.getState()
  if (!selectedDeviceId) return null
  return devices.find((device) => device.id === selectedDeviceId) ?? null
}

/**
 * Resolve a device reference coming from parsed user input. The literal
 * "this" maps to the currently selected device in the topology canvas.
 */
export function resolveDevice(ref: string | undefined): Device | undefined {
  if (!ref) return undefined
  if (ref === 'this') return getSelectedDevice() ?? undefined
  return resolveDeviceRef(getDevices(), ref)
}

export function primaryIp(device: Device): string | undefined {
  return getPrimaryInterface(device)?.ipAddress
}

export function isEndpoint(device: Device): boolean {
  return (device.type === 'pc' || device.type === 'server') && Boolean(getPrimaryInterface(device)?.ipAddress)
}

export function getEndpoints(): Device[] {
  return getDevices().filter(isEndpoint)
}

export function getSelectedLabel(): string {
  const device = getSelectedDevice()
  return device ? device.hostname : 'none'
}

export function formatDeviceList(): string {
  return getDevices()
    .map((device) => {
      const ip = primaryIp(device)
      return `• ${device.hostname} — ${device.type}${ip ? ` (${ip})` : ' (no IP)'}`
    })
    .join('\n')
}

export function summarizeDevice(device: Device): string {
  const lines: string[] = [`${device.hostname} (${device.type})`]
  for (const iface of device.interfaces) {
    const ip = iface.ipAddress
      ? `${iface.ipAddress}${iface.subnetMask ? `/${maskToPrefix(iface.subnetMask)}` : ''}`
      : 'unassigned'
    lines.push(`  ${iface.name}: ${ip} [${iface.status}]`)
  }
  if (device.defaultGateway) lines.push(`  Gateway: ${device.defaultGateway}`)
  else if (device.type === 'pc' || device.type === 'server') lines.push('  Gateway: not set')
  for (const route of device.staticRoutes ?? []) {
    lines.push(`  Route: ${route.destination}/${maskToPrefix(route.mask)} via ${route.nextHop}`)
  }
  return lines.join('\n')
}

export function formatTopologyOverview(): string {
  const { lab, links, issues } = useNetworkStore.getState()
  const devices = getDevices()
  const lines: string[] = [
    `Lab: ${lab.title} (${lab.difficulty}) — ${devices.length} devices, ${links.length} links.`,
    '',
    'Devices:',
    formatDeviceList(),
    '',
    'Links:',
    ...links.map((link) => {
      const source = devices.find((device) => device.id === link.sourceDeviceId)
      const target = devices.find((device) => device.id === link.targetDeviceId)
      return `• ${source?.hostname ?? '?'} ↔ ${target?.hostname ?? '?'} [${link.status}]`
    }),
  ]
  if (issues.length > 0) {
    lines.push('', `Open issues detected: ${issues.length} (ask me to "find the problem").`)
  }
  return lines.join('\n')
}

export function formatLabInfo(): string {
  const { lab } = useNetworkStore.getState()
  return [
    `Lab: ${lab.title} (${lab.difficulty})`,
    '',
    lab.description,
  ].join('\n')
}
