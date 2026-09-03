/**
 * "Explain this" content - short, plain explanations of the networking
 * objects the lessons reference. Keyed by a stable string so an inline
 * `<ExplainPopover objectKey="subnet-mask" />` stays cheap to drop in.
 *
 * The `cidr:/N` family is generated from subnetMath.describePrefix so every
 * prefix /8../32 is explained consistently and the numbers can never drift
 * from what the CIDR visualiser shows.
 */
import { describePrefix } from '@/lib/subnetMath'

export interface ExplainContent {
  title: string
  /** Paragraphs - kept to 1-3 short lines each, never a wall of text. */
  body: string[]
  /** Optional key/value facts rendered as a small table. */
  facts?: [string, string][]
}

const STATIC: Record<string, ExplainContent> = {
  'subnet-mask': {
    title: 'Subnet mask',
    body: [
      'A 32-bit pattern that marks which bits of an address are the network and which are the host. The 1s are network, the 0s are host.',
      'A host ANDs its own address with its mask to learn its own network. It does the same with a destination to decide "local, or send to the gateway?".',
    ],
    facts: [
      ['/24', '255.255.255.0'],
      ['/26', '255.255.255.192'],
      ['/30', '255.255.255.252'],
    ],
  },
  cidr: {
    title: 'CIDR notation',
    body: [
      'CIDR writes the mask as a slash and a number: the count of leading 1-bits. /24 means the first 24 bits are the network.',
      'It replaced the old fixed A/B/C classes - any prefix length from /0 to /32 is allowed, so networks can be sized to fit.',
    ],
  },
  gateway: {
    title: 'Default gateway',
    body: [
      'The router address a host sends packets to when the destination is NOT on its own subnet.',
      'It must sit on the same subnet as the host. A wrong gateway breaks everything remote while local traffic keeps working - the classic symptom.',
    ],
  },
  'network-address': {
    title: 'Network address',
    body: [
      'The first address in a block - every host bit set to 0. It names the network itself and is never assigned to a device.',
    ],
  },
  broadcast: {
    title: 'Broadcast address',
    body: [
      'The last address in a block - every host bit set to 1. A packet sent here reaches every host on that subnet, so it is never assigned to a device.',
    ],
  },
  arp: {
    title: 'ARP',
    body: [
      'Address Resolution Protocol. A host knows the destination IP but needs its MAC to build a frame.',
      'It broadcasts "who has 192.168.1.1?"; the owner replies with its MAC; the answer is cached for a few minutes.',
    ],
  },
  mac: {
    title: 'MAC address',
    body: [
      'A 48-bit hardware address burned into a network interface, written as six hex pairs (00:1A:2B:3C:4D:5E).',
      'It only has meaning on the local link - every routed hop rewrites the frame with new MAC addresses.',
    ],
  },
  route: {
    title: 'Route',
    body: [
      'A routing-table entry: "to reach network X, send packets to next-hop Y (out interface Z)".',
      'Connected routes appear automatically for a router\'s own interfaces; static routes are added by hand.',
    ],
  },
  router: {
    title: 'Router',
    body: [
      'Connects different networks and forwards packets between them by destination IP.',
      'Each router interface ends a broadcast domain, so broadcasts on one side never leak to the other.',
    ],
  },
  switch: {
    title: 'Switch',
    body: [
      'Connects devices inside one LAN and forwards frames by MAC address.',
      'It learns which port each MAC lives on by watching traffic; unknown destinations are flooded to every port until learned.',
    ],
  },
}

/**
 * Resolve an object key to its explanation. `cidr:/N` (N = 8..32) is built
 * on the fly from the subnet math.
 */
export function getExplainContent(objectKey: string): ExplainContent | null {
  if (objectKey.startsWith('cidr:/')) {
    const prefix = Number(objectKey.slice('cidr:/'.length))
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null
    const f = describePrefix(prefix)
    return {
      title: `CIDR prefix /${prefix}`,
      body: [
        `The /${prefix} means the first ${f.networkBits} bits of the address are the network. The remaining ${f.hostBits} bits number the hosts.`,
        ...(f.note ? [f.note] : []),
      ],
      facts: [
        ['Network bits', String(f.networkBits)],
        ['Host bits', String(f.hostBits)],
        ['Subnet mask', f.mask],
        ['Total addresses', f.totalAddresses.toLocaleString()],
        ['Usable hosts', f.usableHosts.toLocaleString()],
      ],
    }
  }
  return STATIC[objectKey] ?? null
}
