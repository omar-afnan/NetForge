/**
 * Device Lab — a small, self-contained Cisco-style IOS CLI engine used by the
 * guided configuration lessons. It models the subset of IOS that NetForge
 * teaches: CLI modes, hostname, passwords, interfaces, IP addressing,
 * static/default routes, VLANs, switchports and running/startup config.
 *
 * It is intentionally separate from the troubleshooting simulator
 * (networkStore): Device Lab lessons run on their own sandboxed devices so
 * they can never break or be broken by Lab Library state. Shared IP math is
 * reused from network/ip.ts.
 */
import { isValidIpv4, maskToPrefix, prefixToMask } from '@/network/ip'

export type CliMode = 'user' | 'privileged' | 'config' | 'config-if' | 'config-line' | 'config-vlan'

export interface CliInterface {
  name: string
  short: string
  status: 'up' | 'down' | 'admin-down'
  ip: string | null
  mask: string | null
  /** Switch-specific port config. */
  switchportMode?: 'access' | 'trunk'
  accessVlan?: number
}

export interface StaticRoute {
  destination: string
  mask: string
  nextHop: string
}

export interface CliDevice {
  kind: 'router' | 'switch'
  hostname: string
  enablePassword: string | null
  enableSecret: string | null
  consolePassword: string | null
  consoleLogin: boolean
  vtyPassword: string | null
  vtyLogin: boolean
  passwordEncryption: boolean
  domainName: string | null
  interfaces: CliInterface[]
  routes: StaticRoute[]
  defaultGateway: string | null
  vlans: { id: number; name: string }[]
  startupSaved: boolean
  /** Session-only CLI runtime (not part of the config model). */
  mode: CliMode
  currentInterface: string | null
  currentLine: 'console' | 'vty' | null
  currentVlan: number | null
  awaitingPassword: boolean
  badSecrets: number
  /** Every command line entered this session — lessons validate against it. */
  history: string[]
}

export interface EndpointDevice {
  kind: 'server' | 'pc'
  hostname: string
  ip: string | null
  mask: string | null
  gateway: string | null
  dns: string | null
  services: { web: boolean; dns: boolean; dhcp: boolean }
  /** Simulated NIC link state for diagnostics lessons. */
  linked: boolean
}

const HOSTNAME_RE = /^[a-z0-9-]{1,32}$/i

export function createRouterDevice(): CliDevice {
  return {
    kind: 'router',
    hostname: 'R1',
    enablePassword: null,
    enableSecret: null,
    consolePassword: null,
    consoleLogin: false,
    vtyPassword: null,
    vtyLogin: false,
    passwordEncryption: false,
    domainName: null,
    interfaces: [
      { name: 'GigabitEthernet0/0', short: 'G0/0', status: 'admin-down', ip: null, mask: null },
      { name: 'GigabitEthernet0/1', short: 'G0/1', status: 'admin-down', ip: null, mask: null },
    ],
    routes: [],
    defaultGateway: null,
    vlans: [],
    startupSaved: false,
    mode: 'user',
    currentInterface: null,
    currentLine: null,
    currentVlan: null,
    awaitingPassword: false,
    badSecrets: 0,
    history: [],
  }
}

export function createSwitchDevice(): CliDevice {
  const device = createRouterDevice()
  device.kind = 'switch'
  device.hostname = 'SW1'
  device.interfaces = [
    { name: 'FastEthernet0/1', short: 'Fa0/1', status: 'up', ip: null, mask: null, switchportMode: 'access', accessVlan: 1 },
    { name: 'FastEthernet0/2', short: 'Fa0/2', status: 'admin-down', ip: null, mask: null, switchportMode: 'access', accessVlan: 1 },
    { name: 'GigabitEthernet0/1', short: 'Gi0/1', status: 'up', ip: null, mask: null, switchportMode: 'access', accessVlan: 1 },
  ]
  return device
}

export function createEndpoint(kind: 'server' | 'pc', hostname: string): EndpointDevice {
  return { kind, hostname, ip: null, mask: null, gateway: null, dns: null, services: { web: false, dns: false, dhcp: false }, linked: true }
}

