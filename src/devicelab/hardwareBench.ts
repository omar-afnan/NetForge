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

export type PortKind = 'power' | 'wan' | 'lan' | 'nic' | 'uplink' | 'radio'
export type PortFace = 'front' | 'back' | 'left' | 'right' | 'top'
export type NodeIcon =
  | 'outlet'
  | 'modem'
  | 'router'
  | 'switch'
  | 'laptop'
  | 'desktop'
  | 'pc'
  | 'accesspoint'
  | 'printer'
  | 'phone'

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
  /**
   * 'connect'    = run a cable between two ports.
   * 'power'      = press a node's power button.
   * 'fix-remove' = click an existing (wrongly-placed) cable to unplug it.
   */
  type: 'connect' | 'power' | 'fix-remove'
  /** For 'connect' and 'fix-remove': the two port ids (order-independent). */
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
  /** Rough difficulty order, 1 = easiest. Shown as a small pill. */
  level?: number
  /** Troubleshooting benches: the reported fault, shown above the steps. */
  symptom?: string
  /** Cables already present when the bench loads (troubleshooting scenarios). */
  initialCables?: { from: string; to: string; cable?: 'power' | 'data' }[]
  /** Node ids already powered on when the bench loads. */
  initialPowered?: string[]
  nodes: BenchNode[]
  steps: BenchStep[]
  /**
   * Free-build mode. When set, there is no ordered step list - the learner
   * cables and powers devices in any order and a checklist is verified on
   * demand. `steps` should be [] for these benches.
   */
  goal?: BenchGoal
}

export type GoalCheck =
  | { kind: 'powered'; node: string; label: string }
  | { kind: 'cabled'; from: string; to: string; label: string }
  /** `node` has at least one cable whose FAR end is a port of one of `toKinds`. */
  | { kind: 'uplink'; node: string; toKinds: PortKind[]; label: string }
  /** every node whose icon is in `icons` satisfies an `uplink` to `toKinds`. */
  | { kind: 'all-uplink'; icons: NodeIcon[]; toKinds: PortKind[]; label: string }

export interface BenchGoal {
  brief: string
  checklist: GoalCheck[]
}

/** Evaluate a free-build bench's checklist against the current cable + power state. */
export function evalGoal(
  bench: Bench,
  cables: { from: string; to: string }[],
  powered: Set<string>,
): { label: string; ok: boolean }[] {
  const portToNode = new Map<string, BenchNode>()
  const portKind = new Map<string, PortKind>()
  for (const n of bench.nodes) {
    for (const p of n.ports) {
      portToNode.set(p.id, n)
      portKind.set(p.id, p.kind)
    }
  }
  const isPowered = (nodeId: string) => {
    const n = bench.nodes.find((x) => x.id === nodeId)
    return !n?.needsPower || powered.has(nodeId)
  }
  const pairCabled = (a: string, b: string) =>
    cables.some((c) => (c.from === a && c.to === b) || (c.from === b && c.to === a))
  const nodeUplinks = (nodeId: string, toKinds: PortKind[]) =>
    cables.some((c) => {
      const fromNode = portToNode.get(c.from)?.id
      const toNode = portToNode.get(c.to)?.id
      if (fromNode === nodeId && toKinds.includes(portKind.get(c.to) ?? ('' as PortKind))) return true
      if (toNode === nodeId && toKinds.includes(portKind.get(c.from) ?? ('' as PortKind))) return true
      return false
    })

  return bench.goal!.checklist.map((chk) => {
    switch (chk.kind) {
      case 'powered':
        return { label: chk.label, ok: isPowered(chk.node) }
      case 'cabled':
        return { label: chk.label, ok: pairCabled(chk.from, chk.to) }
      case 'uplink':
        return { label: chk.label, ok: nodeUplinks(chk.node, chk.toKinds) }
      case 'all-uplink': {
        const targets = bench.nodes.filter((n) => chk.icons.includes(n.icon))
        return {
          label: chk.label,
          ok: targets.length > 0 && targets.every((n) => nodeUplinks(n.id, chk.toKinds)),
        }
      }
    }
  })
}

