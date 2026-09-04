/**
 * NetForge curriculum - structured CCNA-inspired learning content, written
 * originally for NetForge. Each module pairs theory with labs from the
 * Lab Library so students go straight from reading to doing.
 */

export interface LessonSection {
  type: 'text' | 'code' | 'diagram' | 'keyterms' | 'quiz' | 'explainer'
  text: string
  /**
   * For explainer sections: the key of the animated visual in
   * Explainers.tsx (arp, default-gateway, static-route, tcp-handshake, vlan).
   */
  /** For quiz sections: the question and correct answer index. */
  question?: string
  options?: string[]
  answerIndex?: number
  explanation?: string
}

export interface Lesson {
  id: string
  title: string
  minutes: number
  content: LessonSection[]
}

export interface CurriculumModule {
  id: string
  level: number
  title: string
  blurb: string
  /** Lab ids from ALL_LABS to suggest after finishing the module. */
  relatedLabIds?: string[]
  /** Placeholder modules planned for a future release. */
  comingSoon?: boolean
  /**
   * Ids of interactive concept labs (see src/data/lessons/) offered above the
   * text lessons for this module, e.g. ['ipv4-cidr', 'subnetting-practice'].
   */
  interactiveLessonIds?: string[]
  /** @deprecated use interactiveLessonIds. Still read for back-compat. */
  interactiveLessonId?: string
  lessons: Lesson[]
}

const text = (t: string): LessonSection => ({ type: 'text', text: t })
const code = (t: string): LessonSection => ({ type: 'code', text: t })
const diagram = (t: string): LessonSection => ({ type: 'diagram', text: t })
const terms = (t: string): LessonSection => ({ type: 'keyterms', text: t })
const anim = (key: string): LessonSection => ({ type: 'explainer', text: key })
const quiz = (
  question: string,
  options: string[],
  answerIndex: number,
  explanation: string,
): LessonSection => ({
  type: 'quiz',
  text: question,
  question,
  options,
  answerIndex,
  explanation,
})

