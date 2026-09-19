import type {
  Device,
  DiagnosticResult,
  ForwardingResult,
  NetworkLink,
  PingResult,
  TraceHop,
} from './types'
import {
  getDeviceByHostname,
  getDeviceByIp,
  getInterfaceById,
  getPrimaryInterface,
  resolveDeviceRef,
  resolveIpRef,
} from './devices'
import { getARPTable as buildArpTable, resolveNeighbor } from './arp'
import { isSameSubnet } from './ip'
import { findBestRoute, getRoutingTable } from './routing'

const MAX_HOPS = 16

export class NetworkSimulator {
  readonly devices: Device[]
  readonly links: NetworkLink[]

  constructor(devices: Device[], links: NetworkLink[]) {
    this.devices = devices
    this.links = links
  }

  resolveDevice(ref: string): Device | undefined {
    return resolveDeviceRef(this.devices, ref)
  }

  resolveIp(ref: string): string | undefined {
    return resolveIpRef(this.devices, ref)
  }

  getRoutingTable(deviceRef: string) {
    const device = this.resolveDevice(deviceRef)
    if (!device) return []
    return getRoutingTable(device)
  }

  getARPTable(deviceRef: string) {
    const device = this.resolveDevice(deviceRef)
    if (!device) return []
    return buildArpTable(device, this.devices, this.links)
  }

  /** IPs owned by more than one device (live interfaces only), with their hostnames. */
  findDuplicateIps(): { ip: string; devices: string[] }[] {
    const owners = new Map<string, Set<string>>()
    for (const device of this.devices) {
      for (const iface of device.interfaces) {
        if (!iface.ipAddress || iface.status !== 'up') continue
        const set = owners.get(iface.ipAddress) ?? new Set<string>()
        set.add(device.hostname)
        owners.set(iface.ipAddress, set)
      }
    }
    return [...owners]
      .filter(([, hosts]) => hosts.size > 1)
      .map(([ip, hosts]) => ({ ip, devices: [...hosts].sort() }))
      .sort((a, b) => a.ip.localeCompare(b.ip))
  }

  /**
   * Hop-by-hop forwarding. Every step is decided from live device config and
   * Layer-2 reachability (see arp.ts): subnet check -> ARP -> route lookup ->
   * next hop -> TTL. Nothing is assumed reachable just because it exists.
   */
  forward(sourceRef: string, destinationRef: string): ForwardingResult {
    const sourceDevice = this.resolveDevice(sourceRef)
    const destinationIp = this.resolveIp(destinationRef)
    const sourceIp = this.resolveIp(sourceRef)

    if (!sourceDevice || !sourceIp || !destinationIp) {
      return {
        success: false,
        path: [],
        failureReason: 'Invalid source or destination',
      }
    }

    const duplicates = this.findDuplicateIps()
    if (duplicates.some((d) => d.ip === destinationIp || d.ip === sourceIp)) {
      return {
        success: false,
        path: [sourceDevice.hostname],
        failureReason: 'Duplicate IP address',
        failedAt: sourceDevice.hostname,
      }
    }

    const path: string[] = [sourceDevice.hostname]
    let current = sourceDevice
    const visited = new Set<string>()
    const owns = (device: Device, ip: string) =>
      device.interfaces.some((iface) => iface.ipAddress === ip && iface.status === 'up')

    for (let hop = 0; hop < MAX_HOPS; hop += 1) {
      if (visited.has(current.id)) {
        return { success: false, path, failureReason: 'Routing loop detected', failedAt: current.hostname }
      }
      visited.add(current.id)

      if (owns(current, destinationIp)) return { success: true, path }

      const primary = getPrimaryInterface(current)
      if (!primary?.ipAddress || !primary.subnetMask || primary.status !== 'up') {
        return {
          success: false,
          path,
          failureReason: 'Interface down',
          failedAt: current.hostname,
        }
      }

      if (current.type === 'pc' || current.type === 'server') {
        if (isSameSubnet(primary.ipAddress, destinationIp, primary.subnetMask)) {
          const target = resolveNeighbor(current, primary, destinationIp, this.devices, this.links)
          if (!target) {
            return {
              success: false,
              path,
              failureReason: 'ARP resolution failed',
              failedAt: current.hostname,
            }
          }
          path.push(target.device.hostname)
          return { success: true, path }
        }

        const gateway = current.defaultGateway
        if (!gateway) {
          return {
            success: false,
            path,
            failureReason: 'No default gateway configured',
            failedAt: current.hostname,
          }
        }

        if (!isSameSubnet(primary.ipAddress, gateway, primary.subnetMask)) {
          return {
            success: false,
            path,
            failureReason: 'Invalid default gateway',
            failedAt: current.hostname,
          }
        }

        const gatewayHop = resolveNeighbor(current, primary, gateway, this.devices, this.links)
        if (!gatewayHop) {
          return {
            success: false,
            path,
            failureReason: 'ARP resolution failed for gateway',
            failedAt: current.hostname,
          }
        }

        path.push(gatewayHop.device.hostname)
        current = gatewayHop.device
        continue
      }

      if (current.type === 'switch') {
        return {
          success: false,
          path,
          failureReason: 'Switch cannot route packets',
          failedAt: current.hostname,
        }
      }

      if (current.type === 'router') {
        const route = findBestRoute(current, destinationIp)
        if (!route) {
          return {
            success: false,
            path,
            failureReason: 'No route to destination',
            failedAt: current.hostname,
          }
        }

        const egress = route.interfaceId ? getInterfaceById(current, route.interfaceId) : undefined
        if (route.type === 'static' && !egress) {
          // A static route whose next hop is not on any connected network.
          return {
            success: false,
            path,
            failureReason: 'Next hop unreachable',
            failedAt: current.hostname,
          }
        }
        if (!egress || egress.status !== 'up') {
          return {
            success: false,
            path,
            failureReason: 'Egress interface down',
            failedAt: current.hostname,
          }
        }

        // Directly connected: ARP for the destination itself. Otherwise ARP
        // for the next hop, which must answer on the egress segment.
        const arpTarget = route.type === 'connected' ? destinationIp : route.nextHop
        const neighbor = arpTarget
          ? resolveNeighbor(current, egress, arpTarget, this.devices, this.links)
          : undefined
        if (!neighbor) {
          return {
            success: false,
            path,
            failureReason: route.type === 'connected' ? 'Destination host unreachable' : 'Next hop unreachable',
            failedAt: current.hostname,
          }
        }

        path.push(neighbor.device.hostname)
        if (route.type === 'connected') return { success: true, path }
        current = neighbor.device
        continue
      }

      return {
        success: false,
        path,
        failureReason: 'Unsupported device type',
        failedAt: current.hostname,
      }
    }

    return {
      success: false,
      path,
      failureReason: 'TTL exceeded',
      failedAt: current.hostname,
    }
  }

