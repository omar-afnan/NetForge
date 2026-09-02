/**
 * Device Lab lesson catalogue. Every lesson validates against the REAL
 * simulated device state (CLI device or endpoint form) - a lesson is never
 * completed by clicking a button alone.
 */
import type { CliDevice, EndpointDevice } from './cli'

export interface LessonCheckCtx {
  /** Result of the last endpoint ping run by the student. */
  lastPing?: { ok: boolean; destination: string; detail: string }
  /** Set when the student opened the device's interface-details panel. */
  inspected?: boolean
}

export type LabDevice = CliDevice | EndpointDevice

export interface Lesson {
  id: string
  title: string
  difficulty: 'beginner' | 'intermediate'
  minutes: number
  description: string
  learn: string[]
  objective: string
  hint: string
  solution: string
  /** Return null when the task is genuinely complete, else "not quite" feedback. */
  check(device: LabDevice, ctx: LessonCheckCtx): string | null
  /** Optional initial scenario applied to a fresh device when the lesson opens. */
  setup?: (device: LabDevice) => void
}

export interface Course {
  kind: 'router' | 'switch' | 'server' | 'pc'
  title: string
  subtitle: string
  blurb: string
  sections: { label: string; lessons: Lesson[] }[]
}

const ran = (d: CliDevice, cmd: string) =>
  d.history.some((h) => h.toLowerCase().replace(/\s+/g, ' ').includes(cmd))

const reachedPrivileged = (d: CliDevice) =>
  d.mode !== 'user' && d.history.some((h) => h.toLowerCase() === 'enable' || h.toLowerCase() === 'en')

