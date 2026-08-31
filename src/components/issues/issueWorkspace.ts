/**
 * Issue workspace logic — turns LIVE network state into the troubleshooting
 * flow: failure point, evidence, hypothesis feedback, hints, verification.
 *
 * Everything reads the existing simulator/stores. No answer keys, no
 * lab-specific hardcoding: the fault injection system decides what is wrong,
 * this module only helps the student observe and reason about it.
 */
import type { Device, NetworkLink, NetworkIssue, TraceHop } from '@/network/types'
import { getPrimaryInterface } from '@/network/devices'
import { formatNetwork, isSameSubnet, isValidIpv4 } from '@/network/ip'

export type IssueCategory =
  | 'ip'
  | 'subnet'
  | 'gateway'
  | 'routing'
  | 'vlan'
  | 'dhcp'
  | 'dns'
  | 'physical'
  | 'other'

export const HYPOTHESIS_CATEGORIES: { id: IssueCategory; label: string }[] = [
  { id: 'ip', label: 'IP Address' },
  { id: 'subnet', label: 'Subnet Mask' },
  { id: 'gateway', label: 'Default Gateway' },
  { id: 'routing', label: 'Routing' },
  { id: 'vlan', label: 'VLAN' },
  { id: 'dhcp', label: 'DHCP' },
  { id: 'dns', label: 'DNS' },
  { id: 'physical', label: 'Physical Connection' },
  { id: 'other', label: 'Other' },
]

/** Router interface IP on the same subnet as `host`, discovered from live links. */
export function findOnLinkRouterIp(
  host: Device,
  devices: Device[],
  links: NetworkLink[],
): string | undefined {
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
        (i) =>
          i.status === 'up' &&
          i.ipAddress &&
          isSameSubnet(i.ipAddress, hostIface.ipAddress!, hostIface.subnetMask!),
      )
      if (iface) return iface.ipAddress
    }
  }
  // …then a router one switch away.
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
        (i) =>
          i.status === 'up' &&
          i.ipAddress &&
          isSameSubnet(i.ipAddress, hostIface.ipAddress!, hostIface.subnetMask!),
      )
      if (iface) return iface.ipAddress
    }
  }
  return undefined
}

/* ──────────────────────────────────────────────
 * Evidence model
 * ────────────────────────────────────────────── */

export interface EvidenceRow {
  label: string
  value: string
}

export interface EvidenceNote {
  /** Soft observation — points at what to check, never the fix. */
  tone: 'note' | 'warn'
  text: string
  /** Hypothesis categories this observation supports. */
  categories: IssueCategory[]
}

export interface Evidence {
  deviceId: string
  hostname: string
  rows: EvidenceRow[]
  notes: EvidenceNote[]
  /** The router interface on the device's own subnet, if one exists. */
  onLinkRouterIp?: string
}

/**
 * Build evidence for one device purely from live state. Interpretations are
 * educational nudges — they highlight mismatches without prescribing the fix.
 */