/** Prompt string for the current mode, e.g. `R1(config-if)#`. */
export function promptFor(device: CliDevice): string {
  const suffix =
    device.mode === 'user' ? '>'
    : device.mode === 'privileged' ? '#'
    : device.mode === 'config' ? '(config)#'
    : device.mode === 'config-if' ? '(config-if)#'
    : device.mode === 'config-line' ? '(config-line)#'
    : '(config-vlan)#'
  return `${device.hostname}${suffix}`
}

function interfaceByName(device: CliDevice, ref: string): CliInterface | undefined {
  const q = ref.toLowerCase().replace(/\s+/g, '')
  return device.interfaces.find((i) => {
    const n = i.name.toLowerCase()
    return n === q || i.short.toLowerCase() === q || n.startsWith(q)
  })
}

function brief(device: CliDevice): string[] {
  const rows = device.interfaces.map((i) => {
    const status = i.status === 'up' ? 'up' : i.status === 'down' ? 'down' : 'administratively down'
    const proto = i.status === 'up' && i.ip ? 'up' : 'down'
    const addr = i.ip ?? 'unassigned'
    return `${i.name.padEnd(22)}${addr.padEnd(16)}${status.padEnd(24)}${proto}`
  })
  return ['Interface                  IP-Address      Status                   Protocol', ...rows]
}

function runningConfig(device: CliDevice): string[] {
  const lines = ['Building configuration...', '', 'Current configuration', '!']
  lines.push(`hostname ${device.hostname}`, '!')
  if (device.enablePassword) lines.push(device.passwordEncryption ? 'enable password 7 08224F40081B' : `enable password ${device.enablePassword}`)
  if (device.enableSecret) lines.push('enable secret 5 $1$mERr$hx5rVt7rPNoS4wqbXKX7m0')
  if (device.passwordEncryption) lines.push('service password-encryption')
  if (device.domainName) lines.push(`ip domain-name ${device.domainName}`)
  lines.push('!')
  if (device.consolePassword) lines.push('line console 0', ` password ${device.passwordEncryption ? '7 08224F40081B' : device.consolePassword}`, device.consoleLogin ? ' login' : '')
  if (device.vtyPassword) lines.push('line vty 0 4', ` password ${device.passwordEncryption ? '7 08224F40081B' : device.vtyPassword}`, device.vtyLogin ? ' login' : '')
  lines.push('!')
  for (const i of device.interfaces) {
    lines.push(`interface ${i.name}`)
    if (i.ip && i.mask) lines.push(` ip address ${i.ip} ${i.mask}`)
    if (i.status === 'admin-down') lines.push(' shutdown')
    if (i.switchportMode === 'trunk') lines.push(' switchport mode trunk')
    if (i.switchportMode === 'access' && i.accessVlan && i.accessVlan !== 1) lines.push(` switchport access vlan ${i.accessVlan}`)
    lines.push('!')
  }
  if (device.defaultGateway) lines.push(`ip default-gateway ${device.defaultGateway}`, '!')
  for (const r of device.routes) lines.push(`ip route ${r.destination} ${r.mask} ${r.nextHop}`, '!')
  if (device.kind === 'switch') {
    lines.push('vlan 1', ' name default', '!')
    for (const v of device.vlans) lines.push(`vlan ${v.id}`, ` name ${v.name}`, '!')
  }
  lines.push('end')
  return lines
}

function showRoutes(device: CliDevice): string[] {
  const lines = ['Codes: C - connected, S - static', 'Gateway of last resort is not set', '']
  for (const i of device.interfaces) {
    if (i.ip && i.mask && i.status === 'up') lines.push(`C    ${i.ip.split('.').slice(0, 3).join('.')}.0/${maskToPrefix(i.mask)} is directly connected, ${i.name}`)
  }
  for (const r of device.routes) {
    if (r.destination === '0.0.0.0' && r.mask === '0.0.0.0') lines.push(`S*   0.0.0.0/0 [1/0] via ${r.nextHop}`)
    else lines.push(`S    ${r.destination}/${maskToPrefix(r.mask)} [1/0] via ${r.nextHop}`)
  }
  return lines
}

/**
 * Execute one CLI line against the device state (mutates the state object —
 * callers pass a draft). Returns output lines.
 */
