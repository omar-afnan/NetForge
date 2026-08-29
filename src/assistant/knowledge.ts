export interface KnowledgeEntry {
  keywords: RegExp
  title: string
  body: string
}

/**
 * Student-friendly networking explanations. The assistant answers concept
 * questions from this curated set so answers stay accurate and levelled
 * for beginners instead of generic chatbot prose.
 */
export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    keywords: /\bdefault gateway\b|\bgateway\b/,
    title: 'Default Gateway',
    body: [
      'A default gateway is the router a device sends traffic to when the destination is on a different network.',
      '',
      '• Same subnet → the device talks directly (ARP + Ethernet).',
      '• Different subnet → the device hands the packet to its gateway.',
      '',
      'If the gateway is missing or wrong, a device can chat with its neighbours but never leave its own subnet — the classic "can ping locally, nothing else works" symptom.',
    ].join('\n'),
  },
  {
    keywords: /\bsubnet(ting| mask|s)?\b/,
    title: 'Subnets & Subnet Masks',
    body: [
      'A subnet mask splits an IP address into a network part and a host part.',
      '',
      'Example: 192.168.1.10 with mask 255.255.255.0 → network 192.168.1.0, hosts .1–.254.',
      '',
      'Two devices can only talk directly if they are in the SAME subnet. Otherwise traffic must go through a router (the gateway). Most "why can\'t these two ping each other" problems are a mask or gateway mistake.',
    ].join('\n'),
  },
  {
    keywords: /\bcidr\b|\bprefix\b/,
    title: 'CIDR Notation',
    body: [
      'CIDR writes the mask as the number of 1-bits: /24 = 255.255.255.0, /30 = 255.255.255.252, /16 = 255.255.0.0.',
      '',
      'Useful sizes:',
      '• /24 → 254 hosts (typical LAN)',
      '• /30 → 2 hosts (router-to-router links)',
      '• /32 → a single address',
    ].join('\n'),
  },
  {
    keywords: /\barp\b/,
    title: 'ARP (Address Resolution Protocol)',
    body: [
      'ARP answers the question: "who has IP x.x.x.x? Tell me your MAC address."',
      '',
      'Before any IP packet leaves on Ethernet, the device needs the destination (or gateway) MAC. If ARP fails, the ping dies immediately — usually meaning the target IP does not exist on that segment, or the link/interface is down.',
      '',
      'Inspect it with `show arp` in the terminal or the ARP section in the device panel.',
    ].join('\n'),
  },
  {
    keywords: /\bmac (address|table)\b|\bmac\b/,
    title: 'MAC Addresses',
    body: [
      'A MAC address is the hardware identity of a network interface (e.g. 00:1A:2B:3C:4D:5E). It works at Layer 2 and only matters on the local segment.',
      '',
      'Switches learn which MAC lives on which port and build a MAC address table to forward frames only out of the right port.',
    ].join('\n'),
  },
  {
    keywords: /\bvlan\b/,
    title: 'VLANs',
    body: [
      'A VLAN is a logical grouping of ports into its own broadcast domain. Devices in different VLANs cannot talk directly even on the same switch — they need a router (or Layer-3 switch).',
      '',
      'This simulator models one flat broadcast domain per shared segment, so VLAN tagging is not required in the current labs.',
    ].join('\n'),
  },
  {
    keywords: /\bstatic route\b|\brouting table\b|\brouting\b/,
    title: 'Routing & Static Routes',
    body: [
      'Routers forward packets using their routing table. Each entry says: "network X is reachable via next-hop Y".',
      '',
      '• Connected routes appear automatically for every configured, up interface.',
      '• Static routes are added by hand: destination + mask + next hop.',
      '',
      'If a router has no route for a destination, it drops the packet with "No route to destination". Adding the missing static route (on the hop where the lookup fails) fixes it.',
    ].join('\n'),
  },
  {
    keywords: /\bdefault route\b/,
    title: 'Default Route',
    body: [
      'A default route (0.0.0.0/0) is the route used when nothing more specific matches — the router\'s version of a default gateway.',
      '',
      'Add one when a stub router only has one exit: destination 0.0.0.0, mask 0.0.0.0, next hop = neighbour router.',
    ].join('\n'),
  },
  {
    keywords: /\bswitch(es|ing)?\b/,
    title: 'Switches',
    body: [
      'Switches work at Layer 2: they forward frames using MAC addresses and never touch IP routing.',
      '',
      'All ports on a switch share one broadcast domain. A switch passing traffic between a PC and a router does not need an IP itself — management IPs are optional.',
    ].join('\n'),
  },
  {
    keywords: /\brouters?\b/,
    title: 'Routers',
    body: [
      'Routers work at Layer 3: every interface is its own network, and the router moves packets BETWEEN networks using its routing table.',
      '',
      'Each router interface needs an IP in the subnet of the network it connects to, and the interface must be up.',
    ].join('\n'),
  },
  {
    keywords: /\btcp\b/,
    title: 'TCP',
    body: [
      'TCP is a connection-oriented transport protocol: it guarantees ordered, reliable delivery using handshakes, sequence numbers and retransmissions.',
      '',
      'Used by HTTP, SSH, SMTP… Ports identify the service (80 = HTTP, 22 = SSH).',
    ].join('\n'),
  },
  {
    keywords: /\budp\b/,
    title: 'UDP',
    body: [
      'UDP is a connectionless transport protocol: fast, no delivery guarantee, no handshake.',
      '',
      'Used by DNS, DHCP, streaming, games. ICMP (ping) is its own thing but similarly lightweight.',
    ].join('\n'),
  },
  {
    keywords: /\bports?\b/,
    title: 'Ports',
    body: [
      'A port is a 16-bit number that identifies an application on a host (Layer 4).',
      '',
      'Well-known examples: 80/443 HTTP(S), 22 SSH, 53 DNS, 67/68 DHCP. The same IP can serve many services at once because ports multiplex them.',
    ].join('\n'),
  },
  {
    keywords: /\bbroadcast domain\b|\bbroadcast\b/,
    title: 'Broadcast Domains',
    body: [
      'A broadcast domain is the set of devices that receive each other\'s broadcast frames.',
      '',
      '• A switch extends one broadcast domain across all its ports.',
      '• A router ENDS a broadcast domain — broadcasts never cross it.',
      '',
      'That\'s one reason routers (or VLANs) are used to segment large networks.',
    ].join('\n'),
  },
  {
    keywords: /\bnat\b/,
    title: 'NAT',
    body: [
      'NAT (Network Address Translation) rewrites source/destination IP addresses, usually so many private addresses can share one public IP.',
      '',
      'Not simulated in the current labs — everything here uses routable private addressing directly.',
    ].join('\n'),
  },
  {
    keywords: /\bping\b|\bicmp\b/,
    title: 'Ping & ICMP',
    body: [
      'Ping sends ICMP Echo Request packets and waits for Echo Replies — the standard "is this reachable?" test.',
      '',
      'A failing ping is a clue, not an answer. Ask me "why can\'t X ping Y" and I\'ll walk the path hop by hop to find where packets die.',
    ].join('\n'),
  },
  {
    keywords: /\btraceroute\b/,
    title: 'Traceroute',
    body: [
      'Traceroute lists every router a packet crosses on the way to a destination — and where the journey stops.',
      '',
      'The last hop shown before failure is usually where the problem lives. You can also read the path via the Traffic view after a ping.',
    ].join('\n'),
  },
]

export function lookupKnowledge(concept: string | undefined): KnowledgeEntry | undefined {
  if (!concept) return undefined
  return KNOWLEDGE.find((entry) => entry.keywords.test(concept))
}