export function gatherEvidence(
  device: Device,
  devices: Device[],
  links: NetworkLink[],
): Evidence {
  const rows: EvidenceRow[] = []
  const notes: EvidenceNote[] = []
  const primary = getPrimaryInterface(device)

  rows.push({ label: 'Device Type', value: device.type.toUpperCase() })
  if (primary?.ipAddress) {
    rows.push({ label: 'IP Address', value: primary.ipAddress })
    rows.push({ label: 'Subnet Mask', value: primary.subnetMask ?? '(not set)' })
    if (primary.subnetMask) {
      rows.push({ label: 'Network', value: formatNetwork(primary.ipAddress, primary.subnetMask) })
    }
  } else {
    rows.push({ label: 'IP Address', value: '(none configured)' })
  }
  rows.push({ label: 'Default Gateway', value: device.defaultGateway ?? '(not set)' })

  const onLinkRouterIp = findOnLinkRouterIp(device, devices, links)
  if (onLinkRouterIp) rows.push({ label: 'Connected Router Interface', value: onLinkRouterIp })

  // Interpretation 1: gateway vs the router that actually lives on the subnet.
  if (device.type === 'pc' || device.type === 'server') {
    if (!device.defaultGateway && primary?.ipAddress) {
      notes.push({
        tone: 'note',
        text: `${device.hostname} has no default gateway configured. Traffic to its own subnet still works — traffic anywhere else has no exit.`,
        categories: ['gateway'],
      })
    } else if (onLinkRouterIp && device.defaultGateway && device.defaultGateway !== onLinkRouterIp) {
      notes.push({
        tone: 'warn',
        text: `Possible mismatch: ${device.hostname} uses ${device.defaultGateway} as its gateway, while the router interface on its own subnet is ${onLinkRouterIp}. Traffic leaving the subnet is sent to the gateway address.`,
        categories: ['gateway'],
      })
    } else if (device.defaultGateway && primary?.ipAddress && primary.subnetMask && !isSameSubnet(device.defaultGateway, primary.ipAddress, primary.subnetMask)) {
      notes.push({
        tone: 'warn',
        text: `The gateway ${device.defaultGateway} is not inside ${device.hostname}'s own network ${formatNetwork(primary.ipAddress, primary.subnetMask)}.`,
        categories: ['gateway', 'subnet'],
      })
    }
  }

  // Interpretation 2: neighbours on the same switch — do they share the network?
  if (primary?.ipAddress && primary.subnetMask) {
    const switchIds = new Set(
      links
        .filter((l) => l.status === 'up')
        .map((l) =>
          l.sourceDeviceId === device.id ? l.targetDeviceId : l.targetDeviceId === device.id ? l.sourceDeviceId : null,
        )
        .filter((id): id is string => Boolean(id)),
    )
    for (const sid of switchIds) {
      const sw = devices.find((d) => d.id === sid)
      if (!sw || sw.type !== 'switch') continue
      for (const link of links) {
        if (link.status !== 'up') continue
        const otherId = link.sourceDeviceId === sw.id ? link.targetDeviceId : link.sourceDeviceId
        if (otherId === sw.id || otherId === device.id) continue
        const peer = devices.find((d) => d.id === otherId)
        const peerIface = peer ? getPrimaryInterface(peer) : undefined
        if (!peer || peer.type === 'switch' || !peerIface?.ipAddress || !peerIface.subnetMask) continue
        const same = isSameSubnet(primary.ipAddress, peerIface.ipAddress, primary.subnetMask)
        notes.push({
          tone: 'note',
          text: `Neighbour check: ${peer.hostname} (${formatNetwork(peerIface.ipAddress, peerIface.subnetMask)}) is on the same switch and ${same ? 'shares' : 'does NOT share'} ${device.hostname}'s network ${formatNetwork(primary.ipAddress, primary.subnetMask)}.`,
          categories: same ? [] : ['subnet', 'ip'],
        })
        break
      }
      break
    }
  }

  // Interpretation 3: down interfaces with live cabling.
  for (const iface of device.interfaces) {
    if (iface.status === 'down') {
      const cabled = links.some((l) => l.sourceInterfaceId === iface.id || l.targetInterfaceId === iface.id)
      notes.push({
        tone: cabled ? 'warn' : 'note',
        text: `Interface ${iface.name} is administratively down${cabled ? ' even though a cable is attached to it' : ''}.`,
        categories: ['physical'],
      })
    }
  }

  return { deviceId: device.id, hostname: device.hostname, rows, notes, onLinkRouterIp }
}

/* ──────────────────────────────────────────────
 * Failure point — where does the failing path break?
 * ────────────────────────────────────────────── */

export interface FailurePoint {
  sourceHost: string
  destination: string
  hops: TraceHop[]
  /** Hop index (into hops) where forwarding stopped, if any. */
  failedHopIndex: number | null
  reason?: string
}

