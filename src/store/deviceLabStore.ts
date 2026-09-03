import { create } from 'zustand'
import {
  createEndpoint,
  createRouterDevice,
  createSwitchDevice,
  executeCommand,
  promptFor,
} from '@/devicelab/cli'
import type { CliDevice, EndpointDevice } from '@/devicelab/cli'
import { isSameSubnet, isValidIpv4 } from '@/network/ip'

export type DeviceKind = 'router' | 'switch' | 'server' | 'pc'

export interface ConsoleLine {
  id: string
  text: string
  tone: 'in' | 'out' | 'err' | 'ok'
}

export interface PingResult {
  ok: boolean
  destination: string
  detail: string
}

const STORAGE_KEY = 'netforge-device-lab'

interface Persisted {
  progress: Record<DeviceKind, string[]>
  /** Hardware Bench builds the player has completed, by bench id. */
  benchDone: string[]
  explored: Record<DeviceKind, boolean>
  router: CliDevice
  switch: CliDevice
  server: EndpointDevice
  pc: EndpointDevice
  routerConsole: ConsoleLine[]
  switchConsole: ConsoleLine[]
}

function freshState(): Omit<Persisted, 'progress' | 'benchDone'> {
  return {
    explored: { router: false, switch: false, server: false, pc: false },
    router: createRouterDevice(),
    switch: createSwitchDevice(),
    server: createEndpoint('server', 'SERVER-01'),
    pc: createEndpoint('pc', 'PC-01'),
    routerConsole: [
      { id: 'boot-1', text: 'R1 con0 is available. Press RETURN to get started.', tone: 'out' },
      { id: 'boot-2', text: 'R1>', tone: 'out' },
    ],
    switchConsole: [
      { id: 'boot-s1', text: 'SW1 con0 is available. Press RETURN to get started.', tone: 'out' },
      { id: 'boot-s2', text: 'SW1>', tone: 'out' },
    ],
  }
}