export const CURRICULUM: CurriculumModule[] = [
  // ──────────────────────────────────────────────
  // LEVEL 1: NETWORKING FUNDAMENTALS
  // ──────────────────────────────────────────────
  {
    id: 'fundamentals',
    level: 1,
    title: 'Networking Fundamentals',
    blurb: 'What a network actually is, the devices that build one, and how data finds its way from A to B.',
    relatedLabIds: ['starter'],
    lessons: [
      {
        id: 'what-is-a-network',
        title: 'What is a Network?',
        minutes: 6,
        content: [
          text('A network is simply two or more devices that can exchange data. When your laptop sends a message to a server across the ocean, that data crosses dozens of networks that all agree on the same rules - called protocols. Networking is the craft of building and connecting those networks so data arrives quickly, reliably, and securely.'),
          diagram(
            'SMALL NETWORK (LAN)                    GLOBAL NETWORK (WAN)\n\n PC-01 ─┐                              LAN ── Router ── ISP ──┐\n PC-02 ─┼─ Switch                      LAN ── Router ── ISP ──┼─ Internet\n PC-03 ─┘                              LAN ── Router ── ISP ──┘',
          ),
          text('A Local Area Network (LAN) covers one building or site - your home Wi-Fi, a school computer lab. A Wide Area Network (WAN) connects LANs that are far apart. The Internet is the biggest WAN of all: millions of networks stitched together.'),
          terms('LAN · Local network you control. WAN · Links your LAN to other LANs. Protocol · Agreed rule for communication, like TCP/IP.'),
          quiz(
            'What is the Internet best described as?',
            ['A single large LAN', 'A collection of interconnected WANs', 'Millions of networks using common protocols', 'A type of switch'],
            2,
            'The Internet is the largest WAN - millions of separate networks agreeing on TCP/IP protocols.',
          ),
        ],
      },
      {
        id: 'clients-servers',
        title: 'Clients, Servers and Devices',
        minutes: 6,
        content: [
          text('Almost all network conversation follows a client/server pattern. The client asks; the server answers. Your browser is a client asking a web server for a page. A PC asking a DHCP server "give me an IP address" is the same pattern.'),
          text('Four device types build the physical network:'),
          text('• End devices (PCs, servers, phones) - where data is created and consumed.\n• Switches - connect end devices inside a LAN and forward frames by MAC address.\n• Routers - connect different networks and forward packets by IP address.\n• Access points & firewalls - bridge wireless clients and police traffic respectively.'),
          diagram(
            'PCs and servers ── SWITCH ── ROUTER ── the rest of the world\n   (end hosts)      (LAN)       (between networks)',
          ),
          text('Remember the division of labor: switches work inside one network, routers work between networks. That single sentence explains most of what a network engineer configures every day.'),
          quiz(
            'Which device forwards traffic BETWEEN different networks?',
            ['Switch', 'Hub', 'Router', 'Access point'],
            2,
            'Routers operate at Layer 3 and forward packets between networks using IP addresses.',
          ),
        ],
      },
      {
        id: 'how-data-moves',
        title: 'How Data Actually Moves',
        minutes: 7,
        content: [
          text('When PC-01 pings PC-02, the journey happens in small steps. Applications hand data down a stack of layers; each layer adds the address information the next device needs. At the bottom, bits fly across a cable. On the receiving device the process runs in reverse.'),
          diagram(
            'PC-01                        Switch               PC-02\n  │                            │                    │\n  │  ARP finds the MAC         │                    │\n  │  Frame addressed to MAC    │                    │\n  │  ──────────────────────────→ look up MAC table  │\n  │                            │  ──────────────────→ decapsulate\n  │                            │                    │  → ping reply!',
          ),
          text('Each step uses a different address: MAC addresses get data across one physical link; IP addresses get data across many links to the right network. You will see both of these systems come alive in the NetForge Traffic Monitor.'),
          terms('Encapsulation · Wrapping data with headers at each layer. Frame · Layer-2 unit, addressed by MAC. Packet · Layer-3 unit, addressed by IP.'),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // LEVEL 2: ETHERNET & SWITCHING
  // ──────────────────────────────────────────────
  {
    id: 'ethernet',
    level: 2,
    title: 'Ethernet & Switching',
    blurb: 'MAC addresses, how a switch learns and forwards, and what happens when it does not know where to send a frame.',
    relatedLabIds: ['mac-address-lab', 'switch-learning-lab'],
    lessons: [
      {
        id: 'mac-addresses',
        title: 'MAC Addresses',
        minutes: 6,
        content: [
          text('Every network interface card ships with a burned-in hardware address: its MAC address. It is 48 bits, written as six hex pairs like 00:1A:2B:3C:4D:5E. The first half identifies the manufacturer, the second half is the individual card.'),
          code(
            'PC-01> show interfaces\nEth0  mac: 00:1A:2B:3C:4D:01  ip: 10.1.10.10/24  status: up',
          ),
          text('MAC addresses are local. They never travel past a router - every routed hop rewrites the frame with new MAC addresses. IP addresses carry the end-to-end identity; MAC addresses carry the next-hop identity.'),
          terms('MAC · 48-bit hardware address of one interface. OUI · First 24 bits, the vendor ID.'),
          quiz(
            'What happens to the MAC address when a packet crosses a router?',
            ['It stays the same', 'It is encrypted', 'It is rewritten with new source and destination MACs', 'It is removed entirely'],
            2,
            'Routers strip the old frame and build a new one with the next-hop MAC addresses at each routed hop.',
          ),
        ],
      },
      {
        id: 'switch-learning',
        title: 'How a Switch Learns',
        minutes: 7,
        content: [
          text('A switch forwards frames using a MAC address table it builds by watching traffic. The rule is beautifully simple: whenever a frame arrives on port X with source MAC M, the switch records "M lives on port X."'),
          diagram(
            'PC-01 sends to PC-02:                       SW-01 MAC table\n                                            ┌────────────────┐\nPC-01 ── Fa0/1 ─┐    frame: src MAC-01      │ MAC-01 → Fa0/1 │ ← learned from source\nPC-02 ── Fa0/2 ─┼─ SW   dst MAC-02         │                │\nPC-03 ── Fa0/3 ─┘    switch doesn\'t know    │ (no MAC-02 yet)│\n                     MAC-02 yet → FLOOD it out every other port',
          ),
          text('When the destination MAC is unknown, the switch floods the frame out of every port except the one it arrived on. PC-02 receives it and replies - and the switch learns PC-02\'s port from the reply\'s source address. After one round trip the table is complete and traffic becomes unicast only.'),
          text('Watch this exact cycle in the NetForge Traffic Monitor: every logged packet shows the path it took and why.'),
        ],
      },
      {
        id: 'broadcast-unicast',
        title: 'Unicast, Broadcast and Broadcast Domains',
        minutes: 6,
        content: [
          text('Unicast traffic goes from one host to one host. Broadcast traffic goes to everyone on the local network at once - the destination MAC is FF:FF:FF:FF:FF:FF. ARP requests and DHCP discover messages are both broadcast.'),
          text('A broadcast domain is the set of devices that receive each other\'s broadcasts. A switch is one broadcast domain (until VLANs split it); a router always ends a broadcast domain. That is why routers sit between networks: they stop broadcasts from leaking out while still forwarding unicast packets on.'),
          terms('Unicast · One to one. Broadcast · One to all on the LAN (FF:FF:FF:FF:FF:FF). Broadcast domain · Border drawn by routers.'),
          quiz(
            'Which device creates the boundary of a broadcast domain?',
            ['Switch', 'Hub', 'Router', 'Bridge'],
            2,
            'Routers do not forward broadcasts, so each router interface defines the edge of a broadcast domain.',
          ),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // LEVEL 3: IPv4 ADDRESSING
  // ──────────────────────────────────────────────
  {
    id: 'ipv4',
    level: 3,
    title: 'IPv4 Addressing',
    blurb: 'Dotted decimals, masks, the network vs host split, private ranges, and the job of the default gateway.',
    relatedLabIds: ['wrong-gateway', 'ip-config-lab'],
    lessons: [
      {
        id: 'ipv4-basics',
        title: 'IPv4 Addresses and Masks',
        minutes: 8,
        content: [
          text('An IPv4 address is a 32-bit number written as four octets: 192.168.1.10. The mask splits it into two parts - the network portion (which network you are on) and the host portion (which machine on that network).'),
          code(
            'IP    192.168.1.10   → 11000000.10101000.00000001.00001010\nMask  255.255.255.0  → 11111111.11111111.11111111.00000000\n                       └──── network ────┘ └─ host ─┘\n\nNetwork = IP AND Mask = 192.168.1.0',
          ),
          text('The mask does not travel with the packet - two hosts decide they are neighbors by each ANDing their own address with their own mask. Same network result → direct communication. Different → hand the packet to the gateway.'),
          terms('Octet · 8 bits, 0-255. Mask · Splits network from host. CIDR /24 · Shorthand for 255.255.255.0 - 24 one-bits.'),
          quiz(
            'Given IP 10.0.5.200 with mask 255.255.0.0, what is the network address?',
            ['10.0.0.0', '10.0.5.0', '10.0.5.200', '10.0.5.255'],
            0,
            'With a /16 mask, the first two octets are the network: 10.0.0.0.',
          ),
        ],
      },
      {
        id: 'private-addressing',
        title: 'Private vs Public Addresses',
        minutes: 5,
        content: [
          text('Three ranges are reserved for private networks and are never routed on the public Internet:'),
          code(
            '10.0.0.0/8        → 10.0.0.0   - 10.255.255.255\n172.16.0.0/12     → 172.16.0.0 - 172.31.255.255\n192.168.0.0/16    → 192.168.0.0 - 192.168.255.255',
          ),
          text('Everything else is public space owned by ISPs and organizations. Private addresses reach the Internet only through NAT, which translates them to a public address on the way out - a topic with its own module later in the course.'),
          quiz(
            'Which of these is a private IP address?',
            ['8.8.8.8', '172.20.5.10', '203.0.113.5', '1.1.1.1'],
            1,
            '172.16.0.0/12 covers 172.16.0.0 through 172.31.255.255 - so 172.20.5.10 is private.',
          ),
        ],
      },
      {
        id: 'default-gateway',
        title: 'The Default Gateway',
        minutes: 7,
        content: [
          text('When a host wants to talk to an address outside its own subnet, it hands the packet to the default gateway - normally the router interface on its local subnet. Get the gateway wrong and local traffic works fine while everything remote dies: the classic troubleshooting signature.'),
          code(
            'PC-02:  ip 10.1.10.20  mask 255.255.255.0  gw 10.1.10.254   ← WRONG\n\nping 10.1.10.99   → works      (same subnet, no gateway needed)\nping 8.8.8.8      → no reply   (packet sent to 10.1.10.254 - nobody home)',
          ),
          text('The gateway must live on the SAME subnet as the host. If a host\'s gateway is outside its own network, the host cannot deliver packets to it - the ARP request for the gateway goes unanswered and remote destinations become unreachable while everything local still works.'),
          text('The Wrong Gateway lab in the Lab Library reproduces exactly this failure. Fix it and watch the packet animation complete its journey.'),
          anim('default-gateway'),
          terms('Default gateway · The router a host sends off-network traffic to. Next hop · The immediate forwarding destination.'),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // LEVEL 4: SUBNETTING
  // ──────────────────────────────────────────────
  {
    id: 'subnetting',
    level: 4,
    title: 'Subnetting',
    blurb: 'Splitting one network into many: prefix lengths, borrowing bits, and calculating ranges fast.',
    relatedLabIds: ['subnetting-lab'],
    interactiveLessonIds: ['ipv4-cidr', 'subnetting-practice'],
    lessons: [
      {
        id: 'prefix-lengths',
        title: 'Prefix Lengths and Block Sizes',
        minutes: 8,
        content: [
          text('A /24 network has 8 host bits → 256 addresses (254 usable). Every bit you borrow from the host field cuts the block size in half:'),
          code(
            '/24 → 256 addresses   255.255.255.0\n/25 → 128 addresses   255.255.255.128\n/26 →  64 addresses   255.255.255.192\n/27 →  32 addresses   255.255.255.224\n/28 →  16 addresses   255.255.255.240\n/29 →   8 addresses   255.255.255.248\n/30 →   4 addresses   255.255.255.252  (2 usable - perfect for router links)',
          ),
          text('Remember: each network loses two addresses - the network address itself (all host bits 0) and the broadcast address (all host bits 1).'),
          quiz(
            'How many usable host addresses does a /28 network provide?',
            ['254', '30', '14', '6'],
            2,
            '/28 has 4 host bits (16 addresses). Subtract network and broadcast: 16 − 2 = 14 usable.',
          ),
        ],
      },
      {
        id: 'subnetting-worked-example',
        title: 'Worked Example: Four Networks from One /24',
        minutes: 9,
        content: [
          text('You need 4 networks out of 192.168.1.0/24. Four networks needs 2 borrowed bits (2² = 4), so each subnet is a /26 with 64 addresses:'),
          diagram(
            '192.168.1.0/26     →  .0    - .63    network 1  (hosts .1 - .62)\n192.168.1.64/26    →  .64   - .127   network 2  (hosts .65 - .126)\n192.168.1.128/26   →  .128  - .191   network 3  (hosts .129 - .190)\n192.168.1.192/26   →  .192  - .255   network 4  (hosts .193 - .254)',
          ),
          text('The recipe: (1) how many networks? → how many bits (2ⁿ ≥ N). (2) new prefix = old prefix + borrowed bits. (3) block size = 256 − last mask octet. (4) list networks by counting in block-size steps starting at zero. That four-step recipe solves every subnetting question you will meet at CCNA level.'),
          terms('Borrowing · Moving the mask left into host bits. Block size · 256 − mask octet; the stride between subnets.'),
          quiz(
            'You need 8 subnets from 10.0.0.0/24. What is the new prefix length?',
            ['/25', '/26', '/27', '/28'],
            2,
            '8 subnets needs 3 borrowed bits (2³ = 8). /24 + 3 = /27.',
          ),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // LEVEL 5: ARP
  // ──────────────────────────────────────────────
  {
    id: 'arp',
    level: 5,
    title: 'ARP - Address Resolution Protocol',
    blurb: 'How IP addresses get matched to MAC addresses - broadcast question, unicast answer.',
    relatedLabIds: ['arp-lab'],
    lessons: [
      {
        id: 'how-arp-works',
        title: 'How ARP Works',
        minutes: 7,
        content: [
          text('A device knows the destination IP, but to build an Ethernet frame it needs the destination MAC. ARP (Address Resolution Protocol) bridges that gap. The device broadcasts: "Who has 192.168.1.1? Tell 192.168.1.10." Only the owner of 192.168.1.1 replies - directly, via unicast: "192.168.1.1 is at AA:BB:CC:DD:EE:FF."'),
          diagram(
            'PC-01 (192.168.1.10)\n  │\n  │  "Who has 192.168.1.1? Tell 192.168.1.10"\n  │  ─────── BROADCAST (FF:FF:FF:FF:FF:FF) ───────→\n  │                     │\n  │              SW-01 floods frame\n  │                     │\n  │  ←─── "192.168.1.1 is at AA:BB:CC:DD:EE:FF" ─── R1 (192.168.1.1)\n  │                     (unicast reply)\n  │\n  │  PC-01 stores ARP entry: 192.168.1.1 → AA:BB:CC:DD:EE:FF',
          ),
          text('ARP entries are cached for a few minutes. This is why the first packet in a conversation can be slightly slower - the sender must ARP first - while subsequent packets fly through using the cached MAC.'),
          anim('arp'),
          terms('ARP · Maps IP to MAC on the local network. ARP cache · Table of recently resolved IP-to-MAC mappings. Broadcast · One-to-all frame on the LAN.'),
          quiz(
            'What type of frame does an ARP request use?',
            ['Unicast', 'Multicast', 'Broadcast', 'Anycast'],
            2,
            'ARP requests are broadcast (destination MAC FF:FF:FF:FF:FF:FF) because the sender does not yet know who owns the IP.',
          ),
        ],
      },
      {
        id: 'arp-troubleshooting',
        title: 'ARP Troubleshooting',
        minutes: 6,
        content: [
          text('When a ping fails and both devices have correct IP configurations, ARP is often the culprit. The most common failures:'),
          text('• Stale ARP cache - a device moved or was replaced but the old MAC is still cached.\n• ARP request goes unanswered - the target is down, on a different VLAN, or a firewall is blocking ARP.\n• Duplicate IP - two devices claim the same IP, causing flapping entries.'),
          code(
            'PC-01> show arp\n192.168.1.1    AA:BB:CC:DD:EE:FF    Eth0    2 min\n192.168.1.11   00:11:22:33:44:55    Eth0    15 min  ← suspect: too old',
          ),
          text('The ARP table in the Inspector panel shows every cached mapping. If a host can ping some neighbors but not others, check whether the failing neighbor has an ARP entry - and whether that entry looks fresh.'),
          text('The ARP Troubleshooting lab gives you a network where a stale ARP entry is causing intermittent failures. You will diagnose it using show arp and fix it by clearing the cache.'),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // LEVEL 6: SWITCHING & VLANs
  // ──────────────────────────────────────────────
  {
    id: 'switching',
    level: 6,
    title: 'Switching & VLANs',
    blurb: 'MAC tables, flooding, access ports, VLAN segmentation and trunks.',
    relatedLabIds: ['vlan-lab', 'trunk-lab'],
    lessons: [
      {
        id: 'mac-table-deep-dive',
        title: 'MAC Address Tables in Depth',
        minutes: 7,
        content: [
          text('A switch\'s MAC address table (also called the CAM table) is its forwarding brain. Each entry maps a MAC address to a switch port. The switch ages out entries that have not been seen for a while (typically 5 minutes) to keep the table current.'),
          code(
            'SW-01# show mac address-table\n\nMac Address Table\n──────────────────────────\nVlan  Mac Address       Ports\n────  ───────────────   ─────\n  1   00:1A:2B:3C:4D:01  Fa0/1\n  1   00:1A:2B:3C:4D:02  Fa0/2\n  1   00:1A:2B:3C:4D:03  Fa0/3\n\nTotal Mac Addresses: 3',
          ),
          text('When a frame arrives and the destination MAC is NOT in the table, the switch floods it out all ports in that VLAN (except the incoming port). This ensures delivery even when the switch does not yet know where the destination lives. Once the destination replies, the switch learns its port and future frames are forwarded directly.'),
          quiz(
            'What does a switch do when the destination MAC is not in its table?',
            ['Drops the frame', 'Forwards to the default gateway', 'Floods out all ports except the incoming port', 'Buffers the frame'],
            2,
            'Unknown unicast frames are flooded - the switch\'s safety net for when it has not yet learned the destination.',
          ),
        ],
      },
      {
        id: 'vlan-basics',
        title: 'VLANs - Virtual LANs',
        minutes: 8,
        content: [
          text('A VLAN (Virtual LAN) splits one physical switch into multiple logical broadcast domains. Ports assigned to VLAN 10 cannot see traffic from VLAN 20 - even though they share the same physical hardware. This is segmentation without extra cables.'),
          diagram(
            'Without VLANs:                    With VLANs:\nPC1 PC2 PC3 PC4                PC1 PC2 │ PC3 PC4\n  │   │   │   │                  VLAN10 │ VLAN20\n  └───┴───┴───┘                    │     │\n     SW-01                      SW-01 (two broadcast domains)\n  (one broadcast domain)',
          ),
          text('VLANs matter because they: (1) reduce broadcast traffic to only relevant devices, (2) improve security by isolating groups, and (3) let you organize by function rather than physical location. The engineering team can be on VLAN 10 on the third floor while also having members on the first floor.'),
          anim('vlan'),
          terms('VLAN · A logical broadcast domain. Access port · A port assigned to a single VLAN. Native VLAN · The untagged VLAN on a trunk port.'),
        ],
      },
      {
        id: 'trunking',
        title: 'Trunk Ports and 802.1Q',
        minutes: 7,
        content: [
          text('When traffic from multiple VLANs needs to cross a link - between switches, or from a switch to a router - we use a trunk port. Trunks tag each frame with its VLAN ID using the 802.1Q standard, so the receiving device knows which VLAN the frame belongs to.'),
          code(
            'SW-01# show interfaces trunk\n\nPort      Mode        Encapsulation  Status       Native Vlan\nGi0/1     on          802.1q         trunking     1\n\nPort      Vlans allowed on trunk\nGi0/1     10,20,30',
          ),
          text('Think of a trunk as a highway with lane markers: each lane (VLAN) carries its own traffic, and the 802.1Q tag is the lane marker that keeps frames in the correct lane at the other end. The native VLAN is the single exception - frames on the native VLAN cross the trunk untagged.'),
          terms('Trunk · A link carrying multiple VLANs via tagging. 802.1Q · The trunking standard that VLAN-tags frames.'),
          quiz(
            'What is the purpose of an 802.1Q tag?',
            ['To encrypt the frame', 'To identify which VLAN the frame belongs to', 'To compress the frame', 'To authenticate the sender'],
            1,
            '802.1Q inserts a 4-byte tag with the VLAN ID so the receiving device can forward the frame to the correct VLAN.',
          ),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // LEVEL 7: ROUTING
  // ──────────────────────────────────────────────
  {
    id: 'routing',
    level: 7,
    title: 'Routing',
    blurb: 'Routing tables, static routes, next hops, and how routers decide where packets go.',
    relatedLabIds: ['missing-route', 'static-route-lab'],
    lessons: [
      {
        id: 'routing-basics',
        title: 'How Routers Forward Packets',
        minutes: 8,
        content: [
          text('A router\'s job is simple to state and tricky to master: receive a packet, look at the destination IP, consult the routing table, and send the packet one hop closer to its destination. Every router makes this decision independently - there is no single "path planner" for the whole journey.'),
          code(
            'R-01# show ip route\n\nC  10.1.10.0/24   directly connected, Gi0/0\nC  10.1.0.0/30    directly connected, Gi0/1\nS  10.1.20.0/24   [1/0] via 10.1.0.2\n\nS = Static   C = Connected   AD = Administrative Distance',
          ),
          text('The routing table is built from two sources: connected routes (networks the router has an interface on) and static routes (manually configured by the engineer). More advanced protocols like OSPF can learn routes dynamically, but static routes are where every network engineer starts.'),
          terms('Routing table · Map of known networks and how to reach them. Next hop · The immediate forwarding destination. Connected route · A network the router is directly attached to.'),
          quiz(
            'What does a connected route in the routing table represent?',
            ['A network learned via OSPF', 'A network the router has an interface on', 'A manually configured route', 'The default gateway'],
            1,
            'Connected routes appear automatically when a router interface is configured with an IP and is in the "up" state.',
          ),
        ],
      },
      {
        id: 'static-routes',
        title: 'Configuring Static Routes',
        minutes: 8,
        content: [
          text('When a router does not know how to reach a network, you give it directions. A static route says: "To reach network X, send packets to next-hop Y."'),
          code(
            'R-01(config)# ip route 10.1.20.0 255.255.255.0 10.1.0.2\n\n"To reach 10.1.20.0/24, send packets to 10.1.0.2"\n\nR-01# show ip route static\nS  10.1.20.0/24   [1/0] via 10.1.0.2',
          ),
          text('The next-hop must be reachable - the router must already know how to reach 10.1.0.2. If the next-hop is on an unreachable network, the static route is useless. This is why routing is recursive: each hop must itself be routable.'),
          anim('static-route'),
          text('The Missing Route lab in the Lab Library gives you a network where a static route is absent. You will diagnose the connectivity failure and add the missing route.'),
          terms('Static route · A manually configured route entry. Next-hop · The IP address of the neighboring router to forward to. Recursive lookup · The router checking if the next-hop itself is reachable.'),
        ],
      },
      {
        id: 'default-routes',
        title: 'Default Routes',
        minutes: 6,
        content: [
          text('A default route is the "catch-all" - it matches any destination that has no more specific route. On the Internet, your home router has a default route pointing to your ISP. It does not need to know every network on Earth; it just sends everything else upstream.'),
          code(
            'Edge-Router(config)# ip route 0.0.0.0 0.0.0.0 203.0.113.1\n\n"Send any unmatched traffic to the ISP at 203.0.113.1"\n\nEdge-Router# show ip route\nS* 0.0.0.0/0   [1/0] via 203.0.113.1',
          ),
          text('Default routes keep routing tables small. Instead of tracking millions of Internet prefixes, a small network needs only its local routes plus one default route. The asterisk (*) in the route table marks the default route candidate.'),
          terms('Default route · 0.0.0.0/0 - the route of last resort. Gateway of last resort · The next-hop used for the default route.'),
          quiz(
            'What does a default route (0.0.0.0/0) match?',
            ['Only local traffic', 'Only broadcast traffic', 'Any destination with no more specific route', 'Only traffic from the 10.0.0.0/8 range'],
            2,
            'A default route is the lowest-priority match - it catches everything that no more specific route handles.',
          ),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // LEVEL 8: TCP / UDP
  // ──────────────────────────────────────────────
  {
    id: 'tcp-udp',
    level: 8,
    title: 'TCP / UDP',
    blurb: 'Ports, sockets, reliability and the three-way handshake.',
    relatedLabIds: ['tcp-handshake-lab'],
    interactiveLessonIds: ['tcp', 'udp', 'tcp-udp-choose'],
    lessons: [
      {
        id: 'ports-and-sockets',
        title: 'Ports and Sockets',
        minutes: 6,
        content: [
          text('IP addresses get packets to the right machine; port numbers get them to the right application. A web server listens on port 80 (HTTP) or 443 (HTTPS). Your browser picks a random source port and connects to the server\'s well-known port. Together, source IP:port + destination IP:port form a unique socket pair.'),
          code(
            'Connection: 192.168.1.10:49152 → 93.184.216.34:443\n            ──── source ────      ──── destination ────\n            (client)              (web server)\n\nSocket pair uniquely identifies this one conversation',
          ),
          text('Well-known ports (0-1023) are assigned to standard services: 22 for SSH, 53 for DNS, 80 for HTTP. Registered ports (1024-49151) are used by applications. Dynamic ports (49152-65535) are ephemeral ports the OS assigns to client connections.'),
          terms('Port · A 16-bit number identifying an application. Socket · IP address + port number, identifying one endpoint. Well-known port · 0-1023, assigned to standard services.'),
        ],
      },
      {
        id: 'tcp-handshake',
        title: 'The TCP Three-Way Handshake',
        minutes: 8,
        content: [
          text('TCP (Transmission Control Protocol) is reliable: it guarantees delivery by establishing a connection before data flows. The handshake is a three-step dance:'),
          diagram(
            'Client                        Server\n  │                              │\n  │  "I want to connect"         │\n  │  SEQ=100, SYN                │\n  │  ────────────────────────────→│\n  │                              │\n  │  "I got your request,         │\n  │   I want to connect too"     │\n  │  SEQ=300, ACK=101, SYN+ACK   │\n  │  ←────────────────────────────│\n  │                              │\n  │  "I got your response"       │\n  │  ACK=301                      │\n  │  ────────────────────────────→│\n  │                              │\n  │        CONNECTED!             │\n  │  (data can now flow both ways)',
          ),
          text('The three steps: (1) SYN - client proposes a sequence number. (2) SYN-ACK - server acknowledges and proposes its own. (3) ACK - client acknowledges the server. Only after this dance does either side send data. If any step fails, no connection is established.'),
          anim('tcp-handshake'),
          text('NetForge\'s Traffic Monitor can show you this handshake in action - watch for SYN, SYN-ACK, and ACK packets when a connection starts.'),
          terms('SYN · Synchronize - opens a connection. ACK · Acknowledgment - confirms receipt. Three-way handshake · SYN, SYN-ACK, ACK - the TCP connection setup.'),
          quiz(
            'What is the correct order of the TCP three-way handshake?',
            ['SYN → ACK → SYN-ACK', 'SYN → SYN-ACK → ACK', 'ACK → SYN → SYN-ACK', 'SYN-ACK → SYN → ACK'],
            1,
            'First the client sends SYN, then the server replies with SYN-ACK, and finally the client sends ACK to complete the handshake.',
          ),
        ],
      },
      {
        id: 'tcp-vs-udp',
        title: 'TCP vs UDP',
        minutes: 6,
        content: [
          text('TCP is the careful courier: it establishes a connection, numbers every byte, waits for acknowledgments, and retransmits anything lost. UDP is the postcard: fire and forget. No handshake, no guarantees, no retransmission.'),
          code(
            'TCP                              UDP\n────                             ───\nReliable delivery                 Best-effort delivery\nConnection-oriented               Connectionless\nOrdering guaranteed               No ordering\nFlow control                      No flow control\nSlower overhead                   Minimal overhead\n\nUses: HTTP, SSH, FTP            Uses: DNS, VoIP, video streaming',
          ),
          text('UDP wins where speed matters more than perfection. A video call would rather drop a frame than wait for a retransmission a second later. DNS queries are a single request and response - adding TCP overhead would triple the latency for no benefit.'),
          quiz(
            'Which protocol would a live video stream most likely use?',
            ['TCP', 'UDP', 'Both equally', 'Neither'],
            1,
            'Video streaming prefers UDP because a dropped frame is preferable to the delay of TCP retransmission.',
          ),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // LEVEL 9: DHCP & DNS
  // ──────────────────────────────────────────────
  {
    id: 'dhcp-dns',
    level: 9,
    title: 'DHCP & DNS',
    blurb: 'Automatic addressing (DORA) and name resolution.',
    relatedLabIds: ['dhcp-lab', 'dns-lab'],
    lessons: [
      {
        id: 'dhcp-dora',
        title: 'DHCP - Automatic IP Configuration',
        minutes: 8,
        content: [
          text('Without DHCP, you would manually type an IP address, subnet mask, and gateway into every device. DHCP automates this with a four-step process called DORA:'),
          diagram(
            'New PC boots up ── no IP address\n  │\n  │  DHCP DISCOVER  (broadcast: "I need an IP!")\n  │  ───────→\n  │          DHCP SERVER hears the broadcast\n  │  ←───────\n  │  DHCP OFFER  ("You can have 192.168.1.50")\n  │\n  │  DHCP REQUEST  ("I\'ll take that address!")\n  │  ───────→\n  │  ←───────\n  │  DHCP ACK  ("Confirmed - lease for 24 hours")\n  │\n  │  PC now has IP, mask, gateway, and DNS server',
          ),
          text('The lease is temporary. After half the lease time, the client tries to renew. If the server is unreachable, the client keeps using the address until the lease expires. This lets laptops move between networks seamlessly.'),
          terms('DHCP · Dynamic Host Configuration Protocol. DORA · Discover, Offer, Request, Acknowledge. Lease · Temporary assignment of an IP address.'),
          quiz(
            'What is the correct order of the DHCP DORA process?',
            ['Offer → Discover → Request → ACK', 'Discover → Offer → Request → ACK', 'Discover → Request → Offer → ACK', 'Request → Discover → Offer → ACK'],
            1,
            'DORA: Discover (client broadcasts), Offer (server proposes), Request (client accepts), ACK (server confirms).',
          ),
        ],
      },
      {
        id: 'dns-resolution',
        title: 'DNS - Name Resolution',
        minutes: 7,
        content: [
          text('Humans remember names; machines need IP addresses. DNS (Domain Name System) is the phonebook of the Internet, translating www.example.com into 93.184.216.34. Without DNS, you would need to memorize every IP address you visit.'),
          code(
            'PC-01> nslookup www.example.com\nServer:   8.8.8.8\nAddress:  8.8.8.8#53\n\nNon-authoritative answer:\nName:     www.example.com\nAddress:  93.184.216.34',
          ),
          text('DNS is hierarchical and distributed. Your query may go to your local resolver, then to a root server, then to the .com TLD server, then to the authoritative server for example.com. Each level of the hierarchy only knows the level below it - no single server knows every name.'),
          terms('DNS · Domain Name System. Resolver · Server that answers DNS queries. TTL · How long a DNS answer may be cached.'),
          quiz(
            'Users cannot reach www.corp.local, but the web server is up. What should you check first?',
            ['The web server power cable', 'Whether DNS resolves the name to the correct address', 'The subnet mask on the web server', 'The DHCP lease time'],
            1,
            'If the server is up, compare what DNS returns with the address the server actually holds - a stale record is the classic cause.',
          ),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // LEVEL 10: NAT
  // ──────────────────────────────────────────────
  {
    id: 'nat',
    level: 10,
    title: 'NAT & PAT',
    blurb: 'How private addresses reach the Internet: translation, inside/outside, and PAT.',
    relatedLabIds: ['nat-lab', 'wrong-gateway'],
    lessons: [
      {
        id: 'why-nat',
        title: 'Why NAT Exists',
        minutes: 7,
        content: [
          text('IPv4 has about 4.3 billion addresses - far fewer than the devices on Earth. NAT (Network Address Translation) lets thousands of private addresses share a handful of public ones. Your entire home network might appear to the Internet as a single public IP.'),
          diagram(
            'INSIDE (private)                OUTSIDE (public)\n\n PC-01  192.168.1.10 ──┐\n PC-02  192.168.1.11 ──┼── Router/NAT ── 203.0.113.7 ── Internet\n PC-03  192.168.1.12 ──┘   translates\n                           each flow',
          ),
          text('NAT keeps a translation table. When PC-01 sends to a web server, the router rewrites the source address from 192.168.1.10 to its public address and remembers the mapping. Reply packets arriving for the public address are matched against the table and rewritten back.'),
          terms('NAT · Rewrites addresses as traffic crosses a border. Inside local · Your private address. Inside global · The public address the world sees. PAT · Port Address Translation - many hosts share one public IP using different ports.'),
          quiz(
            'What does PAT use to let many hosts share a single public IP?',
            ['Different subnets', 'Different port numbers', 'Different MAC addresses', 'Different default gateways'],
            1,
            'PAT (also called NAT overload) distinguishes flows by TCP/UDP port numbers, so thousands of sessions can share one public address.',
          ),
        ],
      },
      {
        id: 'nat-troubleshooting',
        title: 'Troubleshooting NAT',
        minutes: 6,
        content: [
          text('NAT failures look strange: the private network works perfectly, hosts can reach the NAT device, but traffic never arrives at the destination. That is because translation happens at the border - everything before it is normal, everything after it never happens.'),
          code(
            'R1# show ip nat translations\nPro  Inside global    Inside local     Outside local\nTCP  203.0.113.7:51022 192.168.1.10:51022 93.184.216.34:443\n\nR1# show ip nat statistics\nTotal translations: 1  (misses: 0)  - is the table even populating?',
          ),
          text('Check in order: is the translation table populating? Does the router have a route to the destination? Is the interface marked inside/outside correctly? Troubleshooting NAT means proving each step before moving on.'),
          quiz(
            'Hosts reach the Internet router, but no traffic arrives at external sites. The NAT table is empty. What does that suggest?',
            ['The hosts have wrong MAC addresses', 'The NAT rule/interface config never matches the traffic', 'The switch is flooding frames', 'DNS is broken'],
            1,
            'An empty translation table means traffic is either not reaching the NAT device or not matching the NAT configuration.',
          ),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // LEVEL 11: IPv6
  // ──────────────────────────────────────────────
  {
    id: 'ipv6',
    level: 11,
    title: 'IPv6',
    blurb: '128-bit addressing, abbreviations, address types, and SLAAC.',
    lessons: [
      {
        id: 'ipv6-basics',
        title: 'IPv6 Addresses',
        minutes: 8,
        content: [
          text('IPv6 gives every device a 128-bit address - enough for every grain of sand on Earth, many times over. Addresses are written as eight groups of four hex digits, separated by colons: 2001:0db8:0000:0000:0000:0000:0000:0001.'),
          code(
            'FULL:      2001:0db8:0000:0000:0000:ff00:0042:8329\nABBREV:    2001:db8::ff00:42:8329\n\nRules:\n  1. Drop leading zeros in each group\n  2. Replace ONE run of all-zero groups with ::\n     (:: may appear only once per address)',
          ),
          text('An IPv6 address has two halves: a network prefix (usually /64) and an interface identifier. A /64 is the standard subnet size - the entire IPv4 Internet fits into one IPv6 subnet with room to spare.'),
          terms('128-bit · Address size of IPv6. /64 · Standard subnet prefix. GUA · Global Unicast Address, the routable kind. Link-local · fe80::/10, only valid on the local link.'),
          quiz(
            'Which is a correctly abbreviated 2001:0db8:0000:0000:0000:0000:0000:0001?',
            ['2001:db8::1', '2001:db8:::1', '2001:0db8::0::1', '2001:db8:0:0:0:0:0:0:1'],
            0,
            'Leading zeros are dropped and one run of zeros becomes ::, giving 2001:db8::1.',
          ),
        ],
      },
      {
        id: 'ipv6-types',
        title: 'Address Types and SLAAC',
        minutes: 7,
        content: [
          text('Every IPv6 interface gets at least two addresses: a link-local address (fe80::/10) used for local communication and neighbor discovery, and usually a global unicast address for real traffic. Multicast replaces broadcast entirely - there is no 255.255.255.255 in IPv6.'),
          diagram(
            'SLAAC - Stateless Address Autoconfiguration\n\n PC boots ──→ Router Advertisement (RA) arrives\n              "prefix is 2001:db8:1::/64"\n              │\n PC builds:  2001:db8:1::  +  interface ID (EUI-64 or random)\n             └─ network ─┘└─── host part ───┘\n\n No DHCP server required for addressing.',
          ),
          text('SLAAC means hosts can auto-configure from router advertisements - no DHCP needed. DHCPv6 still exists for networks that want central control, but the default behavior of IPv6 is self-service addressing.'),
          terms('RA · Router Advertisement. SLAAC · Auto-configuration from RAs. ND · Neighbor Discovery, IPv6 replacement for ARP.'),
          quiz(
            'What protocol does IPv6 use instead of ARP?',
            ['DHCPv6', 'ICMPv6 Neighbor Discovery', 'RARP', 'STP'],
            1,
            'Neighbor Discovery (ND) resolves IPv6 addresses to MAC addresses and also handles router discovery.',
          ),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // LEVEL 12: NETWORK SERVICES
  // ──────────────────────────────────────────────
  {
    id: 'services',
    level: 12,
    title: 'Network Services',
    blurb: 'HTTP, SSH, NTP, syslog, and the ports that carry them.',
    lessons: [
      {
        id: 'common-services',
        title: 'The Services Every Network Runs',
        minutes: 7,
        content: [
          text('Networks exist to carry services. Each service listens on a well-known port, and memorizing the common pairs pays off in every troubleshooting session:'),
          code(
            'PORT   PROTOCOL  SERVICE\n 20/21   TCP      FTP      file transfer (legacy)\n  22     TCP      SSH      secure shell / device management\n  25     TCP      SMTP     sending email\n  53    TCP/UDP   DNS      name resolution\n  67/68   UDP      DHCP     address assignment\n  80     TCP      HTTP     web (unencrypted)\n 443     TCP      HTTPS    web (encrypted)\n 123     UDP      NTP      time sync\n 514     UDP      Syslog   device logging',
          ),
          text('Time matters more than it seems. Certificates, logs, and authentication protocols all depend on synchronized clocks - which is why NTP is usually the first service configured on real network gear. Syslog then gives you a central place to see what every device is thinking.'),
          terms('Well-known ports · 0-1023, standardized services. NTP · Network Time Protocol. Syslog · Central log collection.'),
          quiz(
            'A device shows the wrong time and its log entries are useless. Which service should you verify first?',
            ['DNS', 'HTTP', 'NTP', 'DHCP'],
            2,
            'NTP keeps clocks synchronized; without it, log timestamps and certificates break down.',
          ),
        ],
      },
      {
        id: 'secure-management',
        title: 'Managing Devices Securely',
        minutes: 6,
        content: [
          text('Older management protocols trust the network completely. Telnet sends passwords in clear text - anyone capturing traffic on the path reads them. SSH encrypts the whole session, which is why modern practice is: SSH only, never Telnet.'),
          code(
            'R1(config)# hostname R1\nR1(config)# ip domain-name corp.local\nR1(config)# crypto key generate rsa modulus 2048\nR1(config)# username admin secret <password>\nR1(config)# line vty 0 4\nR1(config-line)# transport input ssh     ← no telnet\nR1(config-line)# login local',
          ),
          text('The same logic applies everywhere: SNMPv3 instead of SNMPv2, HTTPS instead of HTTP for management pages, and management traffic on a dedicated subnet or VLAN that users cannot reach.'),
          quiz(
            'Why is SSH preferred over Telnet for device management?',
            ['SSH is faster', 'SSH encrypts the session, Telnet sends credentials in clear text', 'SSH works on UDP', 'Telnet cannot authenticate'],
            1,
            'Telnet is plaintext; anyone on the path can capture usernames and passwords. SSH encrypts everything.',
          ),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // LEVEL 13: SECURITY
  // ──────────────────────────────────────────────
  {
    id: 'security',
    level: 13,
    title: 'Network Security',
    blurb: 'ACLs, port security, firewalls, and the mindset of hardening.',
    relatedLabIds: ['acl-lab'],
    lessons: [
      {
        id: 'acls',
        title: 'Access Control Lists',
        minutes: 8,
        content: [
          text('An ACL is a list of permit/deny rules a router checks against traffic, top to bottom. The first match wins and evaluation stops. If no rule matches, the implicit "deny any" at the end of every ACL drops the packet - the most common ACL surprise.'),
          diagram(
            'access-list 101 permit tcp any host 10.1.20.10 eq 443\naccess-list 101 deny   ip  any any\n\n Packet arrives → rule 1? no match\n              → rule 2? match → DENY (implicit or explicit)\n\n Order matters: put the most specific permits first.',
          ),
          text('Standard ACLs filter on source address only and belong close to the destination. Extended ACLs filter on source, destination, protocol, and port - and belong close to the source so unwanted traffic is dropped early.'),
          terms('ACL · Ordered permit/deny rules. Implicit deny · Unmatched traffic is dropped. Wildcard mask · Inverse of a subnet mask used in ACL matching.'),
          quiz(
            'An ACL has only one line: "permit tcp host 10.1.10.5 any". Can PC 10.1.10.6 send traffic through the router?',
            ['Yes, all traffic is permitted', 'No - the implicit deny drops it', 'Yes, but only TCP', 'Only if the ACL is named'],
            1,
            'Every ACL ends with an invisible "deny any" - anything not explicitly permitted is dropped.',
          ),
        ],
      },
      {
        id: 'port-security',
        title: 'Port Security and Hardening',
        minutes: 7,
        content: [
          text('Switch ports are the physical frontier of the LAN. Port security pins a port to specific MAC addresses: if an unknown device appears, the switch can restrict or shut the port. Unused ports should be administratively shut down - an open wall socket is an open door.'),
          code(
            'SW1(config-if)# switchport port-security\nSW1(config-if)# switchport port-security maximum 2\nSW1(config-if)# switchport port-security mac-address sticky\nSW1(config-if)# switchport port-security violation shutdown',
          ),
          text('Hardening a network is layered: SSH for management, ACLs for traffic policy, port security at the edge, and firewalls between trust zones. No single control is enough - the goal is that one mistake does not become a total compromise.'),
          quiz(
            'A violation of "shutdown" mode triggers. What happens?',
            ['The offending frame is dropped, port stays up', 'The port goes into err-disabled state', 'The MAC address is whitelisted', 'The VLAN is deleted'],
            1,
            'Shutdown mode err-disables the port - it stays down until an administrator manually re-enables it.',
          ),
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────
  // LEVEL 14: FULL TROUBLESHOOTING
  // ──────────────────────────────────────────────
  {
    id: 'troubleshooting',
    level: 14,
    title: 'Full Troubleshooting',
    blurb: 'A repeatable methodology, layered diagnosis, and the final boss lab.',
    relatedLabIds: ['final-boss'],
    lessons: [
      {
        id: 'methodology',
        title: 'A Method That Always Works',
        minutes: 8,
        content: [
          text('Random poking fails on complex networks. Real engineers follow a loop: define the symptom, reproduce it, isolate the scope, test one hypothesis at a time, fix, verify - and only then move on. The scope question is the most powerful: does ANYONE reach the destination, or only me?'),
          diagram(
            'LAYERED DIAGNOSIS - bottom up\n\n L3  ping 127.0.0.1 → own IP → gateway → remote  WHERE does it break?\n L2  show interfaces   → errors? down?   check cabling & VLANs\n L1  cables, LEDs, ports\n\n "Last working hop" is your crime scene.',
          ),
          text('Write down what you tested and what you ruled out. When four faults hide in one topology, the only way through is discipline: one change at a time, verify after each, never fix two things blind.'),
          terms('Reproduce · Make the fault happen on demand. Isolate · Narrow where the path breaks. Verify · Confirm the fix actually changed behavior.'),
          quiz(
            'PC-01 cannot reach SRV-01. PC-02 and PC-03 (same switch) reach it fine. Where do you investigate first?',
            ['R-03 and the server LAN', 'PC-01 itself - its config or its switch port', 'The DNS server', 'The ISP'],
            1,
            'Neighbors on the same switch succeed, so the shared path is fine - the fault is local to PC-01 or its port.',
          ),
        ],
      },
      {
        id: 'final-boss-lesson',
        title: 'The Final Boss Lab',
        minutes: 5,
        content: [
          text('Time to put everything together. The final lab injects four simultaneous faults: a wrong gateway on PC-02, a wrong subnet mask on PC-03, a missing static route on R-01, and a wrong next-hop on R-03 - mirroring the classic morning-shift disaster.'),
          diagram(
            '                 R-01   ← missing route to servers\n                /  \\\n             SW-01  ...\n             /  \\\n          PC-01  PC-02   ← wrong gateway\n          PC-03  ← wrong subnet mask\n\n          R-03   ← wrong next hop toward PCs',
          ),
          text('Work host → switch → router. Use show ip interface brief, show ip route, show arp, ping, and traceroute. If you get stuck, ask the AI Copilot for a hint - it teaches, it does not solve for you. Good luck.'),
          quiz(
            'You fix one fault and PC-02 still fails. What is the correct next step?',
            ['Revert your fix', 'Keep fixing without retesting', 'Re-verify with ping/traceroute and find the next fault', 'Reload the lab'],
            2,
            'With multiple faults, every fix must be verified before hunting the next one - symptoms change as you repair.',
          ),
        ],
      },
    ],
  },
]