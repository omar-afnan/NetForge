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
import { findDeviceOnSubnet, getARPTable as buildArpTable, resolveArp } from './arp'
import { isSameSubnet } from './ip'
import { findBestRoute, getRoutingTable } from './routing'
import { getNeighborDeviceIds } from './links'

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

  private findNextHopRouter(current: Device, nextHopIp: string): Device | undefined {
    const neighbors = getNeighborDeviceIds(this.links, this.devices, current.id)
    for (const neighborId of neighbors) {
      const neighbor = this.devices.find((d) => d.id === neighborId)
      if (!neighbor) continue
      if (neighbor.interfaces.some((iface) => iface.ipAddress === nextHopIp && iface.status === 'up')) {
        return neighbor
      }
      if (neighbor.type === 'switch') {
        const beyond = getNeighborDeviceIds(this.links, this.devices, neighbor.id)
        for (const id of beyond) {
          const routed = this.devices.find((d) => d.id === id)
          if (routed?.interfaces.some((iface) => iface.ipAddress === nextHopIp && iface.status === 'up')) {
            return routed
          }
        }
      }
    }
    return getDeviceByIp(this.devices, nextHopIp)
  }

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

    const destDevice = getDeviceByIp(this.devices, destinationIp)
    const path: string[] = [sourceDevice.hostname]
    let current = sourceDevice
    let currentIp = sourceIp
    const visited = new Set<string>()

    for (let hop = 0; hop < MAX_HOPS; hop += 1) {
      if (visited.has(current.id)) {
        return { success: false, path, failureReason: 'Routing loop detected', failedAt: current.hostname }
      }
      visited.add(current.id)

      if (destinationIp === currentIp) {
        if (destDevice && !path.includes(destDevice.hostname)) path.push(destDevice.hostname)
        return { success: true, path }
      }

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
          const arp = resolveArp(current, destinationIp, this.devices, this.links)
          if (!arp) {
            return {
              success: false,
              path,
              failureReason: 'ARP resolution failed',
              failedAt: current.hostname,
            }
          }
          const target = getDeviceByIp(this.devices, destinationIp)
          if (target) path.push(target.hostname)
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

        const gwArp = resolveArp(current, gateway, this.devices, this.links)
        if (!gwArp) {
          return {
            success: false,
            path,
            failureReason: 'ARP resolution failed for gateway',
            failedAt: current.hostname,
          }
        }

        const gatewayDevice = getDeviceByIp(this.devices, gateway)
        if (!gatewayDevice) {
          return {
            success: false,
            path,
            failureReason: 'Gateway unreachable',
            failedAt: current.hostname,
          }
        }

        path.push(gatewayDevice.hostname)
        current = gatewayDevice
        currentIp = gateway
        continue
      }

      if (current.type === 'router' || current.type === 'switch') {
        if (current.type === 'switch') {
          return {
            success: false,
            path,
            failureReason: 'Switch cannot route packets',
            failedAt: current.hostname,
          }
        }

        const route = findBestRoute(current, destinationIp)
        if (!route) {
          return {
            success: false,
            path,
            failureReason: 'No route to destination',
            failedAt: current.hostname,
          }
        }

        const egress = getInterfaceById(current, route.interfaceId)
        if (!egress || egress.status !== 'up') {
          return {
            success: false,
            path,
            failureReason: 'Egress interface down',
            failedAt: current.hostname,
          }
        }

        if (route.type === 'connected' && destDevice) {
          const onSubnet = findDeviceOnSubnet(
            this.devices,
            this.links,
            current,
            route.interfaceId,
            destinationIp,
          )
          if (onSubnet) {
            path.push(onSubnet.hostname)
            return { success: true, path }
          }
        }

        const nextHop = route.nextHop
        if (!nextHop) {
          return {
            success: false,
            path,
            failureReason: 'Missing next hop',
            failedAt: current.hostname,
          }
        }

        const nextDevice = this.findNextHopRouter(current, nextHop)
        if (!nextDevice) {
          return {
            success: false,
            path,
            failureReason: 'Next hop unreachable',
            failedAt: current.hostname,
          }
        }

        if (!path.includes(nextDevice.hostname)) path.push(nextDevice.hostname)
        current = nextDevice
        currentIp = nextHop
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