function loadPersisted(): Partial<Persisted> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<Persisted>
  } catch {
    return null
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

interface DeviceLabState {
  progress: Record<DeviceKind, string[]>
  benchDone: string[]
  explored: Record<DeviceKind, boolean>
  router: CliDevice
  switch: CliDevice
  server: EndpointDevice
  pc: EndpointDevice
  routerConsole: ConsoleLine[]
  switchConsole: ConsoleLine[]
  sendCommand: (kind: 'router' | 'switch', input: string) => void
  setEndpoint: (kind: 'server' | 'pc', patch: Partial<EndpointDevice>) => string[]
  pingEndpoint: (kind: 'server' | 'pc', destination: string) => PingResult
  toggleService: (kind: 'server', service: 'web' | 'dns' | 'dhcp') => void
  completeLesson: (kind: DeviceKind, lessonId: string) => void
  completeBench: (benchId: string) => void
  isDone: (kind: DeviceKind, lessonId: string) => boolean
  markExplored: (kind: DeviceKind) => void
  resetDevice: (kind: DeviceKind) => void
  resetAll: () => void
}

function persist(state: DeviceLabState): void {
  const data: Persisted = {
    progress: state.progress,
    benchDone: state.benchDone,
    explored: state.explored,
    router: state.router,
    switch: state.switch,
    server: state.server,
    pc: state.pc,
    routerConsole: state.routerConsole.slice(-200),
    switchConsole: state.switchConsole.slice(-200),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore quota errors
  }
}

const saved = loadPersisted()
const fresh = freshState()

export const useDeviceLabStore = create<DeviceLabState>((set, get) => ({
  progress: saved?.progress ?? { router: [], switch: [], server: [], pc: [] },
  benchDone: saved?.benchDone ?? [],
  explored: saved?.explored ?? { router: false, switch: false, server: false, pc: false },
  router: saved?.router ?? fresh.router,
  switch: saved?.switch ?? fresh.switch,
  server: saved?.server ?? fresh.server,
  pc: saved?.pc ?? fresh.pc,
  routerConsole: saved?.routerConsole ?? fresh.routerConsole,
  switchConsole: saved?.switchConsole ?? fresh.switchConsole,

  sendCommand: (kind, input) => {
    const key = kind
    const device = clone(get()[key]) as CliDevice
    const prompt = device.awaitingPassword ? 'Password:' : promptFor(device)
    const result = executeCommand(device, input)
    const lines: ConsoleLine[] = [{ id: crypto.randomUUID(), text: `${prompt} ${input}`, tone: 'in' }]
    for (const text of result.lines) {
      lines.push({ id: crypto.randomUUID(), text, tone: result.tone })
    }
    const promptAfter = device.awaitingPassword ? 'Password:' : promptFor(device)
    lines.push({ id: crypto.randomUUID(), text: promptAfter, tone: 'out' })
    const consoleKey = kind === 'router' ? 'routerConsole' : 'switchConsole'
    set((state) => ({
      [key]: device,
      [consoleKey]: [...state[consoleKey], ...lines].slice(-300),
    }) as unknown as Partial<DeviceLabState>)
    persist(get())
  },

  setEndpoint: (kind, patch) => {
    // Form fields are always strings. Normalize them:
    //   - trim whitespace
    //   - treat '' OR '0.0.0.0' as "unassigned" for the optional fields
    //     (gateway / DNS). '0.0.0.0' is the placeholder shown in the UI and
    //     is the standard "no address" sentinel in IP networking, so the
    //     user can leave it untouched and Apply still works.
    //   - IP and mask stay strict - a typed '0.0.0.0' there is genuinely
    //     invalid and should still be reported as an error.
    const norm = (v: string | null | undefined) => {
      const trimmed = (v ?? '').trim()
      if (trimmed === '') return null
      if (trimmed === '0.0.0.0') return null
      return trimmed
    }
    const clean: Partial<EndpointDevice> = {
      ip: patch.ip?.trim() === '' ? null : (patch.ip ?? null),
      mask: patch.mask?.trim() === '' ? null : (patch.mask ?? null),
      gateway: norm(patch.gateway),
      dns: norm(patch.dns),
    }
    const errors: string[] = []
    if (clean.ip && !isValidIpv4(clean.ip)) errors.push(`Invalid IPv4 address: ${clean.ip}`)
    if (clean.mask && !isValidIpv4(clean.mask)) errors.push(`Invalid subnet mask: ${clean.mask}`)
    if (clean.gateway && !isValidIpv4(clean.gateway)) errors.push(`Invalid gateway address: ${clean.gateway}`)
    if (clean.dns && !isValidIpv4(clean.dns)) errors.push(`Invalid DNS address: ${clean.dns}`)
    if (clean.gateway && clean.ip && clean.mask && !isSameSubnet(clean.ip, clean.gateway, clean.mask)) {
      errors.push(`Gateway ${clean.gateway} is not on the same subnet as ${clean.ip}/${clean.mask}`)
    }
    if (errors.length > 0) return errors
    set((state) => ({ [kind]: { ...state[kind], ...clean } }) as unknown as Partial<DeviceLabState>)
    persist(get())
    return []
  },

  pingEndpoint: (kind, destination) => {
    const endpoint = get()[kind] as EndpointDevice
    if (!isValidIpv4(destination)) return { ok: false, destination, detail: 'Invalid address.' }
    if (!endpoint.ip || !endpoint.mask) return { ok: false, destination, detail: 'No source IP configured.' }
    if (endpoint.ip === destination) return { ok: true, destination, detail: 'Reply from own interface.' }
    if (!endpoint.gateway) return { ok: false, destination, detail: 'No default gateway configured.' }
    if (destination === endpoint.gateway && isSameSubnet(endpoint.ip, endpoint.gateway, endpoint.mask)) {
      return { ok: true, destination, detail: 'Reply from gateway.' }
    }
    if (isSameSubnet(endpoint.ip, destination, endpoint.mask)) {
      return { ok: false, destination, detail: 'Destination host unreachable (no ARP reply).' }
    }
    return { ok: false, destination, detail: 'Request timed out.' }
  },

  toggleService: (kind, service) => {
    const endpoint = clone(get()[kind]) as EndpointDevice
    endpoint.services[service] = !endpoint.services[service]
    set({ [kind]: endpoint } as unknown as Partial<DeviceLabState>)
    persist(get())
  },

  completeLesson: (kind, lessonId) => {
    set((state) => ({
      progress: {
        ...state.progress,
        [kind]: state.progress[kind].includes(lessonId) ? state.progress[kind] : [...state.progress[kind], lessonId],
      },
    }))
    persist(get())
  },

  completeBench: (benchId) => {
    set((state) => ({
      benchDone: state.benchDone.includes(benchId) ? state.benchDone : [...state.benchDone, benchId],
    }))
    persist(get())
  },

  isDone: (kind, lessonId) => get().progress[kind].includes(lessonId),

  markExplored: (kind) => {
    if (get().explored[kind]) return
    set((state) => ({ explored: { ...state.explored, [kind]: true } }))
    persist(get())
  },

  resetDevice: (kind) => {
    if (kind === 'router') set({ router: createRouterDevice(), routerConsole: freshState().routerConsole })
    else if (kind === 'switch') set({ switch: createSwitchDevice(), switchConsole: freshState().switchConsole })
    else if (kind === 'server') set({ server: createEndpoint('server', 'SERVER-01') })
    else set({ pc: createEndpoint('pc', 'PC-01') })
    persist(get())
  },

  resetAll: () => {
    set({ progress: { router: [], switch: [], server: [], pc: [] }, benchDone: [], ...freshState() })
    persist(get())
  },
}))