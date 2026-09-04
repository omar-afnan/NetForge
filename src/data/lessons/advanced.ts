import type { InteractiveLesson } from './types'

/**
 * Later-stage concept labs that build on the fundamentals: VLSM (right-sizing
 * subnets), port numbers, and the full encapsulation / packet journey. Same
 * step model as the other interactive lessons.
 */

export const VLSM_LESSON: InteractiveLesson = {
  id: 'vlsm',
  labNumber: 'LAB 17',
  title: 'VLSM: Right-Sizing Subnets',
  subtitle: 'Stop wasting address space',
  minutes: 9,
  outcomes: [
    'Why one prefix for every subnet wastes addresses',
    'How to pick a prefix per department from its host count',
    'The "biggest first, aligned to its own size" allocation order',
    'How much room right-sizing leaves for growth',
  ],
  concepts: ['cidr', 'subnet-masks', 'network-addresses'],
  steps: [
    {
      id: 'the-problem',
      kind: 'teach',
      title: 'One size does not fit all',
      body: 'Basic subnetting cuts a network into equal pieces. But a WAN link needs 2 addresses and a big office needs 200 - giving both the same /26 throws most of the space away. VLSM (Variable-Length Subnet Masking) sizes each subnet to its own need.',
      diagram:
        'Engineering  60 hosts        Sales  25 hosts\nHR           10 hosts        WAN link  2 hosts\n\nEqual /26 for all -> lots of unused addresses\nVLSM             -> a prefix that fits each one',
      concept: 'cidr',
    },
    {
      id: 'compare',
      kind: 'interact',
      title: 'Equal size vs VLSM, on one /24',
      body: 'Toggle between the two plans. Watch the wasted-address count - and the free space left for later - change.',
      widget: 'vlsm-compare',
      concept: 'network-addresses',
    },
    {
      id: 'check-prefix',
      kind: 'question',
      title: 'Checkpoint: sizing a subnet',
      question: {
        prompt: 'Sales needs 25 hosts. What is the smallest subnet (largest prefix) that fits them, with room for the network and broadcast addresses?',
        options: ['/25', '/26', '/27', '/28'],
        answerIndex: 2,
        explain:
          'A /27 has 5 host bits -> 2^5 = 32 addresses, 30 usable. That covers 25 hosts with a little headroom. A /28 (14 usable) is too small.',
      },
      concept: 'subnet-masks',
    },
    {
      id: 'check-order',
      kind: 'question',
      title: 'Checkpoint: allocation order',
      question: {
        prompt: 'When you hand out VLSM subnets from one block, which department do you place first?',
        options: [
          'The smallest one, to get it out of the way',
          'The largest one, so its aligned block is not blocked by a smaller subnet',
          'Alphabetical order',
          'It does not matter',
        ],
        answerIndex: 1,
        explain:
          'Each subnet must start on a multiple of its own size. Place the biggest first and every later, smaller block still has an aligned slot. Do it the other way and a small subnet can straddle where a big one needed to begin.',
      },
      concept: 'network-addresses',
    },
    {
      id: 'practice',
      kind: 'practice',
      title: 'Practice: allocate the office',
      body: 'Size a subnet for each department out of one /24 - big enough, no bigger.',
      concept: 'network-addresses',
      widgetProps: {
        base: '192.168.10.0/24',
        title: 'Right-size four departments',
        departments: [
          { id: 'eng', name: 'Engineering', need: 60 },
          { id: 'sales', name: 'Sales', need: 25 },
          { id: 'hr', name: 'HR', need: 10 },
          { id: 'wan', name: 'WAN link', need: 2 },
        ],
      },
    },
    {
      id: 'recap',
      kind: 'teach',
      title: 'VLSM in one line',
      body: 'Pick each subnet\'s prefix from its host count, allocate largest first, align every block to its own size. Same address space, far less waste, room to grow.',
      concept: 'cidr',
    },
  ],
}