const routerBeginner: Lesson[] = [
  {
    id: 'r-meet',
    title: 'Meet the Router',
    difficulty: 'beginner',
    minutes: 5,
    description: 'What a router does, its interfaces, and how to inspect them.',
    learn: ['What a router does', 'Interfaces and LAN vs WAN', 'The routing table', 'CLI modes'],
    objective: 'Inspect the router: run the interface overview command on the console.',
    hint: 'The command that lists every interface with its IP address and status starts with "show".',
    solution: 'show ip interface brief',
    check: (d) => {
      const c = d as CliDevice
      if (!ran(c, 'show ip int') && !ran(c, 'show ip interface')) {
        return 'Run the interface overview on the console (try the command from the hint).'
      }
      return null
    },
  },
  {
    id: 'r-privileged',
    title: 'Enter Privileged Mode',
    difficulty: 'beginner',
    minutes: 5,
    description: 'Move from user EXEC (>) to privileged EXEC (#) mode.',
    learn: ['User EXEC vs privileged EXEC', 'Why privileged mode is gated', 'The enable command'],
    objective: 'Enter privileged EXEC mode - the prompt must end with #.',
    hint: 'From R1> type the command that "enables" privileged access.',
    solution: 'enable',
    check: (d) => {
      const c = d as CliDevice
      if (!reachedPrivileged(c)) return 'You are still in user EXEC mode. The prompt should end with #.'
      return null
    },
  },
  {
    id: 'r-hostname',
    title: 'Configure a Hostname',
    difficulty: 'beginner',
    minutes: 5,
    description: 'Rename the device in global configuration mode.',
    learn: ['Global configuration mode', 'The hostname command', 'Prompts reflect the hostname'],
    objective: 'Change the router hostname to R1-EDGE.',
    hint: 'Enter privileged mode, then "configure terminal", then set the hostname.',
    solution: 'enable\nconfigure terminal\nhostname R1-EDGE',
    check: (d) => {
      const c = d as CliDevice
      if (c.hostname !== 'R1-EDGE') return `The device is still named ${c.hostname}. The task requires R1-EDGE.`
      return null
    },
  },
  {
    id: 'r-secret',
    title: 'Configure a Password',
    difficulty: 'beginner',
    minutes: 8,
    description: 'Protect privileged mode - and learn why enable secret beats enable password.',
    learn: ['enable password stores weakly obfuscated text', 'enable secret stores an MD5 hash', 'Secret wins when both are set'],
    objective: 'Secure privileged mode with an enable secret (use "netforge").',
    hint: 'From global configuration mode: enable secret <password>.',
    solution: 'enable\nconfigure terminal\nenable secret netforge',
    check: (d) => {
      const c = d as CliDevice
      if (!c.enableSecret) {
        return c.enablePassword
          ? 'You set an enable password - but enable secret is the secure, hashed option required here.'
          : 'Privileged mode is still unprotected. Set an enable secret from global configuration mode.'
      }
      return null
    },
  },
  {
    id: 'r-console',
    title: 'Configure the Console Password',
    difficulty: 'beginner',
    minutes: 6,
    description: 'Control who can access the device through the console cable.',
    learn: ['Line configuration mode', 'line console 0', 'password + login activates the prompt'],
    objective: 'Require a password ("netforge") on the console line.',
    hint: 'Enter line configuration for console 0, set a password, then enable login.',
    solution: 'line console 0\npassword netforge\nlogin',
    check: (d) => {
      const c = d as CliDevice
      if (!c.consolePassword) return 'No console password is configured yet.'
      if (!c.consoleLogin) return 'A password is set, but "login" was never enabled - the line will not prompt for it.'
      return null
    },
  },
  {
    id: 'r-iface-ip',
    title: 'Assign an IP Address',
    difficulty: 'beginner',
    minutes: 8,
    description: 'Give GigabitEthernet0/0 an address on the 192.168.1.0/24 network.',
    learn: ['Interface configuration mode', 'ip address <ip> <mask>', 'Subnet masks define the network'],
    objective: 'Configure G0/0 with IP 192.168.1.1 and mask 255.255.255.0.',
    hint: 'Enter interface configuration mode for GigabitEthernet0/0 first.',
    solution: 'interface gigabitEthernet0/0\nip address 192.168.1.1 255.255.255.0',
    check: (d) => {
      const c = d as CliDevice
      const iface = c.interfaces.find((i) => i.name === 'GigabitEthernet0/0')!
      if (!iface.ip) return 'G0/0 has no IP address yet.'
      if (iface.ip !== '192.168.1.1' || iface.mask !== '255.255.255.0') {
        return `Your interface is configured with ${iface.ip}/${iface.mask ?? '?'}.\nThe task requires 192.168.1.1/24.`
      }
      return null
    },
  },
  {
    id: 'r-no-shut',
    title: 'Enable an Interface',
    difficulty: 'beginner',
    minutes: 5,
    description: 'Router interfaces are administratively down until you enable them.',
    learn: ['shutdown vs no shutdown', 'Administratively down state', 'Link/line protocol messages'],
    objective: 'Bring GigabitEthernet0/0 up with "no shutdown" (keep its IP).',
    hint: 'The interface must keep 192.168.1.1/24 - and change from administratively down to up.',
    solution: 'interface gigabitEthernet0/0\nno shutdown',
    check: (d) => {
      const c = d as CliDevice
      const iface = c.interfaces.find((i) => i.name === 'GigabitEthernet0/0')!
      if (iface.status !== 'up') return 'G0/0 is still administratively down - enable it.'
      if (iface.ip !== '192.168.1.1') return 'The interface is up but lost its IP address. Re-apply 192.168.1.1 255.255.255.0.'
      return null
    },
  },
  {
    id: 'r-verify',
    title: 'Verify Configuration',
    difficulty: 'beginner',
    minutes: 5,
    description: 'Confirm your work with show commands.',
    learn: ['show ip interface brief', 'Reading status vs protocol', 'show running-config'],
    objective: 'Verify: run the interface overview AND show the running configuration.',
    hint: 'Two commands: one lists interfaces, the other prints the whole running config.',
    solution: 'show ip interface brief\nshow running-config',
    check: (d) => {
      const c = d as CliDevice
      const ranBrief = ran(c, 'show ip int') || ran(c, 'show ip interface')
      const ranRun = ran(c, 'show run')
      if (!ranBrief || !ranRun) return 'Run BOTH verification commands: the interface overview and the running configuration.'
      return null
    },
  },
]