export function executeCommand(device: CliDevice, raw: string): { lines: string[]; tone: 'out' | 'err' | 'ok' } {
  const input = raw.trim()
  device.history.push(input)
  if (!input) return { lines: [], tone: 'out' }

  // Enable-password prompt flow.
  if (device.awaitingPassword) {
    device.awaitingPassword = false
    const expected = device.enableSecret ?? device.enablePassword
    if (expected && input === expected) {
      device.mode = 'privileged'
      return { lines: [], tone: 'ok' }
    }
    device.badSecrets += 1
    if (device.badSecrets >= 3) {
      device.badSecrets = 0
      return { lines: ['% Bad secrets'], tone: 'err' }
    }
    device.awaitingPassword = true
    return { lines: ['Password:'], tone: 'err' }
  }

  // `do <cmd>` runs exec commands from config modes.
  const lower = input.toLowerCase()
  const effective = lower.startsWith('do ') && device.mode !== 'user' && device.mode !== 'privileged' ? lower.slice(3) : lower

  if (effective === 'enable' || effective === 'en') {
    if (device.mode !== 'user') return { lines: [], tone: 'ok' }
    if (device.enableSecret || device.enablePassword) {
      device.awaitingPassword = true
      return { lines: ['Password:'], tone: 'out' }
    }
    device.mode = 'privileged'
    return { lines: [], tone: 'ok' }
  }

  if (effective === 'disable') { device.mode = 'user'; return { lines: [], tone: 'ok' } }

  if (effective === 'configure terminal' || effective === 'conf t') {
    if (device.mode !== 'privileged') return { lines: ['% Invalid input detected'], tone: 'err' }
    device.mode = 'config'
    return { lines: ['Enter configuration commands, one per line.  End with CNTL/Z.'], tone: 'out' }
  }

  if (effective === 'end') {
    device.mode = 'privileged'
    device.currentInterface = null
    device.currentLine = null
    device.currentVlan = null
    return { lines: [], tone: 'ok' }
  }

  if (effective === 'exit') {
    if (device.mode === 'config-if' || device.mode === 'config-line' || device.mode === 'config-vlan') {
      device.mode = 'config'
      device.currentInterface = null
      device.currentLine = null
      device.currentVlan = null
    } else if (device.mode === 'config') {
      device.mode = 'privileged'
    }
    return { lines: [], tone: 'ok' }
  }

  if (effective === 'show running-config' || effective === 'show run') return { lines: runningConfig(device), tone: 'out' }
  if (effective === 'show ip interface brief' || effective === 'show ip int brief') return { lines: brief(device), tone: 'out' }
  if (effective === 'show ip route') return { lines: showRoutes(device), tone: 'out' }

  if (effective === 'show vlan brief') {
    const rows = [
      'VLAN Name                             Status    Ports',
      '---- -------------------------------- --------- -------------------------------',
      '1    default                          active    ' + device.interfaces.filter((i) => i.name.startsWith('Fast') && (i.accessVlan ?? 1) === 1).map((i) => i.name).join(', '),
    ]
    for (const v of device.vlans) {
      const ports = device.interfaces.filter((i) => i.name.startsWith('Fast') && i.accessVlan === v.id).map((i) => i.name).join(', ')
      rows.push(`${String(v.id).padEnd(4)} ${v.name.padEnd(32)} active    ${ports}`)
    }
    return { lines: rows, tone: 'out' }
  }

  if (effective === 'show interfaces trunk') {
    const trunks = device.interfaces.filter((i) => i.switchportMode === 'trunk')
    if (trunks.length === 0) return { lines: [], tone: 'out' }
    return {
      lines: [
        'Port        Mode         Encapsulation  Status        Native vlan',
        ...trunks.map((t) => `${t.name.padEnd(12)}on           802.1q         trunking      1`),
      ],
      tone: 'out',
    }
  }

  if (effective.startsWith('ping ')) {
    const dest = effective.split(/\s+/)[1]
    if (!isValidIpv4(dest)) return { lines: [`% Unrecognized host or address: ${dest}`], tone: 'err' }
    const own = device.interfaces.some((i) => i.ip === dest)
    const gw = device.defaultGateway === dest
    const viaRoute = device.routes.some((r) => r.nextHop === dest)
    if (own || gw || viaRoute) {
      return { lines: ['Type escape sequence to abort.', `Sending 5, 100-byte ICMP Echos to ${dest}, timeout is 2 seconds:`, '!!!!!', 'Success rate is 100 percent (5/5)'], tone: 'ok' }
    }
    return { lines: ['Type escape sequence to abort.', `Sending 5, 100-byte ICMP Echos to ${dest}, timeout is 2 seconds:`, '.....', 'Success rate is 0 percent (0/5)'], tone: 'err' }
  }

  return executeConfigCommand(device, input, effective)
}