export const PORTS_LESSON: InteractiveLesson = {
  id: 'ports',
  labNumber: 'LAB 18',
  title: 'Port Numbers',
  subtitle: 'Which program gets the packet',
  minutes: 6,
  outcomes: [
    'What a port number identifies (and what the IP identifies)',
    'How one machine runs many services on one address',
    'The common well-known ports',
    'What happens to a packet for a port nothing is listening on',
  ],
  concepts: ['ports'],
  steps: [
    {
      id: 'ip-vs-port',
      kind: 'teach',
      title: 'The IP is the building; the port is the door',
      body: 'An IP address gets a packet to the right machine. But that machine may run a web server, a DNS server and an SSH daemon at once. The destination port number picks which one.',
      diagram: '203.0.113.9 : 443\n└── host ──┘   └ service ┘',
      concept: 'ports',
    },
    {
      id: 'delivery',
      kind: 'interact',
      title: 'Same address, different doors',
      body: 'Step through a few packets arriving at one server. Watch the destination port decide where each one goes.',
      widget: 'port-delivery',
      concept: 'ports',
    },
    {
      id: 'check-wellknown',
      kind: 'question',
      title: 'Checkpoint: well-known ports',
      question: {
        prompt: 'A packet arrives with destination port 53. What service is it most likely for?',
        options: ['HTTP', 'SSH', 'DNS', 'HTTPS'],
        answerIndex: 2,
        explain:
          'Port 53 is DNS. The common pairs worth knowing: 22 SSH, 53 DNS, 80 HTTP, 443 HTTPS, 67/68 DHCP. These are conventions - a service can use any port, but clients expect the standard one.',
      },
      concept: 'ports',
    },
    {
      id: 'check-closed',
      kind: 'question',
      title: 'Checkpoint: no one listening',
      question: {
        prompt: 'A TCP packet arrives for port 8080, but no program is listening on 8080. What happens?',
        options: [
          'The server picks another port automatically',
          'The connection is refused',
          'The packet is silently delivered to port 80',
          'The whole server restarts',
        ],
        answerIndex: 1,
        explain:
          'With nothing bound to the port, the OS rejects the connection (a TCP RST - "connection refused"). This is exactly what a port scanner uses to tell an open port from a closed one.',
      },
      concept: 'ports',
    },
    {
      id: 'recap',
      kind: 'teach',
      title: 'Ports in one line',
      body: 'IP finds the host, port finds the program. Servers listen on well-known ports; clients pick a random high port for their end of each connection.',
      concept: 'ports',
    },
  ],
}

export const PACKET_JOURNEY_LESSON: InteractiveLesson = {
  id: 'packet-journey',
  labNumber: 'LAB 19',
  title: 'The Packet Journey',
  subtitle: 'Encapsulation, layer by layer',
  minutes: 7,
  outcomes: [
    'What each layer adds as data goes down the stack',
    'The names: segment, packet, frame',
    'Why the frame is rebuilt at every hop but the packet is not',
    'How the far end unwraps it back to the original data',
  ],
  concepts: ['encapsulation'],
  steps: [
    {
      id: 'the-stack',
      kind: 'teach',
      title: 'Every layer wraps the one above it',
      body: 'Sending data is like putting a letter in an envelope, then a mailbag, then a truck. Each layer adds just the addressing the next device needs, and nothing more.',
      diagram:
        'application data\n  + transport header (ports)   -> TCP segment\n  + network header (IP)         -> IP packet\n  + data-link header (MAC) +FCS -> Ethernet frame -> on the wire',
      concept: 'encapsulation',
    },
    {
      id: 'wrap',
      kind: 'interact',
      title: 'Wrap it, send it, unwrap it',
      body: 'Step down the stack one layer at a time, then watch the destination strip it all back off.',
      widget: 'encapsulation',
      concept: 'encapsulation',
    },
    {
      id: 'check-names',
      kind: 'question',
      title: 'Checkpoint: what is it called?',
      question: {
        prompt: 'Data that has a TCP header and an IP header, but no MAC header yet, is called a...',
        options: ['Frame', 'Packet', 'Segment', 'Bit'],
        answerIndex: 1,
        explain:
          'Add the transport header -> segment. Add the network (IP) header -> packet. Add the data-link (MAC) header -> frame. The name tells you which headers are on.',
      },
      concept: 'encapsulation',
    },
    {
      id: 'check-hop',
      kind: 'question',
      title: 'Checkpoint: what changes at a router',
      question: {
        prompt: 'A packet passes through a router. Which headers does the router replace?',
        options: [
          'The IP header (new source and destination IP)',
          'The Ethernet frame (new source and destination MAC for the next hop)',
          'The TCP header (new ports)',
          'None - it forwards the frame untouched',
        ],
        answerIndex: 1,
        explain:
          'The router strips the incoming frame and builds a new one addressed to the next hop\'s MAC. The IP packet inside - source and destination IP, ports, data - is unchanged end to end.',
      },
      concept: 'encapsulation',
    },
    {
      id: 'recap',
      kind: 'teach',
      title: 'The journey in one line',
      body: 'Down the stack, each layer adds its header; across the network, only the frame is rewritten hop by hop; up the stack at the far end, each layer removes its own header until the application has its data back.',
      concept: 'encapsulation',
    },
  ],
}

export const ADVANCED_LESSONS: InteractiveLesson[] = [VLSM_LESSON, PORTS_LESSON, PACKET_JOURNEY_LESSON]