const routerIntermediate: Lesson[] = [
  {
    id: 'r-default-route',
    title: 'Configure a Default Route',
    difficulty: 'intermediate',
    minutes: 8,
    description: 'Where to send traffic that has no more-specific route.',
    learn: ['0.0.0.0/0 as "everything else"', 'The next-hop concept', 'S* in the routing table'],
    objective: 'Add a default route pointing at next-hop 192.168.1.254.',
    hint: 'ip route 0.0.0.0 0.0.0.0 <next-hop>, from global configuration mode.',
    solution: 'configure terminal\nip route 0.0.0.0 0.0.0.0 192.168.1.254',
    check: (d) => {
      const c = d as CliDevice
      const def = c.routes.find((r) => r.destination === '0.0.0.0' && r.mask === '0.0.0.0')
      if (!def) return 'No default route (0.0.0.0/0) exists in the routing table yet.'
      if (def.nextHop !== '192.168.1.254') return `Your default route points at ${def.nextHop}. The task requires 192.168.1.254.`
      return null
    },
  },
  {
    id: 'r-static-route',
    title: 'Configure a Static Route',
    difficulty: 'intermediate',
    minutes: 8,
    description: 'Teach the router about a remote network.',
    learn: ['ip route syntax', 'Remote vs directly connected networks', 'Verifying with show ip route'],
    objective: 'Reach 192.168.2.0/24 via next-hop 192.168.1.2, then verify with show ip route.',
    hint: 'Add the route, then run show ip route to see the S entry.',
    solution: 'ip route 192.168.2.0 255.255.255.0 192.168.1.2\nend\nshow ip route',
    check: (d) => {
      const c = d as CliDevice
      const route = c.routes.find((r) => r.destination === '192.168.2.0' && r.mask === '255.255.255.0')
      if (!route) return 'The 192.168.2.0/24 static route is missing.'
      if (route.nextHop !== '192.168.1.2') return `The route uses next-hop ${route.nextHop}. It must be 192.168.1.2.`
      if (!ran(c, 'show ip route')) return 'Route added - now verify it appears with show ip route.'
      return null
    },
  },
  {
    id: 'r-vty',
    title: 'Configure Remote Access (VTY)',
    difficulty: 'intermediate',
    minutes: 8,
    description: 'Protect Telnet/SSH lines - the gateway to configuring SSH later.',
    learn: ['line vty 0 4', 'Why VTY lines need their own password', 'Path to SSH: domain name + crypto keys'],
    objective: 'Password-protect the VTY lines ("netforge") and enable login.',
    hint: 'Enter line configuration for vty 0 4 - same pattern as the console.',
    solution: 'line vty 0 4\npassword netforge\nlogin',
    check: (d) => {
      const c = d as CliDevice
      if (!c.vtyPassword) return 'No VTY password is configured.'
      if (!c.vtyLogin) return 'Password set, but login is not enabled on the VTY lines.'
      return null
    },
  },
  {
    id: 'r-sec',
    title: 'Configure Login Security',
    difficulty: 'intermediate',
    minutes: 6,
    description: 'Stop plain-text passwords from appearing in the configuration.',
    learn: ['service password-encryption', 'Why type 7 is weak but better than nothing', 'Hashed secrets vs encrypted passwords'],
    objective: 'Enable password encryption service on the router.',
    hint: 'One global configuration command handles this.',
    solution: 'service password-encryption',
    check: (d) => {
      const c = d as CliDevice
      if (!c.passwordEncryption) return 'Password encryption service is not enabled.'
      return null
    },
  },
  {
    id: 'r-save',
    title: 'Save the Configuration',
    difficulty: 'intermediate',
    minutes: 5,
    description: 'Running config lives in memory; startup config survives reboots.',
    learn: ['running-config vs startup-config', 'copy running-config startup-config', 'write memory as the shortcut'],
    objective: 'Save the running configuration to startup configuration.',
    hint: 'Either copy run start or write memory works.',
    solution: 'copy running-config startup-config',
    check: (d) => {
      const c = d as CliDevice
      if (!c.startupSaved) return 'The startup configuration has not been written yet.'
      return null
    },
  },
  {
    id: 'r-fix',
    title: 'Troubleshoot an Interface',
    difficulty: 'intermediate',
    minutes: 10,
    description: 'This router was pre-configured - incorrectly. Find and fix it.',
    learn: ['Reading show ip interface brief', 'Spotting a wrong IP', 'Fixing without losing the rest'],
    objective: 'G0/0 has a WRONG address and is disabled. Correct it to 192.168.1.1/24 and bring it up.',
    hint: 'Re-enter interface configuration: set the correct IP, then no shutdown.',
    solution: 'interface gigabitEthernet0/0\nip address 192.168.1.1 255.255.255.0\nno shutdown',
    setup: (device) => {
      const c = device as CliDevice
      const iface = c.interfaces.find((i) => i.name === 'GigabitEthernet0/0')!
      iface.ip = '192.168.1.2'
      iface.mask = '255.255.255.0'
      iface.status = 'admin-down'
    },
    check: (d) => {
      const c = d as CliDevice
      const iface = c.interfaces.find((i) => i.name === 'GigabitEthernet0/0')!
      if (iface.ip !== '192.168.1.1') return `G0/0 currently has ${iface.ip ?? 'no IP'}. It must be 192.168.1.1/24.`
      if (iface.status !== 'up') return 'The IP is correct now - but the interface is still administratively down.'
      return null
    },
  },
]