/** Global + interface + line + VLAN configuration commands. */
function executeConfigCommand(device: CliDevice, input: string, effective: string): { lines: string[]; tone: 'out' | 'err' | 'ok' } {
  const invalid = { lines: ['% Invalid input detected'], tone: 'err' as const }
  const inConfig = device.mode === 'config' || device.mode === 'config-if' || device.mode === 'config-line' || device.mode === 'config-vlan'
  if (!inConfig) return invalid

  if (effective.startsWith('hostname ')) {
    if (device.mode !== 'config') return invalid
    const name = input.slice(9).trim()
    if (!HOSTNAME_RE.test(name)) return { lines: ['% Invalid hostname'], tone: 'err' }
    device.hostname = name
    return { lines: [], tone: 'ok' }
  }
  if (effective.startsWith('enable secret ')) { device.enableSecret = input.slice(14).trim(); return { lines: [], tone: 'ok' } }
  if (effective.startsWith('enable password ')) { device.enablePassword = input.slice(16).trim(); return { lines: [], tone: 'ok' } }
  if (effective === 'service password-encryption') { device.passwordEncryption = true; return { lines: [], tone: 'ok' } }
  if (effective.startsWith('ip domain-name ')) { device.domainName = input.slice(15).trim(); return { lines: [], tone: 'ok' } }

  if (effective.startsWith('ip route ') || effective.startsWith('no ip route ')) {
    const removing = effective.startsWith('no ')
    const parts = effective.split(/\s+/)
    const dest = parts[removing ? 3 : 2]
    const maskOrPrefix = parts[removing ? 4 : 3]
    const nextHop = parts[removing ? 5 : 4]
    if (!dest || !isValidIpv4(dest)) return invalid
    let mask = maskOrPrefix
    if (/^\d{1,2}$/.test(mask)) mask = prefixToMask(Number(mask))
    if (!mask || !isValidIpv4(mask)) return invalid
    if (removing) {
      device.routes = device.routes.filter((r) => !(r.destination === dest && r.mask === mask))
      return { lines: [], tone: 'ok' }
    }
    if (!nextHop || !isValidIpv4(nextHop)) return invalid
    device.routes = device.routes.filter((r) => !(r.destination === dest && r.mask === mask))
    device.routes.push({ destination: dest, mask, nextHop })
    return { lines: [], tone: 'ok' }
  }

  if (effective.startsWith('ip default-gateway ')) {
    const gw = effective.split(/\s+/)[1]
    if (!isValidIpv4(gw)) return invalid
    device.defaultGateway = gw
    return { lines: [], tone: 'ok' }
  }

  if (effective.startsWith('line ')) {
    const target = effective.split(/\s+/)[1]
    if (target === 'console' || target === 'con' || target === 'console0') {
      device.mode = 'config-line'
      device.currentLine = 'console'
      return { lines: [], tone: 'ok' }
    }
    if (target === 'vty') {
      device.mode = 'config-line'
      device.currentLine = 'vty'
      return { lines: [], tone: 'ok' }
    }
    return invalid
  }

  if (effective.startsWith('interface ')) {
    const ref = input.slice(10).trim()
    if (/^vlan\s*1$/i.test(ref)) {
      device.mode = 'config-if'
      device.currentInterface = 'Vlan1'
      if (!device.interfaces.some((i) => i.name === 'Vlan1')) {
        device.interfaces.push({ name: 'Vlan1', short: 'Vlan1', status: 'admin-down', ip: null, mask: null })
      }
      return { lines: [], tone: 'ok' }
    }
    const iface = interfaceByName(device, ref)
    if (!iface) return { lines: ['% Invalid interface type and number'], tone: 'err' }
    device.mode = 'config-if'
    device.currentInterface = iface.name
    return { lines: [], tone: 'ok' }
  }

  if (device.kind === 'switch' && effective.startsWith('vlan ')) {
    const id = Number(effective.split(/\s+/)[1])
    if (!Number.isInteger(id) || id < 1 || id > 4094) return { lines: ['% Invalid VLAN id'], tone: 'err' }
    device.mode = 'config-vlan'
    device.currentVlan = id
    if (!device.vlans.some((v) => v.id === id)) device.vlans.push({ id, name: `VLAN${String(id).padStart(4, '0')}` })
    return { lines: [], tone: 'ok' }
  }

  return executeSubConfigCommand(device, input, effective, invalid)
}

