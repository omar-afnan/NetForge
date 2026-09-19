import type { ProposedChange } from './types'
import type { Device, NetworkInterface } from '@/network/types'
import { getPrimaryInterface } from '@/network/devices'
import { l2Peers } from '@/network/arp'
import { formatNetwork, getNetworkAddress, intToIp, ipToInt, isSameSubnet, isValidIpv4, maskToPrefix } from '@/network/ip'
import { useNetworkStore } from '@/store/networkStore'
import { runConnectivityMatrix } from './tools'
import type { PingTest } from './types'
import { getDevices } from './context'
import { objectiveMet } from '@/features/labs/verification'

/**
 * Root-cause analysis. Reads ONLY live simulator state - no answer keys -
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

/** The router interface sharing a broadcast domain with `host` (its natural gateway). */
function onLinkRouterIface(host: Device): NetworkInterface | undefined {
  const { devices, links } = useNetworkStore.getState()
  const primary = getPrimaryInterface(host)
  if (!primary?.ipAddress || !primary.subnetMask) return undefined
  const routers = l2Peers(devices, links, host, primary).filter(
    (p) => p.device.type === 'router' && p.iface.ipAddress && p.iface.subnetMask,
  )
  const own = routers.find((p) => isSameSubnet(p.iface.ipAddress!, primary.ipAddress!, p.iface.subnetMask!))
  return (own ?? routers[0])?.iface
}

/** A free host address in `routerIface`'s subnet, preferring the host's own host bits. */
function freeAddressIn(routerIface: NetworkInterface, preferFrom: string): string | undefined {
  const mask = ipToInt(routerIface.subnetMask!)
  const network = ipToInt(getNetworkAddress(routerIface.ipAddress!, routerIface.subnetMask!))
  const broadcast = (network | (~mask >>> 0)) >>> 0
  const used = new Set(
    useNetworkStore.getState().devices.flatMap((d) => d.interfaces.map((i) => i.ipAddress).filter(Boolean)),
  )
  const preferred = (network | (ipToInt(preferFrom) & ~mask)) >>> 0
  const candidates = [preferred]
  for (let n = network + 1; n < broadcast && candidates.length < 300; n++) candidates.push(n >>> 0)
  return candidates.map(intToIp).find((ip) => {
    const n = ipToInt(ip)
    return n > network && n < broadcast && !used.has(ip)
  })
}

/**
 * Host address audit, judged against the router on the same segment: a host
 * whose address is outside that router's subnet (bad DHCP scope, typo) or
 * whose mask disagrees with it is misconfigured whether or not a ping fails.
 */
function auditHostAddressing(): { problems: LabProblem[]; fixes: ProposedChange[] } {
  const problems: LabProblem[] = []
  const fixes: ProposedChange[] = []
  for (const host of getDevices()) {
    if (host.type !== 'pc' && host.type !== 'server') continue
    const primary = getPrimaryInterface(host)
    const router = onLinkRouterIface(host)
    if (!primary?.ipAddress || !primary.subnetMask || !router?.ipAddress || !router.subnetMask) continue
    const routerPrefix = maskToPrefix(router.subnetMask)

    if (!isSameSubnet(primary.ipAddress, router.ipAddress, router.subnetMask)) {
      const ip = freeAddressIn(router, primary.ipAddress)
      problems.push({
        severity: 'critical',
        summary: `${host.hostname} has ${primary.ipAddress}, which is outside its LAN ${formatNetwork(router.ipAddress, router.subnetMask)}`,
        detail: `Its router interface is ${router.ipAddress}/${routerPrefix}; the host must use an address in that subnet.`,
      })
      if (ip) {
        fixes.push({
          id: crypto.randomUUID(),
          summary: `Set ${host.hostname} ${primary.name} address → ${ip}/${routerPrefix}`,
          detail: `${primary.ipAddress} is not on the ${formatNetwork(router.ipAddress, router.subnetMask)} segment`,
          deviceRef: host.hostname,
          kind: 'interface',
          payload: { interfaceRef: primary.name, ip, prefix: routerPrefix },
        })
      }
    } else if (primary.subnetMask !== router.subnetMask) {
      problems.push({
        severity: 'critical',
        summary: `${host.hostname} uses mask ${primary.subnetMask} but its LAN is /${routerPrefix}`,
        detail: `The router on its segment (${router.ipAddress}) uses ${router.subnetMask}.`,
      })
      fixes.push({
        id: crypto.randomUUID(),
        summary: `Fix ${host.hostname} ${primary.name} mask → /${routerPrefix}`,
        detail: `Mask ${primary.subnetMask} disagrees with the router on the segment`,
        deviceRef: host.hostname,
        kind: 'interface',
        payload: { interfaceRef: primary.name, ip: primary.ipAddress, prefix: routerPrefix },
      })
    }
  }
  return { problems, fixes }
}

/** Some address inside the network `network` (used to probe reachability). */
function firstHostOf(network: string): string {
  return intToIp((ipToInt(network) + 1) >>> 0)
}

/**
 * Static-route audit: a route whose next hop is not on a connected network,
 * or that no live neighbour answers for, can never forward. Replace it with
 * a next hop that a neighbouring router can demonstrably reach the target through.
 */
