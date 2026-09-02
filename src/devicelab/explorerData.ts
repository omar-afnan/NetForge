/**
 * Device Explorer — hotspot definitions for each Device Lab device.
 *
 * The data drives the reusable DeviceExplorer component — only the hotspot
 * arrays differ per device; the interactive visual + info panel logic is shared.
 */
import type { DeviceKind } from '@/store/deviceLabStore'

export interface Hotspot {
  id: string
  name: string
  summary: string
  explanation: string
  networkingRelevance: string
  relatedLessonId?: string
}

// ── PC / Client ──────────────────────────────────────────────────────────────

export const pcHotspots: Hotspot[] = [
  {
    id: 'nic',
    name: 'Network Adapter',
    summary: 'The NIC connects this PC to a network.',
    explanation:
      'A Network Interface Card (NIC), sometimes called a network adapter, is the hardware that allows a computer to send and receive data over a network. Every NIC has a unique MAC address burned into it at the factory.',
    networkingRelevance:
      'Without a NIC a computer cannot connect to any network — wired or wireless. The NIC is the physical door through which all network traffic passes.',
    relatedLessonId: 'p-ip',
  },
  {
    id: 'ethernet-port',
    name: 'Ethernet Port',
    summary: 'The wired plug for connecting to a LAN.',
    explanation:
      'The RJ-45 Ethernet port is where you plug in a network cable to connect the PC to a switch, router, or another networking device. It supports 100 Mbps (Fast Ethernet) or 1 Gbps (Gigabit Ethernet).',
    networkingRelevance:
      'In most office and lab environments, devices use wired Ethernet for reliability and speed. The Ethernet cable carries the signals between your PC and the network device it needs to reach.',
    relatedLessonId: 'p-ip',
  },
  {
    id: 'mac-address',
    name: 'MAC Address',
    summary: "Your PC's permanent hardware identity on the LAN.",
    explanation:
      'A Media Access Control address is a 48-bit identifier assigned to the NIC at the factory, written as six pairs of hexadecimal digits (e.g. 00:1B:44:11:3A:C4). Unlike an IP address, a MAC address never changes and stays local to your network segment.',
    networkingRelevance:
      'Switches use MAC addresses to forward frames to the correct port. When your PC sends a packet, the switch reads the destination MAC to decide which physical port to forward the frame out of.',
    relatedLessonId: 'p-ping',
  },
  {
    id: 'gateway',
    name: 'Default Gateway',
    summary: "The router's IP address — your PC's way off the local network.",
    explanation:
      'The default gateway is the IP address of the router that sits between your local network and every other network — including the Internet. When your PC needs to send traffic to an address that is not on your local subnet, it forwards the packet to the gateway.',
    networkingRelevance:
      'Without a correct default gateway, your PC can only talk to devices on its own subnet. It cannot reach the Internet or any remote network. Configuring the gateway is one of the first steps in IP setup.',
    relatedLessonId: 'p-gw',
  },
]

// ── Router ───────────────────────────────────────────────────────────────────

export const routerHotspots: Hotspot[] = [
  {
    id: 'wan-interface',
    name: 'WAN Interface',
    summary: 'Connects the router to an external Wide Area Network.',
    explanation:
      'A WAN interface on a router connects to an external network — typically an ISP, another remote site, or the Internet. In NetForge the router models a typical small-office WAN link (e.g. an Ethernet interface facing the ISP).',
    networkingRelevance:
      "The WAN interface is the router's connection to the outside world. Traffic destined for any network beyond the local LAN must pass through this interface.",
    relatedLessonId: 'r-iface-ip',
  },
  {
    id: 'lan-interface',
    name: 'LAN Interface',
    summary: 'Connects the router to the local network (your PCs and switches).',
    explanation:
      'A LAN interface on a router connects to devices on the local network — PCs, servers, and switches. In most home and small-office routers this is a built-in Ethernet switch. In enterprise routers it is one or more individually configurable Ethernet interfaces.',
    networkingRelevance:
      'The LAN interface is what makes the router the default gateway for your local devices. Without it, local hosts would have no way to send traffic through the router.',
    relatedLessonId: 'r-iface-ip',
  },
  {
    id: 'routing-table',
    name: 'Routing Table',
    summary: "The router's decision-making map for where to send traffic.",
    explanation:
      'A routing table lists known destination networks, the subnet mask for each, and the next-hop IP address or outgoing interface used to reach that destination. The router consults this table for every packet it processes.',
    networkingRelevance:
      'Routing tables are how routers make forwarding decisions. Without entries the router does not know how to reach remote networks. Static routes are added manually; dynamic routing protocols populate the table automatically.',
    relatedLessonId: 'r-static-route',
  },
  {
    id: 'console-port',
    name: 'Console Port',
    summary: 'The physical port used to configure the router via CLI.',
    explanation:
      'The console port is used to connect a PC directly to the router for initial configuration. It provides out-of-band access — you can reach the device even when the network is completely down.',
    networkingRelevance:
      'In production networks the console port is used for initial setup and disaster recovery. In NetForge you use the console (modelled as a terminal panel) to type Cisco IOS commands and configure the device.',
    relatedLessonId: 'r-meet',
  },
]

// ── Switch ───────────────────────────────────────────────────────────────────