export const BENCHES: Bench[] = [
  {
    id: 'home-internet',
    title: 'Home Internet Setup',
    subtitle: 'Router · modem · laptop',
    blurb: 'Cable a home network from scratch: power the router, bring up the internet feed, then plug in a laptop.',
    outro: 'That is exactly how a home network comes online: power first, then the internet uplink (WAN), then your devices on the LAN ports.',
    level: 1,
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
    level: 2,
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

  // ── LAB 3 ────────────────────────────────────────────────────────────────
  {
    id: 'small-office',
    title: 'Small Office Network',
    subtitle: 'Modem · router · switch · 2 PCs · laptop · printer',
    blurb: 'The router and internet feed are already up. Add the switch and fan out to every desk: two PCs, a laptop and a printer.',
    outro: 'One router uplink, one switch, many devices. Every end device on the switch shares that single path to the router and the internet - that is the shape of almost every small LAN.',
    level: 3,
    initialPowered: ['router'],
    initialCables: [
      { from: 'router-power', to: 'outlet-socket-b', cable: 'power' },
      { from: 'modem-eth', to: 'router-wan', cable: 'data' },
    ],
    nodes: [
      {
        id: 'outlet',
        label: 'Wall Outlet',
        sub: 'Mains power',
        icon: 'outlet',
        pos: [-5.2, 0.4],
        size: [0.4, 1.3, 0.95],
        ports: [
          { id: 'outlet-socket-a', label: 'Socket A', kind: 'power', face: 'right', u: 0.32, v: 0.5 },
          { id: 'outlet-socket-b', label: 'Socket B', kind: 'power', face: 'right', u: 0.7, v: 0.5 },
        ],
      },
      {
        id: 'modem',
        label: 'ISP Modem',
        sub: 'Internet feed',
        icon: 'modem',
        pos: [-1.8, -3.4],
        size: [2, 0.45, 1.1],
        ports: [{ id: 'modem-eth', label: 'Ethernet out', kind: 'wan', face: 'front', u: 0.5, v: 0.5 }],
      },
      {
        id: 'router',
        label: 'Office Router',
        sub: 'Internet gateway',
        icon: 'router',
        pos: [-1.8, -1.4],
        size: [2.2, 0.5, 1.4],
        needsPower: true,
        ports: [
          { id: 'router-power', label: 'DC power in', kind: 'power', face: 'front', u: 0.2, v: 0.4 },
          { id: 'router-wan', label: 'WAN', kind: 'wan', face: 'top', u: 0.5, v: 0.2 },
          { id: 'router-lan1', label: 'LAN 1', kind: 'lan', face: 'right', u: 0.7, v: 0.4 },
        ],
      },
      {
        id: 'switch',
        label: '8-Port Switch',
        sub: 'Desk network',
        icon: 'switch',
        pos: [-1.8, 1.1],
        size: [3, 0.4, 1.4],
        needsPower: true,
        ports: [
          { id: 'switch-power', label: 'Power in', kind: 'power', face: 'front', u: 0.16, v: 0.4 },
          { id: 'switch-uplink', label: 'Uplink', kind: 'uplink', face: 'top', u: 0.5, v: 0.2 },
          { id: 'switch-p1', label: 'Port 1', kind: 'lan', face: 'front', u: 0.45, v: 0.45 },
          { id: 'switch-p2', label: 'Port 2', kind: 'lan', face: 'front', u: 0.62, v: 0.45 },
          { id: 'switch-p3', label: 'Port 3', kind: 'lan', face: 'right', u: 0.5, v: 0.4 },
          { id: 'switch-p4', label: 'Port 4', kind: 'lan', face: 'back', u: 0.5, v: 0.45 },
        ],
      },
      {
        id: 'pc1',
        label: 'PC-1',
        sub: 'Workstation',
        icon: 'desktop',
        pos: [2.6, -1.8],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc1-nic', label: 'Ethernet', kind: 'nic', face: 'front', u: 0.3, v: 0.45 }],
      },
      {
        id: 'pc2',
        label: 'PC-2',
        sub: 'Workstation',
        icon: 'pc',
        pos: [2.6, 0.2],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc2-nic', label: 'Ethernet', kind: 'nic', face: 'front', u: 0.3, v: 0.45 }],
      },
      {
        id: 'laptop',
        label: 'Laptop',
        sub: 'Hot desk',
        icon: 'laptop',
        pos: [2.6, 2.2],
        size: [1.7, 0.12, 1.2],
        ports: [{ id: 'laptop-nic', label: 'Ethernet', kind: 'nic', face: 'front', u: 0.22, v: 0.6 }],
      },
      {
        id: 'printer',
        label: 'Printer',
        sub: 'Shared',
        icon: 'printer',
        pos: [-1.8, 3.3],
        size: [1.4, 0.9, 1.1],
        ports: [{ id: 'printer-nic', label: 'Ethernet', kind: 'nic', face: 'front', u: 0.7, v: 0.5 }],
      },
    ],
    steps: [
      {
        id: 's1',
        title: 'Power the switch',
        instruction: "Run the power cable from the switch's power in to Socket A on the wall outlet.",
        why: 'The router and its internet feed are already running. The switch is the next active device - it needs mains power before any port can pass a frame.',
        type: 'connect',
        from: 'switch-power',
        to: 'outlet-socket-a',
        cable: 'power',
      },
      {
        id: 's2',
        title: 'Power on the switch',
        instruction: "Press the switch's power button.",
        why: 'On boot the switch begins learning which MAC address lives on which port, so it can forward each frame to just one port instead of all of them.',
        type: 'power',
        target: 'switch',
      },
      {
        id: 's3',
        title: 'Uplink the switch to the router',
        instruction: "Run an Ethernet cable from the switch's uplink port to LAN 1 on the router.",
        why: 'This single cable is the whole switch\'s path to the router and the internet. Everything you plug into the switch shares it.',
        type: 'connect',
        from: 'switch-uplink',
        to: 'router-lan1',
        cable: 'data',
      },
      {
        id: 's4',
        title: 'Connect PC-1',
        instruction: "Run an Ethernet cable from PC-1's NIC to Port 1 on the switch.",
        why: 'Any numbered port behaves the same. The switch bridges Port 1 to the uplink, so PC-1 reaches the router.',
        type: 'connect',
        from: 'pc1-nic',
        to: 'switch-p1',
        cable: 'data',
      },
      {
        id: 's5',
        title: 'Connect PC-2',
        instruction: "Run an Ethernet cable from PC-2's NIC to Port 2 on the switch.",
        why: 'PC-1 and PC-2 are now on the same switch, so they can also talk directly to each other at layer 2 without troubling the router.',
        type: 'connect',
        from: 'pc2-nic',
        to: 'switch-p2',
        cable: 'data',
      },
      {
        id: 's6',
        title: 'Connect the laptop',
        instruction: "Run an Ethernet cable from the laptop's NIC to Port 3 on the switch.",
        why: 'A wired hot-desk port. Same network, same rules - the switch does not care what kind of device is on the far end.',
        type: 'connect',
        from: 'laptop-nic',
        to: 'switch-p3',
        cable: 'data',
      },
      {
        id: 's7',
        title: 'Connect the printer',
        instruction: "Run an Ethernet cable from the printer's NIC to Port 4 on the switch.",
        why: 'The printer is just another host on the LAN. Once it has an address, every device on the switch can send jobs to it.',
        type: 'connect',
        from: 'printer-nic',
        to: 'switch-p4',
        cable: 'data',
      },
    ],
  },

  // ── LAB 4 ────────────────────────────────────────────────────────────────
  {
    id: 'wireless-office',
    title: 'Wireless Office',
    subtitle: 'Router · switch · access point · desktop · laptop · phone',
    blurb: 'Add Wi-Fi to a wired office. Cable the access point back to the switch, wire the desktop, then join the laptop and phone over the air.',
    outro: 'An access point does not replace the wired network - it extends it. Wi-Fi only removes the cable between the client and the AP; the AP still needs a wire back to the switch.',
    level: 4,
    initialCables: [{ from: 'switch-uplink', to: 'router-lan1', cable: 'data' }],
    nodes: [
      {
        id: 'outlet',
        label: 'Wall Outlet',
        sub: 'Mains power',
        icon: 'outlet',
        pos: [-5.2, 0.4],
        size: [0.4, 1.3, 0.95],
        ports: [
          { id: 'outlet-socket-a', label: 'Socket A', kind: 'power', face: 'right', u: 0.32, v: 0.5 },
          { id: 'outlet-socket-b', label: 'Socket B', kind: 'power', face: 'right', u: 0.7, v: 0.5 },
        ],
      },
      {
        id: 'router',
        label: 'Office Router',
        sub: 'Internet gateway',
        icon: 'router',
        pos: [-3, -2.6],
        size: [2, 0.45, 1.1],
        ports: [{ id: 'router-lan1', label: 'LAN 1', kind: 'lan', face: 'front', u: 0.5, v: 0.5 }],
      },
      {
        id: 'switch',
        label: '8-Port Switch',
        sub: 'Wired core',
        icon: 'switch',
        pos: [-3, 0.4],
        size: [2.8, 0.4, 1.4],
        needsPower: true,
        ports: [
          { id: 'switch-power', label: 'Power in', kind: 'power', face: 'front', u: 0.18, v: 0.4 },
          { id: 'switch-uplink', label: 'Uplink', kind: 'uplink', face: 'top', u: 0.5, v: 0.2 },
          { id: 'switch-p1', label: 'Port 1', kind: 'lan', face: 'front', u: 0.55, v: 0.45 },
          { id: 'switch-p2', label: 'Port 2', kind: 'lan', face: 'right', u: 0.5, v: 0.4 },
        ],
      },
      {
        id: 'ap',
        label: 'Access Point',
        sub: 'Wi-Fi',
        icon: 'accesspoint',
        pos: [1.6, 0.4],
        size: [1.3, 0.35, 1.3],
        needsPower: true,
        ports: [
          { id: 'ap-power', label: 'Power in', kind: 'power', face: 'front', u: 0.25, v: 0.5 },
          { id: 'ap-uplink', label: 'LAN uplink', kind: 'uplink', face: 'back', u: 0.5, v: 0.5 },
          { id: 'ap-radio', label: 'Wi-Fi (SSID)', kind: 'radio', face: 'top', u: 0.5, v: 0.5 },
        ],
      },
      {
        id: 'desktop',
        label: 'Desktop PC',
        sub: 'Wired',
        icon: 'desktop',
        pos: [-3, 3.2],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'desktop-nic', label: 'Ethernet', kind: 'nic', face: 'front', u: 0.3, v: 0.45 }],
      },
      {
        id: 'laptop',
        label: 'Laptop',
        sub: 'Wireless client',
        icon: 'laptop',
        pos: [4, -1.6],
        size: [1.7, 0.12, 1.2],
        ports: [{ id: 'laptop-nic', label: 'Wi-Fi radio', kind: 'nic', face: 'back', u: 0.5, v: 0.6 }],
      },
      {
        id: 'phone',
        label: 'IP Phone',
        sub: 'Wireless client',
        icon: 'phone',
        pos: [4, 2.2],
        size: [0.7, 1.1, 0.5],
        ports: [{ id: 'phone-nic', label: 'Wi-Fi radio', kind: 'nic', face: 'left', u: 0.5, v: 0.6 }],
      },
    ],
    steps: [
      {
        id: 's1',
        title: 'Power the switch',
        instruction: "Run the power cable from the switch's power in to Socket A.",
        why: 'The switch is the wired core - the access point and the desktop both hang off it, so it comes up first.',
        type: 'connect',
        from: 'switch-power',
        to: 'outlet-socket-a',
        cable: 'power',
      },
      {
        id: 's2',
        title: 'Power on the switch',
        instruction: "Press the switch's power button.",
        why: 'The uplink to the router is already patched. Once the switch boots, the wired side of the office is live.',
        type: 'power',
        target: 'switch',
      },
      {
        id: 's3',
        title: 'Power the access point',
        instruction: "Run the power cable from the access point's power in to Socket B.",
        why: 'An access point is an active radio - it needs mains power (or Power-over-Ethernet) before it can broadcast an SSID.',
        type: 'connect',
        from: 'ap-power',
        to: 'outlet-socket-b',
        cable: 'power',
      },
      {
        id: 's4',
        title: 'Power on the access point',
        instruction: "Press the access point's power button.",
        why: 'On boot it starts beaconing its network name (SSID) so nearby clients can find and join it.',
        type: 'power',
        target: 'ap',
      },
      {
        id: 's5',
        title: 'Cable the access point to the switch',
        instruction: "Run an Ethernet cable from the access point's LAN uplink to Port 2 on the switch.",
        why: 'This is the part people forget: Wi-Fi only replaces the cable to the client. The AP itself still needs a wire back to the switch to reach the rest of the network.',
        type: 'connect',
        from: 'ap-uplink',
        to: 'switch-p2',
        cable: 'data',
      },
      {
        id: 's6',
        title: 'Wire the desktop',
        instruction: "Run an Ethernet cable from the desktop's NIC to Port 1 on the switch.",
        why: 'A fixed workstation is better off wired - lower latency, no contention for the airtime. Wired and wireless clients share the same LAN.',
        type: 'connect',
        from: 'desktop-nic',
        to: 'switch-p1',
        cable: 'data',
      },
      {
        id: 's7',
        title: 'Join the laptop to Wi-Fi',
        instruction: "Connect the laptop's Wi-Fi radio to the access point's Wi-Fi (SSID) port.",
        why: 'This stands in for selecting the SSID and associating. There is no cable - the link is radio - but the AP bridges the laptop straight onto the wired LAN.',
        type: 'connect',
        from: 'laptop-nic',
        to: 'ap-radio',
        cable: 'data',
      },
      {
        id: 's8',
        title: 'Join the phone to Wi-Fi',
        instruction: "Connect the IP phone's Wi-Fi radio to the access point's Wi-Fi (SSID) port.",
        why: 'The same AP serves many clients at once. The phone associates just like the laptop and lands on the same network.',
        type: 'connect',
        from: 'phone-nic',
        to: 'ap-radio',
        cable: 'data',
      },
    ],
  },

  // ── LAB 5 ────────────────────────────────────────────────────────────────
  {
    id: 'network-expansion',
    title: 'Network Expansion',
    subtitle: 'Requirement: add a 3-PC department',
    blurb: 'A router, a switch and two PCs are already working. New brief: a second department needs three more computers online. Decide what hardware it takes and cable it in.',
    outro: 'When a switch runs out of ports, you add another switch and give it its own uplink to the router. Each switch is one more branch off the same tree.',
    level: 5,
    initialPowered: ['switch1'],
    initialCables: [
      { from: 'switch1-power', to: 'outlet-socket-a', cable: 'power' },
      { from: 'switch1-uplink', to: 'router-lan1', cable: 'data' },
      { from: 'pc1-nic', to: 'switch1-p1', cable: 'data' },
      { from: 'pc2-nic', to: 'switch1-p2', cable: 'data' },
    ],
    nodes: [
      {
        id: 'outlet',
        label: 'Wall Outlet',
        sub: 'Mains power',
        icon: 'outlet',
        pos: [-5.4, 0.4],
        size: [0.4, 1.3, 0.95],
        ports: [
          { id: 'outlet-socket-a', label: 'Socket A', kind: 'power', face: 'right', u: 0.32, v: 0.5 },
          { id: 'outlet-socket-b', label: 'Socket B', kind: 'power', face: 'right', u: 0.7, v: 0.5 },
        ],
      },
      {
        id: 'router',
        label: 'Office Router',
        sub: 'Internet gateway',
        icon: 'router',
        pos: [-2, -3],
        size: [2.2, 0.5, 1.2],
        ports: [
          { id: 'router-lan1', label: 'LAN 1', kind: 'lan', face: 'front', u: 0.35, v: 0.5 },
          { id: 'router-lan2', label: 'LAN 2', kind: 'lan', face: 'front', u: 0.65, v: 0.5 },
        ],
      },
      {
        id: 'switch1',
        label: 'Switch A',
        sub: 'Department 1',
        icon: 'switch',
        pos: [-2.6, -0.4],
        size: [2.6, 0.4, 1.3],
        needsPower: true,
        ports: [
          { id: 'switch1-power', label: 'Power in', kind: 'power', face: 'front', u: 0.18, v: 0.4 },
          { id: 'switch1-uplink', label: 'Uplink', kind: 'uplink', face: 'top', u: 0.5, v: 0.2 },
          { id: 'switch1-p1', label: 'Port 1', kind: 'lan', face: 'left', u: 0.4, v: 0.4 },
          { id: 'switch1-p2', label: 'Port 2', kind: 'lan', face: 'left', u: 0.65, v: 0.4 },
        ],
      },
      {
        id: 'switch2',
        label: 'Switch B',
        sub: 'Department 2 (new)',
        icon: 'switch',
        pos: [2.4, -0.4],
        size: [2.8, 0.4, 1.3],
        needsPower: true,
        ports: [
          { id: 'switch2-power', label: 'Power in', kind: 'power', face: 'front', u: 0.15, v: 0.4 },
          { id: 'switch2-uplink', label: 'Uplink', kind: 'uplink', face: 'top', u: 0.5, v: 0.2 },
          { id: 'switch2-p1', label: 'Port 1', kind: 'lan', face: 'front', u: 0.45, v: 0.45 },
          { id: 'switch2-p2', label: 'Port 2', kind: 'lan', face: 'right', u: 0.5, v: 0.4 },
          { id: 'switch2-p3', label: 'Port 3', kind: 'lan', face: 'back', u: 0.5, v: 0.45 },
        ],
      },
      {
        id: 'pc1',
        label: 'PC-1',
        sub: 'Department 1',
        icon: 'desktop',
        pos: [-4.4, -2.4],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc1-nic', label: 'Ethernet', kind: 'nic', face: 'right', u: 0.5, v: 0.45 }],
      },
      {
        id: 'pc2',
        label: 'PC-2',
        sub: 'Department 1',
        icon: 'pc',
        pos: [-4.4, -0.6],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc2-nic', label: 'Ethernet', kind: 'nic', face: 'right', u: 0.5, v: 0.45 }],
      },
      {
        id: 'pc3',
        label: 'PC-3',
        sub: 'Department 2',
        icon: 'pc',
        pos: [2.4, 2.4],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc3-nic', label: 'Ethernet', kind: 'nic', face: 'back', u: 0.5, v: 0.45 }],
      },
      {
        id: 'pc4',
        label: 'PC-4',
        sub: 'Department 2',
        icon: 'pc',
        pos: [4.4, 1.6],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc4-nic', label: 'Ethernet', kind: 'nic', face: 'left', u: 0.5, v: 0.45 }],
      },
      {
        id: 'pc5',
        label: 'PC-5',
        sub: 'Department 2',
        icon: 'pc',
        pos: [4.4, -0.4],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc5-nic', label: 'Ethernet', kind: 'nic', face: 'left', u: 0.5, v: 0.45 }],
      },
    ],
    steps: [
      {
        id: 's1',
        title: 'Power the new switch',
        instruction: "The new department needs its own switch. Run the power cable from Switch B's power in to Socket B.",
        why: 'Two PCs already fill Switch A. Three more computers need more ports than it has, so a second switch is the right piece of hardware to add.',
        type: 'connect',
        from: 'switch2-power',
        to: 'outlet-socket-b',
        cable: 'power',
      },
      {
        id: 's2',
        title: 'Power on Switch B',
        instruction: "Press Switch B's power button.",
        why: 'Same as any switch: it needs to boot before it can learn MAC addresses and forward frames.',
        type: 'power',
        target: 'switch2',
      },
      {
        id: 's3',
        title: 'Uplink Switch B to the router',
        instruction: "Run an Ethernet cable from Switch B's uplink to LAN 2 on the router - a different port from Switch A's uplink.",
        why: 'Each switch needs its own path to the router. Both departments now reach the gateway, and the router keeps their traffic sorted.',
        type: 'connect',
        from: 'switch2-uplink',
        to: 'router-lan2',
        cable: 'data',
      },
      {
        id: 's4',
        title: 'Connect PC-3',
        instruction: "Run an Ethernet cable from PC-3's NIC to Port 1 on Switch B.",
        why: 'The first machine of the new department joins the network.',
        type: 'connect',
        from: 'pc3-nic',
        to: 'switch2-p1',
        cable: 'data',
      },
      {
        id: 's5',
        title: 'Connect PC-4',
        instruction: "Run an Ethernet cable from PC-4's NIC to Port 2 on Switch B.",
        why: 'Two down, one to go. Every device on Switch B shares its single uplink to the router.',
        type: 'connect',
        from: 'pc4-nic',
        to: 'switch2-p2',
        cable: 'data',
      },
      {
        id: 's6',
        title: 'Connect PC-5',
        instruction: "Run an Ethernet cable from PC-5's NIC to Port 3 on Switch B.",
        why: 'The three-computer department is online. You sized the hardware to the requirement and cabled it to the existing network.',
        type: 'connect',
        from: 'pc5-nic',
        to: 'switch2-p3',
        cable: 'data',
      },
    ],
  },

  // ── LAB 6 ────────────────────────────────────────────────────────────────
  {
    id: 'hardware-troubleshooting',
    title: 'Hardware Troubleshooting',
    subtitle: 'Find and fix a broken network',
    blurb: 'This network was cabled by someone in a hurry. Nothing on the office LAN can reach the internet. Inspect the hardware, work out what is wrong, and put it right.',
    outro: 'Two swapped cables and a switch nobody powered on. Physical-layer faults are almost always this: wrong port, wrong cable, or no power. Check those first, every time.',
    level: 6,
    symptom: 'PC-1 and PC-2 have no internet. The switch link lights are dark, and the router\'s WAN light is off.',
    initialCables: [
      { from: 'switch-uplink', to: 'router-wan', cable: 'data' },
      { from: 'modem-eth', to: 'router-lan1', cable: 'data' },
      { from: 'switch-power', to: 'outlet-socket-a', cable: 'power' },
      { from: 'pc1-nic', to: 'switch-p1', cable: 'data' },
      { from: 'pc2-nic', to: 'switch-p2', cable: 'data' },
    ],
    nodes: [
      {
        id: 'outlet',
        label: 'Wall Outlet',
        sub: 'Mains power',
        icon: 'outlet',
        pos: [-5.2, 0.4],
        size: [0.4, 1.3, 0.95],
        ports: [
          { id: 'outlet-socket-a', label: 'Socket A', kind: 'power', face: 'right', u: 0.5, v: 0.5 },
        ],
      },
      {
        id: 'modem',
        label: 'ISP Modem',
        sub: 'Internet feed',
        icon: 'modem',
        pos: [-2, -3.4],
        size: [2, 0.45, 1.1],
        ports: [{ id: 'modem-eth', label: 'Ethernet out', kind: 'wan', face: 'front', u: 0.5, v: 0.5 }],
      },
      {
        id: 'router',
        label: 'Office Router',
        sub: 'Internet gateway',
        icon: 'router',
        pos: [-2, -1.3],
        size: [2.4, 0.5, 1.4],
        ports: [
          { id: 'router-wan', label: 'WAN', kind: 'wan', face: 'top', u: 0.35, v: 0.2 },
          { id: 'router-lan1', label: 'LAN 1', kind: 'lan', face: 'top', u: 0.65, v: 0.2 },
        ],
      },
      {
        id: 'switch',
        label: '8-Port Switch',
        sub: 'Office LAN',
        icon: 'switch',
        pos: [-2, 1.2],
        size: [2.8, 0.4, 1.4],
        needsPower: true,
        ports: [
          { id: 'switch-power', label: 'Power in', kind: 'power', face: 'front', u: 0.16, v: 0.4 },
          { id: 'switch-uplink', label: 'Uplink', kind: 'uplink', face: 'top', u: 0.5, v: 0.2 },
          { id: 'switch-p1', label: 'Port 1', kind: 'lan', face: 'right', u: 0.4, v: 0.4 },
          { id: 'switch-p2', label: 'Port 2', kind: 'lan', face: 'right', u: 0.7, v: 0.4 },
        ],
      },
      {
        id: 'pc1',
        label: 'PC-1',
        sub: 'Workstation',
        icon: 'desktop',
        pos: [2.4, -0.4],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc1-nic', label: 'Ethernet', kind: 'nic', face: 'left', u: 0.5, v: 0.45 }],
      },
      {
        id: 'pc2',
        label: 'PC-2',
        sub: 'Workstation',
        icon: 'pc',
        pos: [2.4, 1.8],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc2-nic', label: 'Ethernet', kind: 'nic', face: 'left', u: 0.5, v: 0.45 }],
      },
    ],
    steps: [
      {
        id: 's1',
        title: 'Inspect the switch uplink',
        instruction: "The switch uplink is plugged into the router's WAN port. That port faces the ISP, not the LAN. Unplug that cable.",
        why: 'The WAN port is a separate routed interface for the internet feed. A switch full of office PCs must land on a LAN port, or the router will not bridge it onto the local network.',
        type: 'fix-remove',
        from: 'switch-uplink',
        to: 'router-wan',
      },
      {
        id: 's2',
        title: 'Inspect the internet feed',
        instruction: "The modem is plugged into the router's LAN 1 port. Unplug that cable too.",
        why: 'The two cables were swapped. The modem carries the ISP connection and belongs on WAN; a LAN port will not route it to the internet.',
        type: 'fix-remove',
        from: 'modem-eth',
        to: 'router-lan1',
      },
      {
        id: 's3',
        title: 'Reconnect the modem to WAN',
        instruction: "Run the modem's Ethernet cable to the router's WAN port.",
        why: 'WAN is the one interface built to face the ISP - it gets the public address and the default route.',
        type: 'connect',
        from: 'modem-eth',
        to: 'router-wan',
        cable: 'data',
      },
      {
        id: 's4',
        title: 'Reconnect the switch to LAN',
        instruction: "Run the switch uplink to the router's LAN 1 port.",
        why: 'Now the office LAN sits on a LAN interface, in the same subnet the router hands out addresses on.',
        type: 'connect',
        from: 'switch-uplink',
        to: 'router-lan1',
        cable: 'data',
      },
      {
        id: 's5',
        title: 'Power on the switch',
        instruction: "The switch power cable is plugged in, but the switch is off. Press its power button.",
        why: 'Cabling can be perfect and the link still be dead if the device has no power. Always confirm the LEDs are on before chasing anything more complex.',
        type: 'power',
        target: 'switch',
      },
    ],
  },

  // ── LAB 7 ────────────────────────────────────────────────────────────────
  {
    id: 'small-business',
    title: 'Build a Small Business Network',
    subtitle: 'From an empty board · no step list',
    blurb: 'You are setting up networking for a small business: internet, a router, a switch, Wi-Fi, three computers and a shared printer. Cable and power it in whatever order you like - then check your work against the requirements.',
    outro: 'That is a complete small-office network: one internet feed to the router\'s WAN, one switch fanning out the LAN, an access point wired back to that switch, and every device on a port. Order did not matter - the finished topology did.',
    level: 7,
    steps: [],
    goal: {
      brief: 'Required: internet on the router\'s WAN, a switch uplinked to the router, an access point cabled to the switch, and every computer and the printer on a switch port. All active devices powered on.',
      checklist: [
        { kind: 'powered', node: 'router', label: 'Router powered on' },
        { kind: 'powered', node: 'switch', label: 'Switch powered on' },
        { kind: 'powered', node: 'ap', label: 'Access point powered on' },
        { kind: 'uplink', node: 'router', toKinds: ['wan'], label: 'Internet feed on the router WAN port' },
        { kind: 'uplink', node: 'switch', toKinds: ['lan'], label: 'Switch uplinked to a router LAN port' },
        { kind: 'uplink', node: 'ap', toKinds: ['lan'], label: 'Access point cabled back to the switch' },
        { kind: 'all-uplink', icons: ['desktop', 'pc', 'printer'], toKinds: ['lan'], label: 'Every computer and the printer on a switch port' },
      ],
    },
    nodes: [
      {
        id: 'outlet',
        label: 'Wall Outlet',
        sub: 'Mains power',
        icon: 'outlet',
        pos: [-5.6, 0.2],
        size: [0.4, 1.5, 1.1],
        ports: [
          { id: 'outlet-a', label: 'Socket A', kind: 'power', face: 'right', u: 0.25, v: 0.5 },
          { id: 'outlet-b', label: 'Socket B', kind: 'power', face: 'right', u: 0.5, v: 0.5 },
          { id: 'outlet-c', label: 'Socket C', kind: 'power', face: 'right', u: 0.75, v: 0.5 },
        ],
      },
      {
        id: 'modem',
        label: 'ISP Modem',
        sub: 'Internet feed',
        icon: 'modem',
        pos: [-2.6, -3.6],
        size: [2, 0.45, 1.1],
        ports: [{ id: 'modem-eth', label: 'Ethernet out', kind: 'wan', face: 'front', u: 0.5, v: 0.5 }],
      },
      {
        id: 'router',
        label: 'Business Router',
        sub: 'Gateway',
        icon: 'router',
        pos: [-2.6, -1.6],
        size: [2.2, 0.5, 1.4],
        needsPower: true,
        ports: [
          { id: 'router-power', label: 'DC power in', kind: 'power', face: 'front', u: 0.2, v: 0.4 },
          { id: 'router-wan', label: 'WAN', kind: 'wan', face: 'top', u: 0.5, v: 0.2 },
          { id: 'router-lan1', label: 'LAN 1', kind: 'lan', face: 'right', u: 0.4, v: 0.4 },
          { id: 'router-lan2', label: 'LAN 2', kind: 'lan', face: 'right', u: 0.7, v: 0.4 },
        ],
      },
      {
        id: 'switch',
        label: '8-Port Switch',
        sub: 'LAN core',
        icon: 'switch',
        pos: [-2.6, 0.9],
        size: [3, 0.4, 1.4],
        needsPower: true,
        ports: [
          { id: 'switch-power', label: 'Power in', kind: 'power', face: 'front', u: 0.14, v: 0.4 },
          { id: 'switch-uplink', label: 'Uplink', kind: 'uplink', face: 'top', u: 0.5, v: 0.2 },
          { id: 'switch-p1', label: 'Port 1', kind: 'lan', face: 'front', u: 0.42, v: 0.45 },
          { id: 'switch-p2', label: 'Port 2', kind: 'lan', face: 'front', u: 0.58, v: 0.45 },
          { id: 'switch-p3', label: 'Port 3', kind: 'lan', face: 'right', u: 0.5, v: 0.4 },
          { id: 'switch-p4', label: 'Port 4', kind: 'lan', face: 'back', u: 0.5, v: 0.45 },
        ],
      },
      {
        id: 'ap',
        label: 'Access Point',
        sub: 'Wi-Fi',
        icon: 'accesspoint',
        pos: [1.6, 0.9],
        size: [1.3, 0.35, 1.3],
        needsPower: true,
        ports: [
          { id: 'ap-power', label: 'Power in', kind: 'power', face: 'front', u: 0.25, v: 0.5 },
          { id: 'ap-uplink', label: 'LAN uplink', kind: 'uplink', face: 'back', u: 0.5, v: 0.5 },
        ],
      },
      {
        id: 'pc1',
        label: 'PC-1',
        sub: 'Workstation',
        icon: 'desktop',
        pos: [3.6, -2.2],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc1-nic', label: 'Ethernet', kind: 'nic', face: 'left', u: 0.5, v: 0.45 }],
      },
      {
        id: 'pc2',
        label: 'PC-2',
        sub: 'Workstation',
        icon: 'pc',
        pos: [3.6, -0.4],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc2-nic', label: 'Ethernet', kind: 'nic', face: 'left', u: 0.5, v: 0.45 }],
      },
      {
        id: 'pc3',
        label: 'PC-3',
        sub: 'Workstation',
        icon: 'pc',
        pos: [3.6, 1.4],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc3-nic', label: 'Ethernet', kind: 'nic', face: 'left', u: 0.5, v: 0.45 }],
      },
      {
        id: 'printer',
        label: 'Printer',
        sub: 'Shared',
        icon: 'printer',
        pos: [-2.6, 3.2],
        size: [1.4, 0.9, 1.1],
        ports: [{ id: 'printer-nic', label: 'Ethernet', kind: 'nic', face: 'front', u: 0.7, v: 0.5 }],
      },
    ],
  },

  // ── LAB 8 ────────────────────────────────────────────────────────────────
  {
    id: 'hardware-challenge',
    title: 'Hardware Challenge',
    subtitle: 'A goal, no instructions',
    blurb: 'Build a network where all three computers can talk to each other and reach the Internet. You decide which cables go where. Nothing is guided - meet the goals.',
    outro: 'You worked out the topology yourself: modem to the router\'s WAN, switch to a router LAN port, and all three computers on the switch. That is the shape of nearly every network you will ever build.',
    level: 8,
    steps: [],
    goal: {
      brief: 'Goal: all three computers can communicate with each other AND reach the Internet.',
      checklist: [
        { kind: 'uplink', node: 'router', toKinds: ['wan'], label: 'The network can reach the Internet (modem on the router WAN)' },
        { kind: 'uplink', node: 'switch', toKinds: ['lan'], label: 'The switch reaches the router' },
        { kind: 'all-uplink', icons: ['pc', 'desktop'], toKinds: ['lan'], label: 'All three computers are connected to the network' },
        { kind: 'powered', node: 'router', label: 'The router is powered on' },
        { kind: 'powered', node: 'switch', label: 'The switch is powered on' },
      ],
    },
    nodes: [
      {
        id: 'outlet',
        label: 'Wall Outlet',
        sub: 'Mains power',
        icon: 'outlet',
        pos: [-5.2, 0.4],
        size: [0.4, 1.3, 0.95],
        ports: [
          { id: 'outlet-a', label: 'Socket A', kind: 'power', face: 'right', u: 0.32, v: 0.5 },
          { id: 'outlet-b', label: 'Socket B', kind: 'power', face: 'right', u: 0.7, v: 0.5 },
        ],
      },
      {
        id: 'modem',
        label: 'ISP Modem',
        sub: 'Internet feed',
        icon: 'modem',
        pos: [-2, -3.4],
        size: [2, 0.45, 1.1],
        ports: [{ id: 'modem-eth', label: 'Ethernet out', kind: 'wan', face: 'front', u: 0.5, v: 0.5 }],
      },
      {
        id: 'router',
        label: 'Router',
        sub: 'Gateway',
        icon: 'router',
        pos: [-2, -1.3],
        size: [2.2, 0.5, 1.4],
        needsPower: true,
        ports: [
          { id: 'router-power', label: 'DC power in', kind: 'power', face: 'front', u: 0.2, v: 0.4 },
          { id: 'router-wan', label: 'WAN', kind: 'wan', face: 'top', u: 0.5, v: 0.2 },
          { id: 'router-lan1', label: 'LAN 1', kind: 'lan', face: 'right', u: 0.6, v: 0.4 },
        ],
      },
      {
        id: 'switch',
        label: 'Switch',
        sub: 'LAN',
        icon: 'switch',
        pos: [-2, 1.2],
        size: [2.8, 0.4, 1.4],
        needsPower: true,
        ports: [
          { id: 'switch-power', label: 'Power in', kind: 'power', face: 'front', u: 0.16, v: 0.4 },
          { id: 'switch-uplink', label: 'Uplink', kind: 'uplink', face: 'top', u: 0.5, v: 0.2 },
          { id: 'switch-p1', label: 'Port 1', kind: 'lan', face: 'right', u: 0.4, v: 0.4 },
          { id: 'switch-p2', label: 'Port 2', kind: 'lan', face: 'front', u: 0.6, v: 0.45 },
          { id: 'switch-p3', label: 'Port 3', kind: 'lan', face: 'back', u: 0.5, v: 0.45 },
        ],
      },
      {
        id: 'pc1',
        label: 'PC-1',
        sub: 'Workstation',
        icon: 'desktop',
        pos: [2.4, -1],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc1-nic', label: 'Ethernet', kind: 'nic', face: 'left', u: 0.5, v: 0.45 }],
      },
      {
        id: 'pc2',
        label: 'PC-2',
        sub: 'Workstation',
        icon: 'pc',
        pos: [2.4, 0.8],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc2-nic', label: 'Ethernet', kind: 'nic', face: 'left', u: 0.5, v: 0.45 }],
      },
      {
        id: 'pc3',
        label: 'PC-3',
        sub: 'Workstation',
        icon: 'pc',
        pos: [2.4, 2.6],
        size: [0.9, 1.5, 1.2],
        ports: [{ id: 'pc3-nic', label: 'Ethernet', kind: 'nic', face: 'left', u: 0.5, v: 0.45 }],
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