function auditStaticRoutes(): { problems: LabProblem[]; fixes: ProposedChange[] } {
  const problems: LabProblem[] = []
  const fixes: ProposedChange[] = []
  const { devices, links } = useNetworkStore.getState()
  for (const router of devices) {
    if (router.type !== 'router') continue
    for (const route of router.staticRoutes ?? []) {
      const egress = route.interfaceId
        ? router.interfaces.find((i) => i.id === route.interfaceId)
        : router.interfaces.find((i) => i.ipAddress && i.subnetMask && isSameSubnet(i.ipAddress, route.nextHop, i.subnetMask))
      // A down egress is a different problem (fixed by enabling the interface).
      if (egress && egress.status !== 'up') continue
      const answers = egress
        ? l2Peers(devices, links, router, egress).some((p) => p.iface.ipAddress === route.nextHop && p.iface.status === 'up')
        : false
      if (answers) continue

      const network = formatNetwork(route.destination, route.mask)
      problems.push({
        severity: 'critical',
        summary: `${router.hostname} routes ${network} via ${route.nextHop}, which nothing answers for`,
        detail: 'The next hop is not on a connected network or its device is unreachable.',
      })
      const better = findWorkingNextHop(router, firstHostOf(getNetworkAddress(route.destination, route.mask)))
      if (better && better !== route.nextHop) {
        fixes.push({
          id: crypto.randomUUID(),
          summary: `Remove bad route on ${router.hostname}: ${network} via ${route.nextHop}`,
          deviceRef: router.hostname,
          kind: 'route-remove',
          payload: { destination: route.destination, mask: route.mask },
        })
        fixes.push({
          id: crypto.randomUUID(),
          summary: `Add static route on ${router.hostname}: ${network} via ${better}`,
          deviceRef: router.hostname,
          kind: 'route-add',
          payload: { destination: getNetworkAddress(route.destination, route.mask), mask: route.mask, nextHop: better },
        })
      }
    }
  }
  return { problems, fixes }
}

/** True when a cable is attached to this interface (topology data does not always set connectedLinkId). */
function isCabled(device: Device, iface: NetworkInterface): boolean {
  return useNetworkStore
    .getState()
    .links.some(
      (l) =>
        (l.sourceDeviceId === device.id && l.sourceInterfaceId === iface.id) ||
        (l.targetDeviceId === device.id && l.targetInterfaceId === iface.id),
    )
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
        teachingPoint = 'The gateway must be an IP on the SAME subnet as the host - usually the router interface on that LAN.'
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
          explanation += ' I could not find a neighbour router that already reaches this network - the gap may be further along the path.'
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
        ? `${failedAt} could not ARP for its gateway - the gateway device is down, unconfigured, or the link between them is down.`
        : `${failedAt} could not ARP for ${destinationIp} - nothing on that segment answers to that IP.`
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
    case 'Destination host unreachable': {
      explanation = `${failedAt} routed the packet to the right LAN, but no live device there answers for ${destinationIp} (wrong or missing IP, down interface, or dead cable).`
      teachingPoint = 'A router that owns the destination subnet ARPs for the host; if nobody replies the ping ends here.'
      break
    }
    case 'Duplicate IP address': {
      explanation = `More than one device is using ${destinationIp} (or the source address), so replies are ambiguous and the ping is refused. Find the two devices and give one a unique address.`
      teachingPoint = 'Every IP on a network must be unique - duplicates break ARP because two MACs claim the same address.'
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

  // Lab objectives the pairwise matrix cannot express (e.g. a DNS record).
  {
    const { lab, devices: liveDevices, simulator } = useNetworkStore.getState()
    for (const objective of lab.objectives ?? []) {
      if (objectiveMet(simulator.ping(objective.from, objective.to), objective.expectHost)) continue
      problems.push({
        severity: 'critical',
        summary: `Objective failing: ${objective.description}`,
        detail: `${objective.to} should be answered by ${objective.expectHost}.`,
      })
      const host = liveDevices.find((d) => d.hostname === objective.expectHost)
      const primary = host && getPrimaryInterface(host)
      if (host && primary?.subnetMask && primary.ipAddress !== objective.to) {
        fixes.push({
          id: crypto.randomUUID(),
          summary: `Restore ${host.hostname} ${primary.name} address → ${objective.to}`,
          detail: `${objective.to} is the address clients are configured to use`,
          deviceRef: host.hostname,
          kind: 'interface',
          payload: { interfaceRef: primary.name, ip: objective.to, mask: primary.subnetMask },
        })
      }
    }
  }

  const addressing = auditHostAddressing()
  problems.push(...addressing.problems)
  fixes.push(...addressing.fixes)
  const routes = auditStaticRoutes()
  problems.push(...routes.problems)
  fixes.push(...routes.fixes)

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
      if (iface.status === 'down' && (iface.connectedLinkId || isCabled(device, iface))) {
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
    .map((test) => `${test.success ? '✓' : '✗'} ${test.source} → ${test.destination}${test.success ? '' : ` - ${test.detail}`}`)
    .join('\n')
}