const switchBeginner: Lesson[] = [
  {
    id: 's-meet',
    title: 'Meet the Switch',
    difficulty: 'beginner',
    minutes: 5,
    description: 'What a Layer 2 switch does and how to inspect its ports.',
    learn: ['MAC learning vs IP routing', 'Switch ports vs router interfaces', 'show ip interface brief'],
    objective: 'Inspect the switch: run the interface overview on the console.',
    hint: 'Same command you used on the router.',
    solution: 'show ip interface brief',
    check: (d) => {
      const c = d as CliDevice
      if (!ran(c, 'show ip int') && !ran(c, 'show ip interface')) return 'Run the interface overview on the console.'
      return null
    },
  },
  {
    id: 's-privileged',
    title: 'Enter Privileged Mode',
    difficulty: 'beginner',
    minutes: 4,
    description: 'Get to the # prompt.',
    learn: ['Privileged EXEC on a switch', 'The enable command'],
    objective: 'Enter privileged EXEC mode.',
    hint: 'enable',
    solution: 'enable',
    check: (d) => {
      const c = d as CliDevice
      if (!reachedPrivileged(c)) return 'Still in user EXEC mode - the prompt must end with #.'
      return null
    },
  },
  {
    id: 's-hostname',
    title: 'Configure a Hostname',
    difficulty: 'beginner',
    minutes: 4,
    description: 'Name the switch SW1-ACCESS.',
    learn: ['Global configuration mode', 'hostname command'],
    objective: 'Change the hostname to SW1-ACCESS.',
    hint: 'enable → configure terminal → hostname <name>.',
    solution: 'enable\nconfigure terminal\nhostname SW1-ACCESS',
    check: (d) => {
      const c = d as CliDevice
      if (c.hostname !== 'SW1-ACCESS') return `The switch is still named ${c.hostname}. Rename it to SW1-ACCESS.`
      return null
    },
  },
  {
    id: 's-secret',
    title: 'Configure a Password',
    difficulty: 'beginner',
    minutes: 5,
    description: 'Protect privileged mode on the switch.',
    learn: ['enable secret vs enable password', 'Consistent passwords across devices'],
    objective: 'Set an enable secret ("netforge").',
    hint: 'enable secret netforge - from global configuration mode.',
    solution: 'enable secret netforge',
    check: (d) => {
      const c = d as CliDevice
      if (!c.enableSecret) return 'No enable secret is configured on the switch.'
      return null
    },
  },
  {
    id: 's-mgmt',
    title: 'Configure a Management IP',
    difficulty: 'beginner',
    minutes: 8,
    description: 'Layer 2 switches are managed through a virtual interface (SVI).',
    learn: ['interface vlan 1 (management SVI)', 'Why a switch needs an IP at all', 'no shutdown on the SVI'],
    objective: 'Give Vlan1 the IP 192.168.1.2/24 and enable it.',
    hint: 'interface vlan 1 → ip address … → no shutdown.',
    solution: 'interface vlan 1\nip address 192.168.1.2 255.255.255.0\nno shutdown',
    check: (d) => {
      const c = d as CliDevice
      const svi = c.interfaces.find((i) => i.name === 'Vlan1')
      if (!svi?.ip) return 'The management SVI (Vlan1) has no IP address.'
      if (svi.ip !== '192.168.1.2' || svi.mask !== '255.255.255.0') return `Vlan1 has ${svi.ip}/${svi.mask ?? '?'}. It must be 192.168.1.2/24.`
      if (svi.status !== 'up') return 'Correct IP - now enable the SVI with no shutdown.'
      return null
    },
  },
  {
    id: 's-gw',
    title: 'Configure the Default Gateway',
    difficulty: 'beginner',
    minutes: 5,
    description: 'Let the switch answer to hosts on other subnets.',
    learn: ['ip default-gateway (Layer 2 only)', 'Why a router has routes but a switch needs a gateway'],
    objective: 'Point the switch at gateway 192.168.1.1.',
    hint: 'A single global configuration command.',
    solution: 'ip default-gateway 192.168.1.1',
    check: (d) => {
      const c = d as CliDevice
      if (c.defaultGateway !== '192.168.1.1') return `The default gateway is ${c.defaultGateway ?? 'not set'}. It must be 192.168.1.1.`
      return null
    },
  },
  {
    id: 's-verify',
    title: 'Verify Interfaces',
    difficulty: 'beginner',
    minutes: 5,
    description: 'Confirm the management SVI is live.',
    learn: ['Reading show ip interface brief on a switch', 'Vlan1 as an interface'],
    objective: 'Run the interface overview and confirm Vlan1 is up with its IP.',
    hint: 'show ip interface brief - Vlan1 should be up/up with 192.168.1.2.',
    solution: 'show ip interface brief',
    check: (d) => {
      const c = d as CliDevice
      const svi = c.interfaces.find((i) => i.name === 'Vlan1')
      if (!ran(c, 'show ip int') && !ran(c, 'show ip interface')) return 'Run show ip interface brief to verify.'
      if (svi?.status !== 'up' || svi.ip !== '192.168.1.2') return 'Vlan1 must be up with 192.168.1.2 before verification counts.'
      return null
    },
  },
]

