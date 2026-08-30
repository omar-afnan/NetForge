import type { Device, NetworkInterface } from '@/network/types'
import { getInterfaceById, getPrimaryInterface } from '@/network/devices'
import { isValidIpv4, maskToPrefix, prefixToMask } from '@/network/ip'
import { useNetworkStore } from '@/store/networkStore'
import { useCopilotStore } from '@/store/copilotStore'
import type { PingTest, ToolResult } from './types'
import { getDevices, resolveDevice } from './context'

/* ============================================================
 * Shared helpers
 * ============================================================ */

function logActivity(message: string): void {
  useCopilotStore.getState().addAction({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    message,
    type: 'action',
  })
}

/** Pick the interface the user meant: by name, else the primary, else the first. */
function findTargetInterface(device: Device, interfaceRef: string | undefined): NetworkInterface | undefined {
  if (interfaceRef) {
    const byName = getInterfaceById(device, interfaceRef)
    if (byName) return byName
  }
  return getPrimaryInterface(device) ?? device.interfaces[0]
}

/* ============================================================
 * Read-only tools — the assistant's "eyes" on the live lab.
 * ============================================================ */

export function listDevices(): Device[] {
  return getDevices()
}

export function findDevice(ref: string | undefined): Device | undefined {
  return resolveDevice(ref)
}

export function resolveDestinationIp(ref: string | undefined): string | undefined {
  if (!ref) return undefined
  if (ref.includes('.')) return isValidIpv4(ref) ? ref : undefined
  const device = resolveDevice(ref)
  return device ? getPrimaryInterface(device)?.ipAddress : undefined
}

export function ping(sourceRef: string, destinationRef: string): ToolResult<PingTest> {
  const { simulator } = useNetworkStore.getState()
  const source = resolveDevice(sourceRef)
  if (!source) return { ok: false, error: `I couldn't find a device called "${sourceRef}".` }

  const destinationIp = resolveDestinationIp(destinationRef)
  if (!destinationIp) {
    return { ok: false, error: `I couldn't resolve the destination "${destinationRef}".` }
  }

  const result = simulator.ping(source.hostname, destinationIp)
  useNetworkStore.getState().logPacket({
    source: source.hostname,
    destination: destinationIp,
    protocol: 'ICMP',
    path: result.hops,
    status: result.success ? 'success' : 'failed',
    failureReason: result.success ? undefined : result.failureReason,
  })
  return {
    ok: true,
    data: {
      source: source.hostname,
      destination: destinationIp,
      success: result.success,
      hops: result.hops,
      detail: result.success
        ? `${result.latencyMs}ms via ${result.hops.join(' → ')}`
        : (result.failureReason ?? 'Ping failed.'),
    },
  }
}

export function routingTableReport(ref: string): ToolResult<string> {
  const device = resolveDevice(ref)
  if (!device) return { ok: false, error: `No device called "${ref}".` }
  const { simulator } = useNetworkStore.getState()
  const routes = simulator.getRoutingTable(device.hostname)
  if (routes.length === 0) return { ok: true, data: `${device.hostname} has no routes yet.` }
  const lines = routes.map((route) => {
    const via = route.nextHop ? `via ${route.nextHop}` : 'directly connected'
    return `  ${route.destination}/${maskToPrefix(route.mask)} — ${via} (${route.interfaceName}) [${route.status}]`
  })
  return { ok: true, data: `Routing table for ${device.hostname}:\n${lines.join('\n')}` }
}

export function arpTableReport(ref: string): ToolResult<string> {
  const device = resolveDevice(ref)
  if (!device) return { ok: false, error: `No device called "${ref}".` }
  const { simulator } = useNetworkStore.getState()
  const entries = simulator.getARPTable(device.hostname)
  if (entries.length === 0) return { ok: true, data: `${device.hostname} has no ARP entries yet.` }
  const lines = entries.map((entry) => `  ${entry.ipAddress} → ${entry.macAddress} (${entry.interfaceName})`)
  return { ok: true, data: `ARP table for ${device.hostname}:\n${lines.join('\n')}` }
}

