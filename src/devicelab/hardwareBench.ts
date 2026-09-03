/**
 * Hardware Bench - guided "plug it in" cabling simulator, rendered as a real
 * 3D scene (three.js / react-three-fiber).
 *
 * A bench teaches the physical layer: what a cable is, which port it goes in,
 * and the order you power things up. The player clicks one port, then another,
 * to run a cable between them. Matching the current step's expected pair
 * advances the build; anything else gets a friendly nudge.
 *
 * Geometry: the board is the X/Z plane, Y is up. Each node sits ON the board
 * (base at y = 0) with a `pos` [x, z] centre and a `size` [w, h, d]. Ports are
 * pinned to a face of that box with `u` (across) and `v` (up) in 0..1, so the
 * 3D renderer and the cable layer derive every position from the same numbers.
 */

export type PortKind = 'power' | 'wan' | 'lan' | 'nic' | 'uplink'
export type PortFace = 'front' | 'back' | 'left' | 'right' | 'top'
export type NodeIcon = 'outlet' | 'modem' | 'router' | 'switch' | 'laptop' | 'desktop'

export interface BenchPort {
  id: string
  label: string
  kind: PortKind
  face: PortFace
  /** Position across the face, 0..1 (default 0.5). */
  u?: number
  /** Height up the face, 0 = board, 1 = top of the box (default 0.5). */
  v?: number
}

export interface BenchNode {
  id: string
  label: string
  sub?: string
  icon: NodeIcon
  /** Centre of the box on the board: [x, z]. */
  pos: [number, number]
  /** Box dimensions: [width, height, depth]. */
  size: [number, number, number]
  /** Devices that need mains power before their link lights can come up. */
  needsPower?: boolean
  ports: BenchPort[]
}

export interface BenchStep {
  id: string
  title: string
  instruction: string
  why: string
  /** 'connect' = run a cable between two ports; 'power' = press a node's power button. */
  type: 'connect' | 'power'
  /** For 'connect': the two port ids (order-independent). */
  from?: string
  to?: string
  /** For 'power': the node id to switch on. */
  target?: string
  /** Colour hint for the cable that gets drawn once this step is done. */
  cable?: 'power' | 'data'
}

export interface Bench {
  id: string
  title: string
  subtitle: string
  blurb: string
  /** Shown on the completion screen. */
  outro: string
  nodes: BenchNode[]
  steps: BenchStep[]
}