const switchIntermediate: Lesson[] = [
  {
    id: 's-vlan',
    title: 'Create a VLAN',
    difficulty: 'intermediate',
    minutes: 6,
    description: 'Segment the switch at Layer 2.',
    learn: ['VLANs as broadcast domains', 'vlan <id> + name', 'show vlan brief'],
    objective: 'Create VLAN 10 named STUDENTS.',
    hint: 'vlan 10, then name STUDENTS - from global configuration mode.',
    solution: 'vlan 10\nname STUDENTS',
    check: (d) => {
      const c = d as CliDevice
      const vlan = c.vlans.find((v) => v.id === 10)
      if (!vlan) return 'VLAN 10 does not exist yet.'
      if (vlan.name.toUpperCase() !== 'STUDENTS') return `VLAN 10 is named "${vlan.name}". Rename it to STUDENTS.`
      return null
    },
  },
  {
    id: 's-access',
    title: 'Configure an Access Port',
    difficulty: 'intermediate',
    minutes: 7,
    description: 'Put FastEthernet0/1 into VLAN 10.',
    learn: ['switchport mode access', 'switchport access vlan', 'Access ports carry one VLAN'],
    objective: 'Make Fa0/1 an access port in VLAN 10.',
    hint: 'Two switchport commands on the interface. The VLAN must exist first.',
    solution: 'interface fastEthernet0/1\nswitchport mode access\nswitchport access vlan 10',
    check: (d) => {
      const c = d as CliDevice
      const port = c.interfaces.find((i) => i.name === 'FastEthernet0/1')!
      if (port.switchportMode !== 'access') return 'Fa0/1 is not in access mode.'
      if (port.accessVlan !== 10) return `Fa0/1 is in VLAN ${port.accessVlan ?? 1}. It must be VLAN 10.`
      return null
    },
  },
  {
    id: 's-trunk',
    title: 'Configure a Trunk',
    difficulty: 'intermediate',
    minutes: 6,
    description: 'Carry multiple VLANs across one link.',
    learn: ['Trunk vs access ports', '802.1Q tagging', 'show interfaces trunk'],
    objective: 'Make GigabitEthernet0/1 a trunk, then verify with show interfaces trunk.',
    hint: 'switchport mode trunk on the interface, then run the verification command.',
    solution: 'interface gigabitEthernet0/1\nswitchport mode trunk\nend\nshow interfaces trunk',
    check: (d) => {
      const c = d as CliDevice
      const port = c.interfaces.find((i) => i.name === 'GigabitEthernet0/1')!
      if (port.switchportMode !== 'trunk') return 'Gi0/1 is not a trunk port.'
      if (!ran(c, 'show interfaces trunk')) return 'Trunk configured - now verify with show interfaces trunk.'
      return null
    },
  },
  {
    id: 's-verify-vlan',
    title: 'Verify VLANs',
    difficulty: 'intermediate',
    minutes: 5,
    description: 'Read the VLAN table and confirm port membership.',
    learn: ['show vlan brief output', 'Which ports are in which VLAN', 'Active status'],
    objective: 'Verify: run show vlan brief with VLAN 10 present and Fa0/1 as its member.',
    hint: 'The VLAN and access port lessons must both be in place first.',
    solution: 'show vlan brief',
    check: (d) => {
      const c = d as CliDevice
      if (!ran(c, 'show vlan brief')) return 'Run show vlan brief to verify.'
      const vlan = c.vlans.find((v) => v.id === 10)
      const port = c.interfaces.find((i) => i.name === 'FastEthernet0/1')!
      if (!vlan || port.accessVlan !== 10) return 'VLAN 10 with Fa0/1 as a member must exist before this verification passes.'
      return null
    },
  },
  {
    id: 's-fix-port',
    title: 'Troubleshoot a Port',
    difficulty: 'intermediate',
    minutes: 8,
    description: 'A disabled port looks like a dead device - bring Fa0/2 back.',
    learn: ['administratively down in show output', 'no shutdown on a switch port', 'Confirming link state'],
    objective: 'Fa0/2 is administratively down. Enable it.',
    hint: 'interface fastEthernet0/2 → no shutdown.',
    solution: 'interface fastEthernet0/2\nno shutdown',
    setup: (device) => {
      const c = device as CliDevice
      const port = c.interfaces.find((i) => i.name === 'FastEthernet0/2')!
      port.status = 'admin-down'
    },
    check: (d) => {
      const c = d as CliDevice
      const port = c.interfaces.find((i) => i.name === 'FastEthernet0/2')!
      if (port.status !== 'up') return 'Fa0/2 is still administratively down.'
      return null
    },
  },
]