/** Ping every PC/server against every other — the lab's connectivity report card. */
export function runConnectivityMatrix(): PingTest[] {
  const { simulator } = useNetworkStore.getState()
  const endpoints = getDevices().filter(
    (device) => (device.type === 'pc' || device.type === 'server') && getPrimaryInterface(device)?.ipAddress,
  )
  const tests: PingTest[] = []
  for (const source of endpoints) {
    for (const target of endpoints) {
      if (source.id === target.id) continue
      const destinationIp = getPrimaryInterface(target)?.ipAddress
      if (!destinationIp) continue
      const result = simulator.ping(source.hostname, destinationIp)
      tests.push({
        source: source.hostname,
        destination: `${target.hostname} (${destinationIp})`,
        success: result.success,
        detail: result.success ? `${result.latencyMs}ms` : (result.failureReason ?? 'failed'),
      })
    }
  }
  return tests
}

/* ============================================================
 * Mutation tools — every write goes through the real network
 * store actions (deviceId-based) so there is one source of truth.
 * ============================================================ */

/** Validate + configure an interface IP/mask through updateInterface. */
export function configureInterface(args: {
  deviceRef?: string
  interfaceRef?: string
  ip?: string
  mask?: string
  prefix?: number
}): ToolResult<string> {
  const device = resolveDevice(args.deviceRef)
  if (!device) return { ok: false, error: `I couldn't find the device "${args.deviceRef ?? 'you mentioned'}".` }

  const iface = findTargetInterface(device, args.interfaceRef)
  if (!iface) return { ok: false, error: `${device.hostname} has no available interface. No changes were made.` }

  if (!args.ip) return { ok: false, error: 'Which IP address should I configure?' }
  if (!isValidIpv4(args.ip) || args.ip.split('.').some((octet) => Number(octet) > 255)) {
    return { ok: false, error: `"${args.ip}" is not a valid IPv4 address (octets must be 0–255). No changes were made.` }
  }

  let mask: string
  try {
    mask = typeof args.prefix === 'number' ? prefixToMask(args.prefix) : (args.mask ?? '255.255.255.0')
  } catch {
    return { ok: false, error: `/${args.prefix} is not a valid prefix length (0–32). No changes were made.` }
  }
  if (!isValidIpv4(mask) || mask.split('.').some((octet) => Number(octet) > 255)) {
    return { ok: false, error: `"${mask}" is not a valid subnet mask. No changes were made.` }
  }

  // Duplicate-IP guard: never let two interfaces share one address.
  const clash = useNetworkStore
    .getState()
    .devices.flatMap((entry) => entry.interfaces)
    .find((entry) => entry.ipAddress === args.ip && entry.id !== iface.id)
  if (clash) {
    return { ok: false, error: `${args.ip} is already used by another interface. Pick a free address in the subnet. No changes were made.` }
  }

  try {
    useNetworkStore.getState().updateInterface(device.id, iface.id, {
      ipAddress: args.ip,
      subnetMask: mask,
      status: 'up',
    })
  } catch (error) {
    return { ok: false, error: `❌ ${(error as Error).message} No changes were made.` }
  }

  logActivity(`Configured ${device.hostname} ${iface.name} → ${args.ip}/${maskToPrefix(mask)}`)
  return {
    ok: true,
    data: `✅ ${device.hostname} ${iface.name} configured:\n  IP: ${args.ip}\n  Subnet Mask: ${mask} (/${maskToPrefix(mask)})`,
  }
}


/** Set or clear the default gateway via updateDevice. */
export function configureGateway(args: { deviceRef?: string; gateway?: string }): ToolResult<string> {
  const device = resolveDevice(args.deviceRef)
  if (!device) return { ok: false, error: `I couldn't find the device "${args.deviceRef ?? 'you mentioned'}".` }
  if (!args.gateway) return { ok: false, error: 'Which gateway address should I set?' }
  if (!isValidIpv4(args.gateway) || args.gateway.split('.').some((octet) => Number(octet) > 255)) {
    return { ok: false, error: `"${args.gateway}" is not a valid IPv4 address. No changes were made.` }
  }

  const hasUsableInterface = device.interfaces.some(
    (iface) => iface.ipAddress && iface.subnetMask && iface.status === 'up',
  )
  if (!hasUsableInterface && (device.type === 'pc' || device.type === 'server')) {
    return { ok: false, error: `${device.hostname} has no configured interface yet — set its IP first, then the gateway. No changes were made.` }
  }

  try {
    useNetworkStore.getState().updateDevice(device.id, { defaultGateway: args.gateway })
  } catch (error) {
    return { ok: false, error: `❌ ${(error as Error).message} No changes were made.` }
  }

  logActivity(`Set ${device.hostname} default gateway → ${args.gateway}`)
  return { ok: true, data: `✅ ${device.hostname} default gateway set to ${args.gateway}.` }
}