export const BENCHES: Bench[] = [
  {
    id: 'home-internet',
    title: 'Home Internet Setup',
    subtitle: 'Router · modem · laptop',
    blurb: 'Cable a home network from scratch: power the router, bring up the internet feed, then plug in a laptop.',
    outro: 'That is exactly how a home network comes online: power first, then the internet uplink (WAN), then your devices on the LAN ports.',
    nodes: [
      {
        id: 'modem',
        label: 'ISP Modem',
        sub: 'Internet feed',
        icon: 'modem',
        pos: [0, -2.7],
        size: [2, 0.45, 1.1],
        ports: [{ id: 'modem-eth', label: 'Ethernet out', kind: 'wan', face: 'front', u: 0.5, v: 0.5 }],
      },
      {
        id: 'outlet',
        label: 'Wall Outlet',
        sub: 'Mains power',
        icon: 'outlet',
        pos: [-3.9, 0.2],
        size: [0.4, 1.3, 0.95],
        ports: [{ id: 'outlet-socket', label: 'Socket', kind: 'power', face: 'right', u: 0.5, v: 0.5 }],
      },
      {
        id: 'router',
        label: 'Wi-Fi Router',
        sub: 'Home gateway',
        icon: 'router',
        pos: [0, 0.4],
        size: [2.4, 0.5, 1.5],
        needsPower: true,
        ports: [
          { id: 'router-power', label: 'DC power in', kind: 'power', face: 'front', u: 0.22, v: 0.4 },
          { id: 'router-wan', label: 'WAN', kind: 'wan', face: 'top', u: 0.5, v: 0.2 },
          { id: 'router-lan1', label: 'LAN 1', kind: 'lan', face: 'right', u: 0.7, v: 0.4 },
        ],
      },
      {
        id: 'laptop',
        label: 'Laptop',
        sub: 'Your device',
        icon: 'laptop',
        pos: [3.7, 0.4],
        size: [1.7, 0.12, 1.2],
        ports: [{ id: 'laptop-nic', label: 'Ethernet', kind: 'nic', face: 'front', u: 0.22, v: 0.6 }],
      },
    ],
    steps: [
      {
        id: 's1',
        title: 'Plug in the router',
        instruction: "Run the power cable from the router's DC power in to the wall outlet.",
        why: 'Nothing else works until the router has power. Every network device needs mains power before its ports or radios can turn on.',
        type: 'connect',
        from: 'router-power',
        to: 'outlet-socket',
        cable: 'power',
      },
      {
        id: 's2',
        title: 'Power on the router',
        instruction: "Press the router's power button and wait for it to boot.",
        why: 'Booting loads the router\'s operating system. Only then can it hand out addresses (DHCP) and route traffic.',
        type: 'power',
        target: 'router',
      },
      {
        id: 's3',
        title: 'Connect the internet feed',
        instruction: "Run an Ethernet cable from the modem's Ethernet out to the router's WAN port.",
        why: 'The WAN port is the one link that faces your ISP. It is kept separate from the LAN ports so the router knows which side is "the internet".',
        type: 'connect',
        from: 'modem-eth',
        to: 'router-wan',
        cable: 'data',
      },
      {
        id: 's4',
        title: 'Plug in the laptop',
        instruction: "Run an Ethernet cable from the laptop's Ethernet port to LAN 1 on the router.",
        why: 'LAN ports are the home side. The router bridges them together and shares the single internet connection from the WAN port.',
        type: 'connect',
        from: 'laptop-nic',
        to: 'router-lan1',
        cable: 'data',
      },
    ],
  },
  {
    id: 'office-desk',
    title: 'Office Desk Wiring',
    subtitle: 'Switch · router · desktop',
    blurb: 'Wire a small office: power a switch, uplink it to the router, then hang a desktop PC off a switch port.',
    outro: 'A switch multiplies one router LAN port into many. Power it, uplink it once, and every desktop you plug in joins the same network.',
    nodes: [
      {
        id: 'router',
        label: 'Office Router',
        sub: 'Internet gateway',
        icon: 'router',
        pos: [0, -2.7],
        size: [2, 0.45, 1.1],
        ports: [{ id: 'router-lan', label: 'LAN port', kind: 'lan', face: 'front', u: 0.5, v: 0.5 }],
      },
      {
        id: 'outlet',
        label: 'Wall Outlet',
        sub: 'Mains power',
        icon: 'outlet',
        pos: [-3.9, 0.2],
        size: [0.4, 1.3, 0.95],
        ports: [{ id: 'outlet-socket', label: 'Socket', kind: 'power', face: 'right', u: 0.5, v: 0.5 }],
      },
      {
        id: 'switch',
        label: '8-Port Switch',
        sub: 'Desk network',
        icon: 'switch',
        pos: [0, 0.4],
        size: [2.6, 0.4, 1.4],
        needsPower: true,
        ports: [
          { id: 'switch-power', label: 'Power in', kind: 'power', face: 'front', u: 0.22, v: 0.4 },
          { id: 'switch-uplink', label: 'Uplink', kind: 'uplink', face: 'top', u: 0.5, v: 0.2 },
          { id: 'switch-p3', label: 'Port 3', kind: 'lan', face: 'right', u: 0.7, v: 0.4 },
        ],
      },
      {
        id: 'desktop',
        label: 'Desktop PC',
        sub: 'Workstation',
        icon: 'desktop',
        pos: [3.8, 0.2],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'desktop-nic', label: 'Ethernet', kind: 'nic', face: 'front', u: 0.3, v: 0.45 }],
      },
    ],
    steps: [
      {
        id: 's1',
        title: 'Power the switch',
        instruction: "Run the power cable from the switch's power in to the wall outlet.",
        why: 'A switch is an active device - it needs power to move frames between ports. An unpowered switch is just dead plastic.',
        type: 'connect',
        from: 'switch-power',
        to: 'outlet-socket',
        cable: 'power',
      },
      {
        id: 's2',
        title: 'Power on the switch',
        instruction: "Press the switch's power button.",
        why: 'On boot the switch starts learning which device is on which port, so it can send each frame only where it needs to go.',
        type: 'power',
        target: 'switch',
      },
      {
        id: 's3',
        title: 'Uplink to the router',
        instruction: "Run an Ethernet cable from the switch's uplink port to the LAN port on the router.",
        why: "The uplink is the switch's single connection to the rest of the network. Everything plugged into the switch shares this one path to the router.",
        type: 'connect',
        from: 'switch-uplink',
        to: 'router-lan',
        cable: 'data',
      },
      {
        id: 's4',
        title: 'Connect the desktop',
        instruction: "Run an Ethernet cable from the desktop's Ethernet port to Port 3 on the switch.",
        why: 'Any free numbered port works the same way. The switch bridges Port 3 to the uplink, so the desktop reaches the router and the internet.',
        type: 'connect',
        from: 'desktop-nic',
        to: 'switch-p3',
        cable: 'data',
      },
    ],
  },
]

export function findBench(id: string): Bench | undefined {
  return BENCHES.find((b) => b.id === id)
}

/** World-space centre of a port, derived from its node box + face + u/v. */
export function portWorld(node: BenchNode, port: BenchPort): [number, number, number] {
  const [cx, cz] = node.pos
  const [w, h, d] = node.size
  const u = port.u ?? 0.5
  const v = port.v ?? 0.5
  const y = v * h
  switch (port.face) {
    case 'front':
      return [cx + (u - 0.5) * w, y, cz + d / 2]
    case 'back':
      return [cx + (u - 0.5) * w, y, cz - d / 2]
    case 'left':
      return [cx - w / 2, y, cz + (u - 0.5) * d]
    case 'right':
      return [cx + w / 2, y, cz + (u - 0.5) * d]
    case 'top':
      return [cx + (u - 0.5) * w, h, cz + (v - 0.5) * d]
  }
}

/** Outward normal of a port's face - used to stand the plug off the box a touch. */
export function faceNormal(face: PortFace): [number, number, number] {
  switch (face) {
    case 'front':
      return [0, 0, 1]
    case 'back':
      return [0, 0, -1]
    case 'left':
      return [-1, 0, 0]
    case 'right':
      return [1, 0, 0]
    case 'top':
      return [0, 1, 0]
  }
}