const serverLessons: Lesson[] = [
  {
    id: 'v-meet',
    title: 'Meet the Server',
    difficulty: 'beginner',
    minutes: 4,
    description: 'A server is an endpoint with services - inspect its network identity first.',
    learn: ['Servers as specialized hosts', 'Network identity: IP, mask, gateway, DNS', 'Reading the network panel'],
    objective: 'Open the Network panel and inspect the interface details.',
    hint: 'Expand the "Interface Details" section on the right-hand device panel.',
    solution: 'Expand Interface Details, then press Check Task.',
    check: (_d, ctx) => (ctx.inspected ? null : 'Open the Interface Details section on the device panel first.'),
  },
  {
    id: 'v-ip',
    title: 'Configure a Static IP',
    difficulty: 'beginner',
    minutes: 6,
    description: 'Servers need predictable addresses.',
    learn: ['Static vs dynamic addressing', 'Which hosts should be static', 'Applying network settings'],
    objective: 'Set the server IPv4 address to 192.168.10.10 with mask 255.255.255.0, then Apply.',
    hint: 'Fill the IPv4 Address and Subnet Mask fields in the Network panel.',
    solution: 'IPv4 Address: 192.168.10.10 · Subnet Mask: 255.255.255.0 · Apply',
    check: (d) => {
      const e = d as EndpointDevice
      if (e.ip !== '192.168.10.10' || e.mask !== '255.255.255.0') {
        return `Current settings: ${e.ip ?? 'no IP'} / ${e.mask ?? 'no mask'}. Required: 192.168.10.10 / 255.255.255.0.`
      }
      return null
    },
  },
  {
    id: 'v-gw',
    title: 'Configure the Default Gateway',
    difficulty: 'beginner',
    minutes: 5,
    description: 'The router that carries the server\'s off-subnet traffic.',
    learn: ['What a default gateway does', 'Gateways must be on your own subnet'],
    objective: 'Set the server default gateway to 192.168.10.1 and Apply.',
    hint: 'Default Gateway field in the Network panel.',
    solution: 'Default Gateway: 192.168.10.1 · Apply',
    check: (d) => {
      const e = d as EndpointDevice
      if (e.gateway !== '192.168.10.1') return `Gateway is ${e.gateway ?? 'not set'}. Required: 192.168.10.1.`
      return null
    },
  },
  {
    id: 'v-dns',
    title: 'Configure DNS',
    difficulty: 'beginner',
    minutes: 5,
    description: 'Name resolution for the services this server will run.',
    learn: ['What DNS does', 'DNS server vs DNS client settings'],
    objective: 'Set the DNS server to 192.168.10.1 and Apply.',
    hint: 'DNS field in the Network panel.',
    solution: 'DNS: 192.168.10.1 · Apply',
    check: (d) => {
      const e = d as EndpointDevice
      if (e.dns !== '192.168.10.1') return `DNS is ${e.dns ?? 'not set'}. Required: 192.168.10.1.`
      return null
    },
  },
  {
    id: 'v-ping',
    title: 'Test Connectivity',
    difficulty: 'beginner',
    minutes: 5,
    description: 'Verify the configuration with a real ping.',
    learn: ['ping as the first diagnostic', 'What a successful ping proves', 'What it does NOT prove'],
    objective: 'Ping the default gateway (192.168.10.1) successfully from the Connectivity panel.',
    hint: 'Enter the gateway address and press Run Ping. The IP, mask and gateway must all be correct first.',
    solution: 'Set IP/mask/gateway correctly, then Run Ping → 192.168.10.1',
    check: (d, ctx) => {
      const e = d as EndpointDevice
      if (!ctx.lastPing) return 'Run a ping from the Connectivity panel first.'
      if (!ctx.lastPing.ok) return `The ping to ${ctx.lastPing.destination} failed: ${ctx.lastPing.detail} Check IP, mask and gateway.`
      if (e.gateway && ctx.lastPing.destination !== e.gateway) return `You pinged ${ctx.lastPing.destination}. Ping the gateway (${e.gateway}).`
      return null
    },
  },
  {
    id: 'v-web',
    title: 'Web Server (Simulated Service)',
    difficulty: 'intermediate',
    minutes: 4,
    description: 'Enable the simulated HTTP service. This is a visual simulation - no real sockets are opened.',
    learn: ['What a web server does', 'Port 80/443 conceptually', 'Simulated vs real services in NetForge'],
    objective: 'Enable the Web (HTTP) service on the server.',
    hint: 'Toggle the Web service in the Services panel.',
    solution: 'Services panel → Web Server → Enable',
    check: (d) => {
      const e = d as EndpointDevice
      if (!e.services.web) return 'The Web (HTTP) service is not enabled.'
      return null
    },
  },
  {
    id: 'v-dnssvc',
    title: 'DNS Server (Simulated Service)',
    difficulty: 'intermediate',
    minutes: 4,
    description: 'Enable the simulated DNS service so clients can resolve names.',
    learn: ['Authoritative vs recursive DNS', 'Why a LAN often hosts its own DNS'],
    objective: 'Enable the DNS service on the server.',
    hint: 'Toggle the DNS service in the Services panel.',
    solution: 'Services panel → DNS Server → Enable',
    check: (d) => {
      const e = d as EndpointDevice
      if (!e.services.dns) return 'The DNS service is not enabled.'
      return null
    },
  },
  {
    id: 'v-dhcp',
    title: 'DHCP Server (Simulated Service)',
    difficulty: 'intermediate',
    minutes: 4,
    description: 'Enable the simulated DHCP service that would hand out addresses to clients.',
    learn: ['What DHCP provides (DORA)', 'Static for servers, DHCP for clients', 'Scope conceptually'],
    objective: 'Enable the DHCP service on the server.',
    hint: 'Toggle the DHCP service in the Services panel.',
    solution: 'Services panel → DHCP Server → Enable',
    check: (d) => {
      const e = d as EndpointDevice
      if (!e.services.dhcp) return 'The DHCP service is not enabled.'
      return null
    },
  },
]

