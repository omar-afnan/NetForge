import type { ProposedChange } from './types'
import type { Device } from '@/network/types'
import { getPrimaryInterface } from '@/network/devices'
import { formatNetwork, isSameSubnet, isValidIpv4 } from '@/network/ip'
import { useNetworkStore } from '@/store/networkStore'
import { runConnectivityMatrix } from './tools'
import type { PingTest } from './types'
import { getDevices } from './context'

/**
 * Root-cause analysis. Reads ONLY live simulator state — no answer keys —
 * and turns failure reasons into concrete, reviewable ProposedChange objects.
 */

interface Diagnosis {
  explanation: string
  teachingPoint?: string
  fixes: ProposedChange[]
}

function freshDevice(ref: string): Device | undefined {
  return useNetworkStore.getState().devices.find((d) => d.hostname === ref)
}

/** All devices one link away (through switches too) that own the given IP. */
function findGatewayIpFor(host: Device): string | undefined {
  const { links, devices } = useNetworkStore.getState()
  const hostIface = getPrimaryInterface(host)
  if (!hostIface?.ipAddress || !hostIface.subnetMask) return undefined

  const neighbours = new Set<string>()
  for (const link of links) {
    if (link.status !== 'up') continue
    if (link.sourceDeviceId === host.id) neighbours.add(link.targetDeviceId)
    else if (link.targetDeviceId === host.id) neighbours.add(link.sourceDeviceId)
  }

  // Direct neighbour router first…
  for (const id of neighbours) {
    const device = devices.find((d) => d.id === id)
    if (device?.type === 'router') {
      const iface = device.interfaces.find(
        (i) => i.status === 'up' && i.ipAddress && isSameSubnet(i.ipAddress, hostIface.ipAddress!, hostIface.subnetMask!),
      )
      if (iface) return iface.ipAddress
    }
  }
  // …then router behind a switch.
  for (const id of neighbours) {
    const device = devices.find((d) => d.id === id)
    if (device?.type !== 'switch') continue
    for (const link of links) {
      if (link.status !== 'up') continue
      const otherId = link.sourceDeviceId === device.id ? link.targetDeviceId : link.sourceDeviceId
      if (otherId === device.id || otherId === host.id) continue
      const router = devices.find((d) => d.id === otherId)
      if (router?.type !== 'router') continue
      const iface = router.interfaces.find(
        (i) => i.status === 'up' && i.ipAddress && isSameSubnet(i.ipAddress, hostIface.ipAddress!, hostIface.subnetMask!),
      )
      if (iface) return iface.ipAddress
    }
  }
  return undefined
}

/** Which neighbour router of `router` can already reach `destinationIp`? Returns its IP on the shared link. */
function findWorkingNextHop(router: Device, destinationIp: string): string | undefined {
  const { links, devices, simulator } = useNetworkStore.getState()

  for (const link of links) {
    if (link.status !== 'up') continue
    const neighbourId = link.sourceDeviceId === router.id ? link.targetDeviceId : link.sourceDeviceId
    if (link.targetDeviceId !== router.id && link.sourceDeviceId !== router.id) continue
    const neighbour = devices.find((d) => d.id === neighbourId)
    if (!neighbour || neighbour.type !== 'router') continue

    const myIface = router.interfaces.find((i) => i.id === (link.sourceDeviceId === router.id ? link.sourceInterfaceId : link.targetInterfaceId))
    const theirIface = neighbour.interfaces.find((i) => i.id === (link.sourceDeviceId === neighbour.id ? link.sourceInterfaceId : link.targetInterfaceId))
    if (!myIface?.ipAddress || !theirIface?.ipAddress) continue

    const probe = simulator.ping(neighbour.hostname, destinationIp)
    if (probe.success) return theirIface.ipAddress
  }
  return undefined
}