/** Bring an interface up / shut it down via updateInterface. */
export function setInterfaceStatus(args: {
  deviceRef?: string
  interfaceRef?: string
  status: 'up' | 'down'
}): ToolResult<string> {
  const device = resolveDevice(args.deviceRef)
  if (!device) return { ok: false, error: `I couldn't find the device "${args.deviceRef ?? 'you mentioned'}".` }
  const iface = findTargetInterface(device, args.interfaceRef)
  if (!iface) return { ok: false, error: `${device.hostname} has no matching interface. No changes were made.` }

  try {
    useNetworkStore.getState().updateInterface(device.id, iface.id, { status: args.status })
  } catch (error) {
    return { ok: false, error: `❌ ${(error as Error).message} No changes were made.` }
  }

  logActivity(`${args.status === 'up' ? 'Enabled' : 'Shut down'} ${device.hostname} ${iface.name}`)
  return { ok: true, data: `✅ ${device.hostname} ${iface.name} is now ${args.status === 'up' ? 'up' : 'down (administratively shut)'}.` }
}

/** Add a static route via addStaticRoute(deviceId, StaticRoute). */
export function addStaticRoute(args: {
  deviceRef?: string
  destination: string
  mask?: string
  prefix?: number
  nextHop: string
}): ToolResult<string> {
  const device = resolveDevice(args.deviceRef)
  if (!device) return { ok: false, error: `I couldn't find the device "${args.deviceRef ?? 'you mentioned'}".` }
  if (!isValidIpv4(args.destination) || args.destination.split('.').some((octet) => Number(octet) > 255)) {
    return { ok: false, error: `"${args.destination}" is not a valid destination network. No changes were made.` }
  }
  if (!isValidIpv4(args.nextHop) || args.nextHop.split('.').some((octet) => Number(octet) > 255)) {
    return { ok: false, error: `"${args.nextHop}" is not a valid next-hop address. No changes were made.` }
  }

  let mask: string
  try {
    mask = typeof args.prefix === 'number' ? prefixToMask(args.prefix) : (args.mask ?? '255.255.255.0')
  } catch {
    return { ok: false, error: `/${args.prefix} is not a valid prefix length (0–32). No changes were made.` }
  }

  try {
    useNetworkStore.getState().addStaticRoute(device.id, {
      destination: args.destination,
      mask,
      nextHop: args.nextHop,
    })
  } catch (error) {
    return { ok: false, error: `❌ Static route could not be added: ${(error as Error).message} No changes were made.` }
  }

  logActivity(`Added static route on ${device.hostname}: ${args.destination}/${maskToPrefix(mask)} via ${args.nextHop}`)
  return { ok: true, data: `✅ Route added on ${device.hostname}: ${args.destination}/${maskToPrefix(mask)} via ${args.nextHop}.` }
}

/** Remove a static route via removeStaticRoute(deviceId, target). */
export function removeStaticRoute(args: {
  deviceRef?: string
  destination: string
  mask?: string
  prefix?: number
}): ToolResult<string> {
  const device = resolveDevice(args.deviceRef)
  if (!device) return { ok: false, error: `I couldn't find the device "${args.deviceRef ?? 'you mentioned'}".` }
  if (!isValidIpv4(args.destination)) return { ok: false, error: `"${args.destination}" is not a valid network. No changes were made.` }

  const mask = typeof args.prefix === 'number' ? prefixToMask(args.prefix) : (args.mask ?? '255.255.255.0')
  const existing = (device.staticRoutes ?? []).find(
    (route) => route.destination === args.destination && route.mask === mask,
  )
  if (!existing) {
    return { ok: false, error: `${device.hostname} has no route to ${args.destination}/${maskToPrefix(mask)}. Nothing was removed.` }
  }

  try {
    useNetworkStore.getState().removeStaticRoute(device.id, {
      destination: args.destination,
      mask,
      nextHop: existing.nextHop,
    })
  } catch (error) {
    return { ok: false, error: `❌ ${(error as Error).message} No changes were made.` }
  }

  logActivity(`Removed static route on ${device.hostname}: ${args.destination}/${maskToPrefix(mask)}`)
  return { ok: true, data: `✅ Removed route ${args.destination}/${maskToPrefix(mask)} from ${device.hostname}.` }
}