const pcLessons: Lesson[] = [
  {
    id: 'p-ip',
    title: 'Configure IPv4',
    difficulty: 'beginner',
    minutes: 5,
    description: 'Give PC-01 an address on the 192.168.1.0/24 network.',
    learn: ['IPv4 address format', 'Every host needs a unique IP'],
    objective: 'Set PC-01 IPv4 address to 192.168.1.10 with mask 255.255.255.0, then Apply.',
    hint: 'IPv4 Address and Subnet Mask fields in the Network panel.',
    solution: 'IPv4 Address: 192.168.1.10 · Subnet Mask: 255.255.255.0 · Apply',
    check: (d) => {
      const e = d as EndpointDevice
      if (e.ip !== '192.168.1.10' || e.mask !== '255.255.255.0') {
        return `Current settings: ${e.ip ?? 'no IP'} / ${e.mask ?? 'no mask'}. Required: 192.168.1.10 / 255.255.255.0.`
      }
      return null
    },
  },
  {
    id: 'p-mask',
    title: 'Fix the Subnet Mask',
    difficulty: 'beginner',
    minutes: 6,
    description: 'PC-01 was pre-configured with a mismatched mask - correct it.',
    learn: ['Masks must match the network design', 'A wrong mask silently breaks half the network'],
    objective: 'The mask is 255.255.0.0 - it should be 255.255.255.0. Fix it and Apply.',
    hint: 'Only the Subnet Mask field needs changing.',
    solution: 'Subnet Mask: 255.255.255.0 · Apply',
    setup: (device) => {
      const e = device as EndpointDevice
      e.ip = '192.168.1.10'
      e.mask = '255.255.0.0'
    },
    check: (d) => {
      const e = d as EndpointDevice
      if (e.mask !== '255.255.255.0') return `Mask is still ${e.mask ?? 'not set'}. Required: 255.255.255.0.`
      return null
    },
  },
  {
    id: 'p-gw',
    title: 'Configure the Default Gateway',
    difficulty: 'beginner',
    minutes: 5,
    description: 'Tell PC-01 which router carries off-subnet traffic.',
    learn: ['Default gateway concept', 'Gateway must be reachable on your subnet'],
    objective: 'Set PC-01 default gateway to 192.168.1.1 and Apply.',
    hint: 'Default Gateway field in the Network panel.',
    solution: 'Default Gateway: 192.168.1.1 · Apply',
    check: (d) => {
      const e = d as EndpointDevice
      if (e.gateway !== '192.168.1.1') return `Gateway is ${e.gateway ?? 'not set'}. Required: 192.168.1.1.`
      return null
    },
  },
  {
    id: 'p-dns',
    title: 'Configure DNS',
    difficulty: 'beginner',
    minutes: 5,
    description: 'Resolve names like example.local on the network.',
    learn: ['DNS clients vs servers', 'Public vs private DNS addresses'],
    objective: 'Set PC-01 DNS to 8.8.8.8 and Apply.',
    hint: 'DNS field in the Network panel.',
    solution: 'DNS: 8.8.8.8 · Apply',
    check: (d) => {
      const e = d as EndpointDevice
      if (e.dns !== '8.8.8.8') return `DNS is ${e.dns ?? 'not set'}. Required: 8.8.8.8.`
      return null
    },
  },
  {
    id: 'p-ping',
    title: 'Test with Ping',
    difficulty: 'beginner',
    minutes: 5,
    description: 'Run a real ping through the simulator.',
    learn: ['Echo request/reply', 'Timing out vs unreachable', 'First tool in every diagnosis'],
    objective: 'Ping the default gateway successfully from the Connectivity panel.',
    hint: 'Run Ping → 192.168.1.1. The IP, mask and gateway must all be configured first.',
    solution: 'Run Ping → 192.168.1.1',
    check: (d, ctx) => {
      const e = d as EndpointDevice
      if (!ctx.lastPing) return 'Run a ping from the Connectivity panel first.'
      if (!ctx.lastPing.ok) return `The ping to ${ctx.lastPing.destination} failed: ${ctx.lastPing.detail} Check IP, mask and gateway.`
      if (e.gateway && ctx.lastPing.destination !== e.gateway) return `You pinged ${ctx.lastPing.destination}. Ping the gateway (${e.gateway}).`
      return null
    },
  },
  {
    id: 'p-diagnose',
    title: 'Diagnose Connectivity',
    difficulty: 'intermediate',
    minutes: 10,
    description: 'PC-01 cannot reach anything off-subnet. Find out why and fix it.',
    learn: ['Symptom: local works, remote fails', 'The gateway as prime suspect', 'Fix → re-test cycle'],
    objective: 'Diagnose why pinging the gateway fails, fix the configuration, and ping it successfully.',
    hint: 'Compare the configured gateway with what the subnet actually uses (192.168.1.1).',
    solution: 'Default Gateway: 192.168.1.1 · Apply · Run Ping → 192.168.1.1',
    setup: (device) => {
      const e = device as EndpointDevice
      e.ip = '192.168.1.10'
      e.mask = '255.255.255.0'
      e.gateway = '192.168.1.254'
      e.dns = '8.8.8.8'
    },
    check: (d, ctx) => {
      const e = d as EndpointDevice
      if (!ctx.lastPing || !ctx.lastPing.ok) return 'The gateway ping has not succeeded yet. Fix the configuration, then run Ping → 192.168.1.1.'
      if (e.gateway !== '192.168.1.1') return `Ping succeeded via ${e.gateway}? Set the gateway correctly to 192.168.1.1.`
      return null
    },
  },
]