function getNetworkAddress(ip: string, mask: string): string {
  const toInt = (value: string) => value.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
  return [24, 16, 8, 0].map((shift) => ((toInt(ip) >>> shift) & (toInt(mask) >>> shift) & 255)).join('.')
}

/** Turn one failed ping into an explanation + concrete proposed fixes. */
export function diagnosePing(sourceRef: string, destinationIp: string): Diagnosis {
  const { simulator } = useNetworkStore.getState()
  const result = simulator.ping(sourceRef, destinationIp)

  if (result.success) {
    return {
      explanation: `Ping from ${result.source} to ${destinationIp} succeeded (${result.hops.join(' → ')}).`,
      fixes: [],
    }
  }

  const reason = result.failureReason ?? 'Unknown failure'
  const failedAt = result.hops[result.hops.length - 1] ?? sourceRef
  const devices = useNetworkStore.getState().devices
  const destDevice = devices.find((d) => d.interfaces.some((i) => i.ipAddress === destinationIp))
  const host = freshDevice(failedAt)
  const fixes: ProposedChange[] = []
  let explanation = ''
  let teachingPoint: string | undefined

  switch (reason) {
    case 'No default gateway configured': {
      if (host) {
        const gw = findGatewayIpFor(host)
        explanation = `${host.hostname} has no default gateway. It can reach its own subnet, but traffic to ${destinationIp} (a different network) has nowhere to go.`
        teachingPoint = 'A default gateway is the router interface a host uses to leave its own subnet. Same-subnet traffic never needs it; cross-subnet traffic always does.'
        if (gw) fixes.push({ id: crypto.randomUUID(), summary: `Set ${host.hostname} default gateway → ${gw}`, deviceRef: host.hostname, kind: 'gateway', payload: { gateway: gw } })
      }
      break
    }
    case 'Invalid default gateway': {
      if (host) {
        const gw = findGatewayIpFor(host)
        explanation = `${host.hostname} has a default gateway that is not in its own subnet, so it can never reach it.`
        teachingPoint = 'The gateway must be an IP on the SAME subnet as the host — usually the router interface on that LAN.'
        if (gw) fixes.push({ id: crypto.randomUUID(), summary: `Fix ${host.hostname} default gateway → ${gw}`, deviceRef: host.hostname, kind: 'gateway', payload: { gateway: gw } })
      }
      break
    }
    case 'No route to destination': {
      if (host) {
        const destMask = destDevice?.interfaces.find((i) => i.ipAddress === destinationIp)?.subnetMask ?? '255.255.255.0'
        const network = formatNetwork(destinationIp, destMask)
        explanation = `${host.hostname} has no route to ${network}, so it drops the packet.`
        teachingPoint = 'Routers only forward packets for networks in their routing table. Connected routes appear automatically; remote networks need static routes.'
        const nextHop = findWorkingNextHop(host, destinationIp)
        if (nextHop) {
          fixes.push({ id: crypto.randomUUID(), summary: `Add static route on ${host.hostname}: ${network} via ${nextHop}`, deviceRef: host.hostname, kind: 'route-add', payload: { destination: getNetworkAddress(destinationIp, destMask), mask: destMask, nextHop } })
        } else {
          explanation += ' I could not find a neighbour router that already reaches this network — the gap may be further along the path.'
        }
      }
      break
    }
    case 'Interface down': {
      if (host) {
        const down = host.interfaces.find((i) => i.status === 'down')
        explanation = down
          ? `${host.hostname}'s interface ${down.name} is down, so it cannot send or receive anything.`
          : `${host.hostname} has no usable interface (missing IP or down link).`
        teachingPoint = 'Check the physical layer first: a down interface kills ARP, ping and routing alike.'
        if (down) fixes.push({ id: crypto.randomUUID(), summary: `Enable interface ${host.hostname} ${down.name}`, deviceRef: host.hostname, kind: 'interface-status', payload: { interfaceRef: down.name, status: 'up' } })
      }
      break
    }
    case 'ARP resolution failed':
    case 'ARP resolution failed for gateway': {
      explanation = reason === 'ARP resolution failed for gateway'
        ? `${failedAt} could not ARP for its gateway — the gateway device is down, unconfigured, or the link between them is down.`
        : `${failedAt} could not ARP for ${destinationIp} — nothing on that segment answers to that IP.`
      teachingPoint = 'ARP failing means Layer 2 cannot resolve the next MAC: wrong IP, down interface, or a dead link.'
      if (destDevice) {
        const destDown = destDevice.interfaces.find((i) => i.status === 'down')
        if (destDown) fixes.push({ id: crypto.randomUUID(), summary: `Enable interface ${destDevice.hostname} ${destDown.name}`, deviceRef: destDevice.hostname, kind: 'interface-status', payload: { interfaceRef: destDown.name, status: 'up' } })
        if (!destDevice.interfaces.some((i) => i.ipAddress === destinationIp && i.status === 'up')) {
          fixes.push({ id: crypto.randomUUID(), summary: `Bring ${destDevice.hostname}'s interface with ${destinationIp} up`, deviceRef: destDevice.hostname, kind: 'interface-status', payload: { status: 'up' } })
        }
      }
      break
    }
    case 'Egress interface down': {
      if (host) {
        const down = host.interfaces.find((i) => i.status === 'down')
        explanation = `Route lookup on ${host.hostname} succeeded, but the outgoing interface ${down?.name ?? '?'} is down.`
        if (down) fixes.push({ id: crypto.randomUUID(), summary: `Enable interface ${host.hostname} ${down.name}`, deviceRef: host.hostname, kind: 'interface-status', payload: { interfaceRef: down.name, status: 'up' } })
      }
      break
    }
    case 'Next hop unreachable':
    case 'Gateway unreachable': {
      explanation = `${host?.hostname ?? failedAt} knows where traffic should go, but the next-hop device is unreachable (down interface or missing IP).`
      if (destDevice) {
        const destDown = destDevice.interfaces.find((i) => i.status === 'down')
        if (destDown) fixes.push({ id: crypto.randomUUID(), summary: `Enable interface ${destDevice.hostname} ${destDown.name}`, deviceRef: destDevice.hostname, kind: 'interface-status', payload: { interfaceRef: destDown.name, status: 'up' } })
      }
      break
    }
    case 'Invalid source or destination': {
      explanation = 'The source or destination could not be resolved. Check that both devices exist and have an IP configured.'
      break
    }
    default: {
      explanation = `${failedAt} reported: "${reason}".`
    }
  }

  return { explanation: `Path: ${result.hops.join(' → ') || '(empty)'}\n\n${explanation}`, teachingPoint, fixes }
}