export function buildFailurePoint(
  issues: NetworkIssue[],
  devices: Device[],
  traceRoute: (source: string, destination: string) => TraceHop[],
  failingMatrix: { source: string; destination: string } | undefined,
): FailurePoint | null {
  // Prefer a real failing connectivity test; fall back to the audited issue.
  const sourceHost =
    failingMatrix?.source ??
    devices.find((d) => d.id === issues[0]?.deviceId)?.hostname
  if (!sourceHost) return null
  const destination =
    failingMatrix?.destination.match(/\(([\d.]+)\)/)?.[1] ?? failingMatrix?.destination
  if (!destination) return null

  const hops = traceRoute(sourceHost, destination)
  // The traceroute appends a separate "failed" hop that often repeats the last
  // forwarded device — collapse it so the ❌ lands on the actual hop.
  const failedIdx = hops.findIndex((hop) => hop.status === 'failed')
  if (failedIdx > 0 && hops[failedIdx].device === hops[failedIdx - 1].device) {
    hops.splice(failedIdx - 1, 1)
  }
  const failedIndex = hops.findIndex((hop) => hop.status === 'failed')
  return {
    sourceHost,
    destination,
    hops,
    failedHopIndex: failedIndex >= 0 ? failedIndex : null,
    reason: failedIndex >= 0 ? hops[failedIndex].failureReason : undefined,
  }
}

/* ──────────────────────────────────────────────
 * Hypothesis feedback — educational, evidence-driven
 * ────────────────────────────────────────────── */

export interface HypothesisFeedback {
  correctDirection: boolean
  text: string
  suggestedTest?: string
}

export function evaluateHypothesis(
  category: IssueCategory,
  evidence: Evidence | null,
): HypothesisFeedback {
  const supported = evidence?.notes.filter((n) => n.categories.includes(category)) ?? []
  const anyWarn = evidence?.notes.some((n) => n.tone === 'warn') ?? false

  if (supported.length > 0) {
    const tests: Partial<Record<IssueCategory, string>> = {
      gateway: evidence
        ? `ping ${evidence.rows.find((r) => r.label === 'Default Gateway')?.value ?? 'the gateway'}`
        : 'ping the default gateway',
      subnet: 'ping a neighbour on the same switch and compare both network addresses',
      ip: 'ping a neighbour on the same switch — if that works, the local IP is fine',
      routing: 'show ip route on the last working hop',
      physical: 'show interfaces — look for status down',
      vlan: 'compare which ports the two hosts use on the switch',
      dhcp: 'check the address the device actually received against the expected scope',
      dns: "compare the name's resolved address with the address the server actually owns",
    }
    return {
      correctDirection: true,
      text: `✓ Correct direction. ${supported[0].text}`,
      suggestedTest: tests[category],
    }
  }

  const nudges: Record<IssueCategory, string> = {
    ip: 'That is possible, but the current evidence does not strongly support it. Try pinging a device on the same subnet first — if that succeeds, the local address is probably fine.',
    subnet:
      'A wrong mask can make local traffic look remote, but check the basics first: can this device reach anything at all?',
    gateway:
      'The gateway only matters for traffic leaving the subnet. First prove where the path actually breaks — try a ping to a device on the same subnet.',
    routing:
      'Routing could be involved, but confirm the host side first. Check whether the device can reach its own gateway before looking at router tables.',
    vlan: 'VLAN issues usually cut off entire groups of ports. Is more than one device affected, or just this one?',
    dhcp: 'DHCP problems usually show up as a missing or clearly wrong address. The device does have an address configured — verify whether it belongs to the right network.',
    dns: 'DNS translates names to addresses. If pings by IP address fail too, DNS is not the culprit.',
    physical:
      'A physical fault usually takes out the whole device. Check its interfaces and whether neighbours on the same switch still work.',
    other: 'Keep it scientific: change one variable at a time and re-test after each change.',
  }

  return {
    correctDirection: false,
    text:
      nudges[category] +
      (anyWarn ? ' There is at least one warning in the evidence worth reading first.' : ''),
  }
}

/* ──────────────────────────────────────────────
 * Progressive hints — 3 strength levels
 * ────────────────────────────────────────────── */