/** Interface / line / VLAN sub-modes and privileged save commands. */
function executeSubConfigCommand(device: CliDevice, input: string, effective: string, invalid: { lines: string[]; tone: 'err' }): { lines: string[]; tone: 'out' | 'err' | 'ok' } {
  if (device.mode === 'config-if') {
    const iface = device.interfaces.find((i) => i.name === device.currentInterface)
    if (!iface) return invalid
    if (effective.startsWith('ip address ')) {
      const [, , ip, maskOrPrefix] = effective.split(/\s+/)
      if (!isValidIpv4(ip)) return invalid
      let mask = maskOrPrefix
      if (/^\d{1,2}$/.test(mask)) mask = prefixToMask(Number(mask))
      if (!mask || !isValidIpv4(mask)) return invalid
      iface.ip = ip
      iface.mask = mask
      return { lines: [], tone: 'ok' }
    }
    if (effective === 'no shutdown' || effective === 'no shut') {
      iface.status = 'up'
      return { lines: ['', `%LINK-5-CHANGED: Interface ${iface.name}, changed state to up`, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${iface.name}, changed state to up`], tone: 'ok' }
    }
    if (effective === 'shutdown') {
      iface.status = 'admin-down'
      return { lines: [`%LINK-5-CHANGED: Interface ${iface.name}, changed state to administratively down`], tone: 'out' }
    }
    if (effective === 'no ip address') { iface.ip = null; iface.mask = null; return { lines: [], tone: 'ok' } }
    if (effective === 'switchport mode access') { iface.switchportMode = 'access'; return { lines: [], tone: 'ok' } }
    if (effective === 'switchport mode trunk') {
      iface.switchportMode = 'trunk'
      return { lines: [`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${iface.name}, changed state to up`], tone: 'ok' }
    }
    if (effective.startsWith('switchport access vlan ')) {
      const id = Number(effective.split(/\s+/)[3])
      if (!Number.isInteger(id)) return invalid
      if (id !== 1 && !device.vlans.some((v) => v.id === id)) return { lines: ['% Access VLAN does not exist. Please create it first.'], tone: 'err' }
      iface.switchportMode = 'access'
      iface.accessVlan = id
      return { lines: [], tone: 'ok' }
    }
    return invalid
  }

  if (device.mode === 'config-line') {
    if (effective.startsWith('password ')) {
      const pw = input.slice(9).trim()
      if (device.currentLine === 'console') device.consolePassword = pw
      else device.vtyPassword = pw
      return { lines: [], tone: 'ok' }
    }
    if (effective === 'login') {
      if (device.currentLine === 'console') device.consoleLogin = true
      else device.vtyLogin = true
      return { lines: [], tone: 'ok' }
    }
    return invalid
  }

  if (device.mode === 'config-vlan') {
    if (effective.startsWith('name ')) {
      const name = input.slice(5).trim().slice(0, 32)
      const vlan = device.vlans.find((v) => v.id === device.currentVlan)
      if (vlan) vlan.name = name
      return { lines: [], tone: 'ok' }
    }
    return invalid
  }

  if (device.mode === 'privileged') {
    if (effective === 'copy running-config startup-config' || effective === 'copy run start' || effective === 'write memory' || effective === 'wr' || effective === 'write') {
      device.startupSaved = true
      return { lines: ['Building configuration...', '[OK]'], tone: 'ok' }
    }
  }

  return invalid
}