export interface LabProblem {
  severity: 'critical' | 'warning' | 'info'
  summary: string
  detail: string
}

/** Dedupe proposed fixes by device + summary text. */
function dedupeFixes(fixes: ProposedChange[]): ProposedChange[] {
  const seen = new Set<string>()
  return fixes.filter((fix) => {
    const key = `${fix.deviceRef}::${fix.summary}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Scan the whole lab: run every endpoint-to-endpoint ping, diagnose each
 * failure, and add proactive config warnings (missing gateways, down
 * interfaces on connected links). Returns problems + a consolidated plan.
 */
export function scanLab(): { problems: LabProblem[]; plan: ProposedChange[]; matrix: PingTest[] } {
  const problems: LabProblem[] = []
  const fixes: ProposedChange[] = []
  const matrix = runConnectivityMatrix()
  const failures = matrix.filter((test) => !test.success)

  for (const failure of failures.slice(0, 8)) {
    const source = freshDevice(failure.source)
    if (!source) continue
    const destinationIp = resolveDestination(failure.destination)
    if (!destinationIp) continue
    const diagnosis = diagnosePing(source.hostname, destinationIp)
    fixes.push(...diagnosis.fixes)
  }

  // Proactive scan: endpoints with an IP but no gateway.
  for (const device of getDevices()) {
    const primary = getPrimaryInterface(device)
    if (!primary?.ipAddress) continue
    if (device.type === 'pc' || device.type === 'server') {
      const gw = findGatewayIpFor(device)
      if (!device.defaultGateway) {
        problems.push({
          severity: 'warning',
          summary: `${device.hostname} has no default gateway`,
          detail: gw ? `Suggested gateway (its router on-link): ${gw}` : 'No router found on its segment.',
        })
        if (gw) {
          fixes.push({ id: crypto.randomUUID(), summary: `Set ${device.hostname} default gateway → ${gw}`, deviceRef: device.hostname, kind: 'gateway', payload: { gateway: gw } })
        }
      } else if (gw && device.defaultGateway !== gw) {
        problems.push({
          severity: 'critical',
          summary: `${device.hostname} has an incorrect default gateway (${device.defaultGateway})`,
          detail: `Its on-link router interface is ${gw}.`,
        })
        fixes.push({ id: crypto.randomUUID(), summary: `Fix ${device.hostname} default gateway → ${gw}`, deviceRef: device.hostname, kind: 'gateway', payload: { gateway: gw } })
      }
    }
    // Endpoints with no IP at all but a connected, up link.
    if (!primary && device.type !== 'switch') {
      problems.push({
        severity: 'warning',
        summary: `${device.hostname} has no IP configuration`,
        detail: 'It has no usable interface, so it cannot participate in the network.',
      })
    }
    // Down interfaces that have a live link attached.
    for (const iface of device.interfaces) {
      if (iface.status === 'down' && iface.connectedLinkId) {
        problems.push({
          severity: 'critical',
          summary: `${device.hostname} ${iface.name} is administratively down`,
          detail: 'The cabling exists but the interface is disabled.',
        })
        fixes.push({ id: crypto.randomUUID(), summary: `Enable interface ${device.hostname} ${iface.name}`, deviceRef: device.hostname, kind: 'interface-status', payload: { interfaceRef: iface.name, status: 'up' } })
      }
    }
  }

  // Down links themselves.
  const { links, devices } = useNetworkStore.getState()
  for (const link of links) {
    if (link.status === 'down') {
      const a = devices.find((d) => d.id === link.sourceDeviceId)?.hostname ?? link.sourceDeviceId
      const b = devices.find((d) => d.id === link.targetDeviceId)?.hostname ?? link.targetDeviceId
      problems.push({ severity: 'critical', summary: `Link ${a} ↔ ${b} is down`, detail: 'A down cable drops all traffic between its two endpoints.' })
      fixes.push({ id: crypto.randomUUID(), summary: `Bring the link ${a} ↔ ${b} back up`, deviceRef: a, kind: 'link-status', payload: { linkId: link.id, status: 'up' } })
    }
  }

  const uniqueFailures = new Set(failures.map((f) => `${f.source}→${f.destination}`)).size
  if (uniqueFailures > 0) {
    problems.unshift({
      severity: 'critical',
      summary: `${uniqueFailures} connectivity test${uniqueFailures === 1 ? '' : 's'} failing`,
      detail: 'See the connectivity matrix results below.',
    })
  }

  return { problems, plan: dedupeFixes(fixes), matrix }
}

function resolveDestination(destination: string): string | undefined {
  const match = /\((\d{1,3}(?:\.\d{1,3}){3})\)/.exec(destination)
  if (match) return match[1]
  return isValidIpv4(destination) ? destination : undefined
}

/** Format the connectivity matrix as a compact check/cross report. */
export function formatMatrix(matrix: PingTest[]): string {
  return matrix
    .map((test) => `${test.success ? '✓' : '✗'} ${test.source} → ${test.destination}${test.success ? '' : ` — ${test.detail}`}`)
    .join('\n')
}


