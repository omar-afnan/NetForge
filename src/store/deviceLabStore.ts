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
  router: CliDevice
  switch: CliDevice
  server: EndpointDevice
  pc: EndpointDevice
  routerConsole: ConsoleLine[]
  switchConsole: ConsoleLine[]
}

function freshState(): Omit<Persisted, 'progress'> {
  return {
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
  isDone: (kind: DeviceKind, lessonId: string) => boolean
  resetDevice: (kind: DeviceKind) => void
  resetAll: () => void
}

function persist(state: DeviceLabState): void {
  const data: Persisted = {
    progress: state.progress,
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
    const errors: string[] = []
    if (patch.ip && !isValidIpv4(patch.ip)) errors.push(`Invalid IPv4 address: ${patch.ip}`)
    if (patch.mask && !isValidIpv4(patch.mask)) errors.push(`Invalid subnet mask: ${patch.mask}`)
    if (patch.gateway && !isValidIpv4(patch.gateway)) errors.push(`Invalid gateway address: ${patch.gateway}`)
    if (patch.dns && !isValidIpv4(patch.dns)) errors.push(`Invalid DNS address: ${patch.dns}`)
    if (patch.gateway && patch.ip && patch.mask && !isSameSubnet(patch.ip, patch.gateway, patch.mask)) {
      errors.push(`Gateway ${patch.gateway} is not on the same subnet as ${patch.ip}/${patch.mask}`)
    }
    if (errors.length > 0) return errors
    set((state) => ({ [kind]: { ...state[kind], ...patch } }) as unknown as Partial<DeviceLabState>)
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

  isDone: (kind, lessonId) => get().progress[kind].includes(lessonId),

  resetDevice: (kind) => {
    if (kind === 'router') set({ router: createRouterDevice(), routerConsole: freshState().routerConsole })
    else if (kind === 'switch') set({ switch: createSwitchDevice(), switchConsole: freshState().switchConsole })
    else if (kind === 'server') set({ server: createEndpoint('server', 'SERVER-01') })
    else set({ pc: createEndpoint('pc', 'PC-01') })
    persist(get())
  },

  resetAll: () => {
    set({ progress: { router: [], switch: [], server: [], pc: [] }, ...freshState() })
    persist(get())
  },
}))