export const COURSES: Course[] = [
  {
    kind: 'router',
    title: 'Router Fundamentals',
    subtitle: 'Cisco-style routers',
    blurb: 'CLI modes, passwords, interfaces, IP addressing and static routing.',
    sections: [
      { label: 'Beginner', lessons: routerBeginner },
      { label: 'Intermediate', lessons: routerIntermediate },
    ],
  },
  {
    kind: 'switch',
    title: 'Switch Essentials',
    subtitle: 'VLANs, ports and switching',
    blurb: 'Management SVI, VLANs, access and trunk ports.',
    sections: [
      { label: 'Beginner', lessons: switchBeginner },
      { label: 'Switching', lessons: switchIntermediate },
    ],
  },
  {
    kind: 'server',
    title: 'Server Administration',
    subtitle: 'Network setup and services',
    blurb: 'Static addressing, gateway, DNS and clearly-labelled simulated services.',
    sections: [
      { label: 'Basics', lessons: serverLessons.slice(0, 5) },
      { label: 'Services', lessons: serverLessons.slice(5) },
    ],
  },
  {
    kind: 'pc',
    title: 'PC / Client Setup',
    subtitle: 'Endpoint configuration',
    blurb: 'IP settings, gateway, DNS and real ping diagnostics.',
    sections: [{ label: 'Endpoint Basics', lessons: pcLessons }],
  },
]

export function allLessons(course: Course): Lesson[] {
  return course.sections.flatMap((s) => s.lessons)
}

export function findLesson(kind: string, id: string): { course: Course; lesson: Lesson } | null {
  const course = COURSES.find((c) => c.kind === kind)
  if (!course) return null
  for (const lesson of allLessons(course)) {
    if (lesson.id === id) return { course, lesson }
  }
  return null
}