export const switchHotspots: Hotspot[] = [
  {
    id: 'switch-ports',
    name: 'Ethernet Ports',
    summary: 'The ports that connect endpoints and other devices to the switch.',
    explanation:
      'A managed switch has multiple Ethernet ports. Each port can be individually configured for speed, duplex, and VLAN membership. Ports are the physical entry points for every device on the LAN.',
    networkingRelevance:
      'Switch ports are the foundation of any wired LAN. Understanding access ports (one VLAN, one device) versus trunk ports (multiple VLANs, switch-to-switch) is core to network design.',
    relatedLessonId: 's-access',
  },
  {
    id: 'port-leds',
    name: 'Link & Activity Indicators',
    summary: 'LED lights that show port status and traffic activity.',
    explanation:
      'LED indicators on each port show whether a cable is connected, whether the link is up, and whether traffic is passing through. Green typically means a link is established; amber may indicate a speed issue or an administratively disabled port.',
    networkingRelevance:
      'In real networks, port LEDs are your first troubleshooting tool. A dark port means no physical link; blinking lights mean active traffic. In NetForge the device panels show link state and the CLI shows interface status.',
    relatedLessonId: 's-meet',
  },
  {
    id: 'management-interface',
    name: 'Management Interface (SVI)',
    summary: 'A virtual interface for managing the switch over the network.',
    explanation:
      'A Switch Virtual Interface (SVI) is a logical Layer-3 interface on a managed switch. It gives the switch an IP address, allowing you to manage it remotely via SSH or telnet instead of walking to the console port.',
    networkingRelevance:
      'Without a management IP, you would have to connect a console cable to every switch to manage it. An SVI makes it possible to manage the whole network from a central location.',
    relatedLessonId: 's-mgmt',
  },
  {
    id: 'vlan',
    name: 'VLAN Concept',
    summary: 'Virtual LANs segment one physical switch into multiple isolated networks.',
    explanation:
      'A Virtual LAN (VLAN) logically separates devices on the same physical switch so they cannot communicate directly unless explicitly routed. Devices in VLAN 10 cannot reach devices in VLAN 20 without a router — even though they are plugged into the same switch.',
    networkingRelevance:
      'VLANs are fundamental to modern network design. They let one switch serve multiple departments or security zones, reduce broadcast domains, and improve performance and security. In NetForge you will configure VLANs and assign ports to them.',
    relatedLessonId: 's-vlan',
  },
]

// ── Server ───────────────────────────────────────────────────────────────────

export const serverHotspots: Hotspot[] = [
  {
    id: 'network-interfaces',
    name: 'Network Interfaces',
    summary: "The server's NICs — how it connects to the network.",
    explanation:
      'A server typically has one or more Ethernet network interfaces. Each interface can be assigned its own IP address and connected to different VLANs or subnets. Servers that need high availability or to serve multiple networks use multiple interfaces.',
    networkingRelevance:
      'Servers are the shared resources of a network — they host websites, DNS records, DHCP leases, and files. Each network interface gives the server a presence on the network so clients can reach those services.',
    relatedLessonId: 'v-ip',
  },
  {
    id: 'ip-config',
    name: 'IP Configuration',
    summary: "IP address, subnet mask, and gateway — the server's network identity.",
    explanation:
      'Like any network device, a server needs an IP address (its identity on the network), a subnet mask (to know which addresses are local), and a default gateway (to reach networks beyond the local subnet). These settings are configured statically or obtained via DHCP.',
    networkingRelevance:
      "Without a correct IP configuration, clients cannot reach the server's services. A server with the wrong gateway cannot respond to clients on remote subnets. Getting the IP settings right is the first step before any network service can function.",
    relatedLessonId: 'v-ip',
  },
  {
    id: 'dns-service',
    name: 'DNS Service',
    summary: 'The Domain Name System maps hostnames to IP addresses.',
    explanation:
      "DNS is the phonebook of the Internet. When you type a hostname like 'www.example.com', a DNS server translates it to an IP address so your PC knows where to connect. Without DNS, users would have to memorise IP addresses.",
    networkingRelevance:
      'DNS servers allow clients to reach services by name instead of by IP address. A local DNS server can cache responses to speed up repeated lookups and provide internal hostname resolution for company resources.',
    relatedLessonId: 'v-dns',
  },
  {
    id: 'dhcp-service',
    name: 'DHCP Service',
    summary: 'Automatically assigns IP addresses to clients on the network.',
    explanation:
      'DHCP (Dynamic Host Configuration Protocol) automatically assigns IP addresses, subnet masks, default gateways, and DNS server addresses to devices that join the network. This removes the need to configure IP settings manually on every PC.',
    networkingRelevance:
      'DHCP is what makes large networks practical. Imagine manually configuring IP on every device in a building with 500 computers. DHCP servers lease addresses from a pool and renew them automatically.',
    relatedLessonId: 'v-dhcp',
  },
]

// ── Lookup map ────────────────────────────────────────────────────────────────

export const explorerHotspots: Record<DeviceKind, Hotspot[]> = {
  pc: pcHotspots,
  router: routerHotspots,
  switch: switchHotspots,
  server: serverHotspots,
}

/** The first lesson to open when the student clicks "Start Configuration". */
export const explorerFirstLesson: Record<DeviceKind, string> = {
  pc: 'p-ip',
  router: 'r-meet',
  switch: 's-meet',
  server: 'v-meet',
}