  ping(sourceRef: string, destinationRef: string): PingResult {
    const source = this.resolveDevice(sourceRef)
    const sourceIp = this.resolveIp(sourceRef)
    const destinationIp = this.resolveIp(destinationRef)

    if (!source || !sourceIp || !destinationIp) {
      return {
        success: false,
        source: sourceRef,
        destination: destinationRef,
        packetLoss: 100,
        hops: [],
        failureReason: 'Invalid source or destination',
      }
    }

    const result = this.forward(sourceRef, destinationRef)
    return {
      success: result.success,
      source: source.hostname,
      destination: destinationIp,
      latencyMs: result.success ? 1 + result.path.length : undefined,
      packetLoss: result.success ? 0 : 100,
      hops: result.path,
      failureReason: result.failureReason,
    }
  }

  traceRoute(sourceRef: string, destinationRef: string): TraceHop[] {
    const hops: TraceHop[] = []
    const sourceDevice = this.resolveDevice(sourceRef)
    const destinationIp = this.resolveIp(destinationRef)

    if (!sourceDevice || !destinationIp) {
      return [
        {
          hop: 1,
          device: sourceRef,
          status: 'failed',
          failureReason: 'Invalid source or destination',
        },
      ]
    }

    const full = this.forward(sourceRef, destinationRef)
    full.path.forEach((hostname, index) => {
      const device = getDeviceByHostname(this.devices, hostname)
      const ip = device ? getPrimaryInterface(device)?.ipAddress : undefined
      hops.push({
        hop: index + 1,
        device: hostname,
        ip,
        status: 'forwarded',
      })
    })

    if (!full.success) {
      hops.push({
        hop: hops.length + 1,
        device: full.failedAt ?? 'unknown',
        status: 'failed',
        failureReason: full.failureReason,
      })
    }

    return hops
  }

  checkConnectivity(sourceRef: string, destinationRef: string): DiagnosticResult {
    const source = this.resolveDevice(sourceRef)
    const destinationIp = this.resolveIp(destinationRef)
    const hops = this.traceRoute(sourceRef, destinationRef)
    const success = hops.every((hop) => hop.status === 'forwarded')
    const details: string[] = []

    if (source) {
      const routes = getRoutingTable(source)
      details.push(`Source ${source.hostname} has ${routes.length} routing entries`)
    }

    const destDevice = destinationIp ? getDeviceByIp(this.devices, destinationIp) : undefined
    if (destDevice) {
      details.push(`Destination host ${destDevice.hostname} (${destinationIp})`)
    }

    const lastHop = hops[hops.length - 1]
    return {
      success,
      source: source?.hostname ?? sourceRef,
      destination: destinationRef,
      hops,
      failureReason: success ? undefined : lastHop?.failureReason,
      details,
    }
  }
}