export function progressiveHint(evidence: Evidence | null, level: number): string {
  const warn = evidence?.notes.find((n) => n.tone === 'warn')
  if (level <= 0) {
    return evidence
      ? `Start with the evidence panel: run a ping from ${evidence.hostname} to a device on the same subnet, then to one on a different subnet. Where the path stops tells you which layer to investigate.`
      : 'Begin at the physical layer and work up: interfaces, then local subnet reachability, then the gateway, then routing.'
  }
  if (level === 1) {
    return warn
      ? 'Look at the warning in your evidence — it compares what the device HAS with what it SHOULD have. Think about which device handles traffic that leaves the local network.'
      : 'Think about what device a host uses to reach destinations outside its own subnet — and check that configuration carefully.'
  }
  const configured = evidence?.rows.find((r) => r.label === 'Default Gateway')?.value
  const actual = evidence?.rows.find((r) => r.label === 'Connected Router Interface')?.value
  if (configured && actual && configured !== actual) {
    return `The evidence shows the mismatch: ${evidence?.hostname} is configured to use ${configured}, but the router interface actually living on its subnet is ${actual}. For traffic to leave the local network, the gateway must point at a live interface on the same subnet. Fix whichever value is wrong, then re-test.`
  }
  return warn
    ? 'The evidence contains a warning that compares what the device HAS with what it SHOULD have — resolve that mismatch and re-test.'
    : 'Compare every configured value in the evidence against the live network state — the mismatch is the fault.'
}

/* ──────────────────────────────────────────────
 * Verification — real tests only
 * ────────────────────────────────────────────── */

export interface VerificationTest {
  label: string
  source: string
  destinationIp: string
}

/**
 * Build the verification suite from live state: the affected host's gateway
 * (if any) plus one destination per remote network in the topology.
 */
export function buildVerificationTests(
  source: Device | undefined,
  devices: Device[],
): VerificationTest[] {
  const tests: VerificationTest[] = []
  if (!source) return tests

  const gw = source.defaultGateway
  if (gw && isValidIpv4(gw)) {
    tests.push({ label: `${source.hostname} → Default Gateway`, source: source.hostname, destinationIp: gw })
  }

  const myIface = getPrimaryInterface(source)
  const seenNetworks = new Set<string>()
  for (const device of devices) {
    // Only real endpoints: switch/router interface addresses are not valid
    // verification targets (routers need explicit routes to reach them).
    if (device.id === source.id || device.type === 'switch' || device.type === 'router') continue
    const iface = getPrimaryInterface(device)
    if (!iface?.ipAddress || !iface.subnetMask || !myIface?.ipAddress || !myIface.subnetMask) continue
    if (isSameSubnet(iface.ipAddress, myIface.ipAddress, myIface.subnetMask)) continue
    const network = formatNetwork(iface.ipAddress, iface.subnetMask)
    if (seenNetworks.has(network)) continue
    seenNetworks.add(network)
    tests.push({
      label: `${source.hostname} → ${device.hostname} (${network})`,
      source: source.hostname,
      destinationIp: iface.ipAddress,
    })
  }
  return tests
}

/* ──────────────────────────────────────────────
 * Resolution history — per-lab, localStorage-backed
 * ────────────────────────────────────────────── */

export interface ResolutionRecord {
  labId: string
  issueTitle: string
  solvedBy: 'Student' | 'AI'
  attempts: number
  aiAssistance: 'None' | 'Hint' | 'Explain' | 'Full Investigation'
  time: string
}

const HISTORY_KEY = 'netforge-issue-history'

export function loadHistory(labId: string): ResolutionRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const all: ResolutionRecord[] = raw ? JSON.parse(raw) : []
    return all.filter((r) => r.labId === labId)
  } catch {
    return []
  }
}

export function saveResolution(record: ResolutionRecord): void {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const all: ResolutionRecord[] = raw ? JSON.parse(raw) : []
    all.push(record)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all))
  } catch {
    // ignore quota errors
  }
}