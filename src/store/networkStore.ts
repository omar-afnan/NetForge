import { create } from 'zustand'
import { celebrateLab } from '@/lib/celebrate'
import { labCompletionService } from '@/features/labs/completion/completionEvents'
import { useCopilotStore } from './copilotStore'

import type {
  CableKind,
  Device,
  DeviceType,
  NetworkIssue,
  NetworkLink,
  Packet,
  PacketTrace,
  ProposedFix,
} from '@/network/types'
import type { NetworkInterface, StaticRoute } from '@/network/types'
import { NetworkSimulator } from '@/network/simulator'
import { starterLab, type LabDefinition } from '@/data/labs/starterLab'
import { applyFailures, type FailureInjection } from '@/network/failures'
import { isSameSubnet } from '@/network/ip'
import { createDevice, nextHostname, planLink } from '@/network/builder'
import { CABLE_PRESETS } from '@/network/cables'

const STORAGE_KEY = 'netforge-network'
const LAB_PROGRESS_KEY = 'netforge-lab-progress'

function loadPersistedState(): Partial<NetworkState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data.devices || !data.links) return null
    return data
  } catch {
    return null
  }
}

function loadLabProgress(): Record<string, { completed: boolean; completedAt: string; attempts: number; hintsUsed: number; aiAssisted: boolean }> {
  try {
    const raw = localStorage.getItem(LAB_PROGRESS_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function persistLabProgress(progress: Record<string, { completed: boolean; completedAt: string; attempts: number; hintsUsed: number; aiAssisted: boolean }>) {
  try {
    localStorage.setItem(LAB_PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // ignore quota errors
  }
}

function persistState(state: NetworkState) {
  try {
    // packets is a live, in-memory session log - never persisted.
    const { simulator, packets, ...rest } = state as any
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
  } catch {
    // ignore quota errors
  }
}

interface LinkResult {
  ok: boolean
  message: string
}

interface NetworkState {
  lab: LabDefinition
  devices: Device[]
  links: NetworkLink[]
  issues: NetworkIssue[]
  failures: FailureInjection[]
  proposedFixes: ProposedFix[]
  packets: Packet[]
  selectedDeviceId: string | null
  selectedLinkId: string | null
  packetTrace: PacketTrace | null
  highlightedDeviceId: string | null
  completedLabs: Record<string, { completed: boolean; completedAt: string; attempts: number; hintsUsed: number; aiAssisted: boolean }>
  simulator: NetworkSimulator
  baseline: { devices: Device[]; links: NetworkLink[] }
  loadLab: (lab: LabDefinition) => void
  resetLab: () => void
  clearFaults: () => void
  revalidate: () => void
  selectDevice: (deviceId: string | null) => void
  selectLink: (linkId: string | null) => void
  addDevice: (type: DeviceType, position: { x: number; y: number }) => string
  moveDevice: (deviceId: string, position: { x: number; y: number }) => void
  removeDevice: (deviceId: string) => void
  updateDevice: (deviceId: string, patch: { hostname?: string; defaultGateway?: string }) => void
  updateInterface: (
    deviceId: string,
    interfaceId: string,
    patch: Pick<NetworkInterface, 'ipAddress' | 'subnetMask' | 'status'>,
  ) => void
  addLink: (sourceDeviceId: string, targetDeviceId: string, kind?: CableKind) => LinkResult
  removeLink: (linkId: string) => void
  setLinkStatus: (linkId: string, status: 'up' | 'down') => void
  setLinkKind: (linkId: string, kind: CableKind) => void
  addStaticRoute: (deviceId: string, route: StaticRoute) => void
  removeStaticRoute: (
    deviceId: string,
    target: { destination: string; mask: string; nextHop?: string },
  ) => void
  setPacketTrace: (trace: PacketTrace | null) => void
  clearPacketTrace: () => void
  logPacket: (entry: Omit<Packet, 'id'>) => void
  clearPackets: () => void
  setHighlightedDevice: (deviceId: string | null) => void
  completeLab: (labId: string, aiAssisted: boolean) => void
  resetLabProgress: (labId: string) => void
}

function createSimulator(devices: Device[], links: NetworkLink[]) {
  return new NetworkSimulator(devices, links)
}

/**
 * Static config audit: gateways that are unreachable/out of subnet and static
 * routes with a down egress or an unresolvable next hop.
 */
function auditDeviceConfig(device: Device, devices: Device[]): NetworkIssue[] {
  const issues: NetworkIssue[] = []

  if (device.defaultGateway) {
    const gw = device.defaultGateway
    const inSubnet = device.interfaces.some(
      (iface) =>
        iface.status === 'up' &&
        iface.ipAddress &&
        iface.subnetMask &&
        isSameSubnet(iface.ipAddress, gw, iface.subnetMask),
    )
    if (!inSubnet) {
      issues.push({
        id: `gw-subnet-${device.id}`,
        severity: 'critical',
        deviceId: device.id,
        description: `Default gateway ${gw} is outside every local subnet`,
        detectedBy: 'config-audit',
        evidence: device.interfaces
          .map((iface) => `${iface.name}=${iface.ipAddress ?? '-'}/${iface.subnetMask ?? '-'}`)
          .join(', '),
        status: 'open',
      })
    } else {
      const owner = devices.find((entry) =>
        entry.interfaces.some((iface) => iface.ipAddress === gw && iface.status === 'up'),
      )
      if (!owner) {
        issues.push({
          id: `gw-dead-${device.id}`,
          severity: 'critical',
          deviceId: device.id,
          description: `Default gateway ${gw} does not answer`,
          detectedBy: 'gateway-probe',
          evidence: 'No live interface owns the gateway address',
          status: 'open',
        })
      }
    }
  }

  for (const route of device.staticRoutes ?? []) {
    const egress = route.interfaceId
      ? device.interfaces.find((iface) => iface.id === route.interfaceId)
      : undefined
    if (route.interfaceId && (!egress || egress.status !== 'up')) {
      issues.push({
        id: `route-egress-${device.id}-${route.destination}`,
        severity: 'critical',
        deviceId: device.id,
        description: `Route to ${route.destination}/${route.mask} uses a down interface`,
        detectedBy: 'route-audit',
        evidence: `Egress ${egress?.name ?? route.interfaceId} is ${egress?.status ?? 'missing'}`,
        status: 'open',
      })
      continue
    }
    if (!route.nextHop) continue
    const nextHopLocal = device.interfaces.some(
      (iface) =>
        iface.status === 'up' &&
        iface.ipAddress &&
        iface.subnetMask &&
        isSameSubnet(route.nextHop, iface.ipAddress, iface.subnetMask),
    )
    if (!nextHopLocal) {
      issues.push({
        id: `route-nh-local-${device.id}-${route.destination}`,
        severity: 'warning',
        deviceId: device.id,
        description: `Route to ${route.destination}/${route.mask} has a next hop not on any connected network`,
        detectedBy: 'route-audit',
        evidence: `Next hop ${route.nextHop}`,
        status: 'open',
      })
      continue
    }
    const nextHopOwned = devices.some((entry) =>
      entry.interfaces.some((iface) => iface.ipAddress === route.nextHop && iface.status === 'up'),
    )
    if (!nextHopOwned) {
      issues.push({
        id: `route-nh-dead-${device.id}-${route.destination}`,
        severity: 'warning',
        deviceId: device.id,
        description: `Route to ${route.destination}/${route.mask} points at an unreachable next hop`,
        detectedBy: 'route-audit',
        evidence: `Next hop ${route.nextHop} has no live interface`,
        status: 'open',
      })
    }
  }

  return issues
}

/** Reachability audit: every PC probes every server through the live simulator. */
function auditReachability(sources: Device[], targets: Device[], simulator: NetworkSimulator): NetworkIssue[] {
  const issues: NetworkIssue[] = []

  for (const source of sources) {
    const failures = new Map<string, string[]>()
    for (const target of targets) {
      const destinationIp = target.interfaces.find((iface) => iface.ipAddress)?.ipAddress
      if (!destinationIp) continue
      const result = simulator.ping(source.hostname, destinationIp)
      if (!result.success && result.failureReason) {
        const list = failures.get(result.failureReason) ?? []
        list.push(`${target.hostname} (${destinationIp})`)
        failures.set(result.failureReason, list)
      }
    }
    for (const [reason, destinations] of failures) {
      issues.push({
        id: `reach-${source.id}-${reason}`,
        severity: 'critical',
        deviceId: source.id,
        description: `${source.hostname} cannot reach ${destinations.length} destination(s): ${reason}`,
        detectedBy: 'reachability-audit',
        evidence: destinations.join(', '),
        status: 'open',
      })
    }
  }

  return issues
}

function deriveIssues(
  devices: Device[],
  links: NetworkLink[],
  simulator: NetworkSimulator,
): NetworkIssue[] {
  void links
  const config = devices.flatMap((device) => auditDeviceConfig(device, devices))
  const hosts = devices.filter((device) => device.type === 'pc')
  const servers = devices.filter((device) => device.type === 'server')
  return [...config, ...auditReachability(hosts, servers, simulator)]
}

/** Rebuild the simulator and re-run all audits after any state mutation. */
function commit(devices: Device[], links: NetworkLink[]) {
  const simulator = createSimulator(devices, links)
  return { simulator, issues: deriveIssues(devices, links, simulator) }
}

const persisted: any = loadPersistedState()
const labProgress = loadLabProgress()

export const useNetworkStore = create<NetworkState>((set, get) => {
  const init = persisted
    ? {
        lab: persisted.lab ?? starterLab,
        baseline: persisted.baseline ?? { devices: persisted.devices, links: persisted.links },
        devices: persisted.devices,
        links: persisted.links,
        failures: persisted.failures ?? [],
        proposedFixes: persisted.proposedFixes ?? [],
        packets: [],
        selectedDeviceId: persisted.selectedDeviceId ?? null,
        selectedLinkId: persisted.selectedLinkId ?? null,
        packetTrace: persisted.packetTrace ?? null,
        highlightedDeviceId: null,
        completedLabs: labProgress,
        ...commit(persisted.devices, persisted.links),
      }
    : {
        lab: starterLab,
        baseline: { devices: starterLab.devices, links: starterLab.links },
        devices: starterLab.devices,
        links: starterLab.links,
        issues: [],
        failures: [],
        proposedFixes: [],
        packets: [],
        selectedDeviceId: null,
        selectedLinkId: null,
        packetTrace: null,
        highlightedDeviceId: null,
        completedLabs: labProgress,
        simulator: createSimulator(starterLab.devices, starterLab.links),
      }

  return {
    ...init,
    loadLab: (lab) => {
      const baseline = { devices: lab.devices, links: lab.links }
      const broken = applyFailures(baseline.devices, baseline.links, lab.failures ?? [])
      set({
        lab,
        baseline,
        devices: broken.devices,
        links: broken.links,
        failures: lab.failures ?? [],
        proposedFixes: [],
        selectedDeviceId: null,
        selectedLinkId: null,
        packetTrace: null,
        packets: [], // live session log - never carry packets between labs
        ...commit(broken.devices, broken.links),
      })
      useNetworkStore.setState({ highlightedDeviceId: null })
      // Fresh session for the newly loaded lab (fresh chat, no takeover/plan).
      useCopilotStore.getState().switchLab(lab.id, { fresh: true })
    },

  // Discard every manual change and re-inject the lab's baseline faults.
  resetLab: () => {
    const { lab } = get()
    get().resetLabProgress(lab.id)
    get().loadLab(lab)
  },

  // Remove the injected faults entirely (network becomes the pristine baseline).
  clearFaults: () => {
    const { baseline } = get()
    const devices = structuredClone(baseline.devices)
    const links = structuredClone(baseline.links)
    set({
      devices,
      links,
      failures: [],
      proposedFixes: [],
      packetTrace: null,
      ...commit(devices, links),
    })
  },

  revalidate: () => {
    const { devices, links, simulator } = get()
    set({ issues: deriveIssues(devices, links, simulator) })
  },

  selectDevice: (deviceId) => set({ selectedDeviceId: deviceId, selectedLinkId: null }),
  selectLink: (linkId) => set({ selectedLinkId: linkId, selectedDeviceId: null }),

  addDevice: (type, position) => {
    const { devices } = get()
    const id = `dev-${crypto.randomUUID().slice(0, 8)}`
    const hostname = nextHostname(devices, type)
    const device = createDevice(id, type, hostname, position, devices)

    set((state) => ({
      devices: [...state.devices, device],
      selectedDeviceId: id,
      selectedLinkId: null,
      ...commit([...state.devices, device], state.links),
    }))
    return id
  },

  // Position-only change: the simulator never reads positions, so it can stay.
  moveDevice: (deviceId, position) =>
    set((state) => ({
      devices: state.devices.map((device) =>
        device.id === deviceId ? { ...device, position } : device,
      ),
    })),

  removeDevice: (deviceId) =>
    set((state) => {
      const links = state.links.filter(
        (link) => link.sourceDeviceId !== deviceId && link.targetDeviceId !== deviceId,
      )
      const devices = state.devices.filter((entry) => entry.id !== deviceId)
      return {
        devices,
        links,
        selectedDeviceId: state.selectedDeviceId === deviceId ? null : state.selectedDeviceId,
        selectedLinkId:
          state.selectedLinkId && !links.some((l) => l.id === state.selectedLinkId)
            ? null
            : state.selectedLinkId,
        packetTrace: null,
        ...commit(devices, links),
      }
    }),

  updateDevice: (deviceId, patch) =>
    set((state) => {
      const devices = state.devices.map((device) =>
        device.id === deviceId
          ? {
              ...device,
              ...(patch.hostname !== undefined ? { hostname: patch.hostname } : {}),
              ...(patch.defaultGateway !== undefined
                ? { defaultGateway: patch.defaultGateway }
                : {}),
            }
          : device,
      )
      return { devices, ...commit(devices, state.links) }
    }),

  updateInterface: (deviceId, interfaceId, patch) =>
    set((state) => {
      const devices = state.devices.map((device) =>
        device.id === deviceId
          ? {
              ...device,
              interfaces: device.interfaces.map((iface) =>
                iface.id === interfaceId ? { ...iface, ...patch } : iface,
              ),
            }
          : device,
      )
      return { devices, ...commit(devices, state.links) }
    }),

  addLink: (sourceDeviceId, targetDeviceId, kind = 'copper') => {
    const { devices, links } = get()
    const plan = planLink(devices, links, sourceDeviceId, targetDeviceId)
    if (!plan.ok) {
      return { ok: false, message: plan.reason }
    }

    const source = devices.find((device) => device.id === sourceDeviceId)
    const target = devices.find((device) => device.id === targetDeviceId)
    const preset = CABLE_PRESETS[kind]
    const link: NetworkLink = {
      id: `link-${crypto.randomUUID().slice(0, 8)}`,
      sourceDeviceId,
      sourceInterfaceId: plan.sourceInterfaceId,
      targetDeviceId,
      targetInterfaceId: plan.targetInterfaceId,
      status: 'up',
      kind,
      bandwidthMbps: preset.bandwidthMbps,
    }

    set((state) => ({
      links: [...state.links, link],
      selectedLinkId: link.id,
      selectedDeviceId: null,
      ...commit(state.devices, [...state.links, link]),
    }))

    return {
      ok: true,
      message: `Linked ${source?.hostname} ↔ ${target?.hostname} (${preset.label.toLowerCase()})`,
    }
  },

  removeLink: (linkId) =>
    set((state) => {
      const links = state.links.filter((link) => link.id !== linkId)
      return {
        links,
        selectedLinkId: state.selectedLinkId === linkId ? null : state.selectedLinkId,
        ...commit(state.devices, links),
      }
    }),

  setLinkStatus: (linkId, status) =>
    set((state) => {
      const links = state.links.map((link) =>
        link.id === linkId ? { ...link, status } : link,
      )
      return { links, ...commit(state.devices, links) }
    }),

  setLinkKind: (linkId, kind) =>
    set((state) => {
      const preset = CABLE_PRESETS[kind]
      const links = state.links.map((link) =>
        link.id === linkId ? { ...link, kind, bandwidthMbps: preset.bandwidthMbps } : link,
      )
      return { links, ...commit(state.devices, links) }
    }),

  addStaticRoute: (deviceId, route) =>
    set((state) => {
      const devices = state.devices.map((device) =>
        device.id === deviceId
          ? { ...device, staticRoutes: [...(device.staticRoutes ?? []), route] }
          : device,
      )
      return { devices, ...commit(devices, state.links) }
    }),

  removeStaticRoute: (deviceId, target) =>
    set((state) => {
      const devices = state.devices.map((device) =>
        device.id === deviceId
          ? {
              ...device,
              staticRoutes: (device.staticRoutes ?? []).filter(
                (route) =>
                  !(
                    route.destination === target.destination &&
                    route.mask === target.mask &&
                    (!target.nextHop || route.nextHop === target.nextHop)
                  ),
              ),
            }
          : device,
      )
      return { devices, ...commit(devices, state.links) }
    }),

  setPacketTrace: (packetTrace) => set({ packetTrace }),

  clearPacketTrace: () => set({ packetTrace: null }),

  logPacket: (entry) =>
    set((state) => ({
      packets: [
        { id: crypto.randomUUID(), timestamp: new Date().toISOString(), ...entry },
        ...state.packets,
      ].slice(0, 200),
    })),

  clearPackets: () => set({ packets: [] }),
  setHighlightedDevice: (deviceId) => set({ highlightedDeviceId: deviceId }),
    completeLab: (labId, aiAssisted) => {
    const progress = { ...get().completedLabs }
    const firstCompletion = !progress[labId]?.completed
    const completedAt = new Date().toISOString()
    progress[labId] = {
      completed: true,
      completedAt,
      attempts: (progress[labId]?.attempts ?? 0) + 1,
      hintsUsed: progress[labId]?.hintsUsed ?? 0,
      aiAssisted,
    }
    set({ completedLabs: progress })
    persistLabProgress(progress)

    if (firstCompletion) {
      celebrateLab()
      // Fire an ephemeral, consumed-once completion event for the overlay.
      // This only fires for genuinely *new* completions, not re-renders or nav.
      labCompletionService.fire(labId, completedAt, aiAssisted)
    }
  },
  resetLabProgress: (labId) => {
    const progress = { ...get().completedLabs }
    delete progress[labId]
    set({ completedLabs: progress })
    persistLabProgress(progress)
  },
  }
})

useNetworkStore.subscribe(persistState)

export function useSimulator() {
  return useNetworkStore((state) => state.simulator)
}
