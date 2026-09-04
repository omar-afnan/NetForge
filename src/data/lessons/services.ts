import type { InteractiveLesson } from './types'

/**
 * The network-service concept labs: DHCP, DNS, NAT and ICMP/ping. Same step
 * model as the other interactive lessons - short teach, learner-paced
 * animation, checkpoint that reinforces the reasoning, recap. Hosted by
 * InteractiveLessonRunner; none has a bespoke practice surface, so each ends
 * on a recap step.
 */

export const DHCP_LESSON: InteractiveLesson = {
  id: 'dhcp',
  labNumber: 'LAB 09',
  title: 'Understanding DHCP',
  subtitle: 'How a device gets its address automatically',
  minutes: 7,
  outcomes: [
    'Why a brand-new client has to broadcast',
    'The four DORA messages, step by step',
    'What a client receives besides an IP address',
    'What a lease is and why it expires',
  ],
  concepts: ['dhcp'],
  steps: [
    {
      id: 'why-dhcp',
      kind: 'teach',
      title: 'Nobody types an IP into every device',
      body: 'Without DHCP you would manually set an address, mask, gateway and DNS on every phone, laptop and printer. DHCP hands all four out automatically the moment a device connects.',
      diagram:
        'New device  ->  no IP  ->  DHCP  ->  ip + mask + gateway + dns + lease time',
      concept: 'dhcp',
    },
    {
      id: 'dora',
      kind: 'interact',
      title: 'DORA: Discover, Offer, Request, Acknowledge',
      body: 'Step through the four messages. Notice the first one is a broadcast - the client has no address yet, so it cannot send a normal unicast packet.',
      widget: 'dhcp-dora',
      concept: 'dhcp',
    },
    {
      id: 'check-broadcast',
      kind: 'question',
      title: 'Checkpoint: why broadcast?',
      question: {
        prompt: 'Why must the first DHCP message (DISCOVER) be a broadcast?',
        options: [
          'Broadcasts are faster than unicast',
          'The client has no IP address yet and does not know the server\'s address',
          'DHCP servers only listen to broadcasts',
          'To reach servers on other subnets',
        ],
        answerIndex: 1,
        explain:
          'A unicast packet needs a source and destination address. The client has neither yet - no address of its own, and no idea where the server is - so it shouts to everyone on the segment.',
      },
      concept: 'dhcp',
    },
    {
      id: 'check-lease',
      kind: 'question',
      title: 'Checkpoint: what arrives in the ACK',
      question: {
        prompt: 'Besides an IP address, what does the DHCP ACK typically deliver?',
        options: [
          'Only the IP address',
          'Subnet mask, default gateway, DNS server and a lease time',
          'A MAC address',
          'The full routing table',
        ],
        answerIndex: 1,
        explain:
          'DHCP configures the whole network identity: address, mask, gateway and DNS - plus a lease time. When half the lease elapses the client tries to renew, so addresses get reused as devices come and go.',
      },
      concept: 'dhcp',
    },
    {
      id: 'recap',
      kind: 'teach',
      title: 'DHCP in one line',
      body: 'A new client broadcasts, a server leases it a full configuration, and the lease expires so addresses can be recycled. Four messages: Discover, Offer, Request, Acknowledge.',
      concept: 'dhcp',
    },
  ],
}

export const DNS_LESSON: InteractiveLesson = {
  id: 'dns',
  labNumber: 'LAB 10',
  title: 'Understanding DNS',
  subtitle: 'Turning names into addresses',
  minutes: 6,
  outcomes: [
    'Why a name has to become an address before any connection',
    'The resolver and the hierarchy behind it',
    'What caching and TTL do',
    'Where DNS ends and the real connection begins',
  ],
  concepts: ['dns'],
  steps: [
    {
      id: 'why-dns',
      kind: 'teach',
      title: 'The IP layer has never heard of example.com',
      body: 'Routers forward packets by IP address, not by name. Before your browser can send a single packet to example.com it has to find out which address that name points to.',
      concept: 'dns',
    },
    {
      id: 'resolve',
      kind: 'interact',
      title: 'A lookup, step by step',
      body: 'Follow the query from the browser to its resolver, down the hierarchy, and back with an address that gets cached for next time.',
      widget: 'dns-resolve',
      concept: 'dns',
    },
    {
      id: 'check-order',
      kind: 'question',
      title: 'Checkpoint: what happens first',
      question: {
        prompt: 'You click a link to https://example.com. What happens before any TCP connection is opened?',
        options: [
          'The browser connects to example.com directly by name',
          'DNS resolves example.com to an IP address',
          'The router looks up example.com in its routing table',
          'ARP finds the MAC address for example.com',
        ],
        answerIndex: 1,
        explain:
          'Names are resolved first. DNS returns an IP address; only then can the browser open a TCP connection to that address. Routing and ARP work on addresses, never names.',
      },
      concept: 'dns',
    },
    {
      id: 'check-ttl',
      kind: 'question',
      title: 'Checkpoint: caching',
      question: {
        prompt: 'A DNS record comes back with a TTL of 300. What does that mean?',
        options: [
          'The address is valid for 300 hops',
          'The resolver may reuse this answer for 300 seconds before asking again',
          'The site can handle 300 connections',
          'The query took 300 milliseconds',
        ],
        answerIndex: 1,
        explain:
          'TTL is how long an answer may be cached. Caching means most lookups are answered instantly and locally - the full hierarchy walk only happens when nothing has a fresh copy.',
      },
      concept: 'dns',
    },
    {
      id: 'recap',
      kind: 'teach',
      title: 'DNS in one line',
      body: 'One job: translate a name into an address, then get out of the way. Everything after that - TCP, TLS, HTTP - runs against the address DNS returned.',
      concept: 'dns',
    },
  ],
}

export const NAT_LESSON: InteractiveLesson = {
  id: 'nat',
  labNumber: 'LAB 11',
  title: 'Understanding NAT',
  subtitle: 'How private addresses reach the Internet',
  minutes: 7,
  outcomes: [
    'Why private ranges are not routed on the public Internet',
    'How a router rewrites the source address on the way out',
    'How the translation table matches replies back to the right host',
    'Why port numbers let many hosts share one public address',
  ],
  concepts: ['nat'],
  steps: [
    {
      id: 'why-nat',
      kind: 'teach',
      title: 'Private addresses stop at the edge',
      body: '10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16 are reserved for private use and are never routed on the public Internet. NAT is what lets a network full of them still reach the outside world.',
      diagram:
        'inside (private)              outside (public)\n 192.168.1.10  ─┐\n 192.168.1.11  ─┼─ router/NAT ── 203.0.113.7 ── Internet\n 192.168.1.12  ─┘   rewrites each flow',
      concept: 'nat',
    },
    {
      id: 'translate',
      kind: 'interact',
      title: 'Rewrite on the way out, rewrite on the way back',
      body: 'Watch the router swap the private source for its public address, record the mapping, and undo it when the reply returns.',
      widget: 'nat-translate',
      concept: 'nat',
    },
    {
      id: 'check-pat',
      kind: 'question',
      title: 'Checkpoint: sharing one address',
      question: {
        prompt: 'Fifty devices behind one home router all browse the web through a single public IP. How does the router keep the conversations apart?',
        options: [
          'By MAC address',
          'By source port number in the translation table',
          'By giving each device a turn',
          'By destination IP address',
        ],
        answerIndex: 1,
        explain:
          'Each outbound flow is mapped to a unique (public IP, port) pair. When a reply arrives for that port, the router looks it up and rewrites the destination back to the right private host. This is PAT - NAT overload.',
      },
      concept: 'nat',
    },
    {
      id: 'check-empty',
      kind: 'question',
      title: 'Checkpoint: a NAT failure',
      question: {
        prompt: 'Hosts can reach the router, but no traffic gets to external sites and the NAT translation table is empty. What does that point to?',
        options: [
          'The hosts have the wrong MAC addresses',
          'The traffic is not reaching the NAT device or is not matching the NAT rule',
          'DNS is broken',
          'The switch is flooding frames',
        ],
        answerIndex: 1,
        explain:
          'Translation happens at the border. An empty table means the router never saw traffic it was supposed to translate - wrong inside/outside interface, or a rule that does not match the source.',
      },
      concept: 'nat',
    },
    {
      id: 'recap',
      kind: 'teach',
      title: 'NAT in one line',
      body: 'One public address, many private hosts. The router rewrites source addresses outbound, remembers the mapping, and reverses it inbound - flows kept apart by port.',
      concept: 'nat',
    },
  ],
}

export const ICMP_LESSON: InteractiveLesson = {
  id: 'icmp',
  labNumber: 'LAB 12',
  title: 'Understanding ICMP & Ping',
  subtitle: 'The first tool in every diagnosis',
  minutes: 5,
  outcomes: [
    'What protocol ping actually uses',
    'The Echo Request / Echo Reply exchange',
    'What a successful ping proves - and what it does not',
  ],
  concepts: ['icmp'],
  steps: [
    {
      id: 'what-icmp',
      kind: 'teach',
      title: 'Ping is not TCP and not UDP',
      body: 'Ping runs on ICMP - a helper protocol that rides directly on IP, alongside TCP and UDP rather than inside them. Its job is to report reachability and errors, not to carry application data.',
      diagram:
        'IP packet\n ├─ TCP  (connections, reliability)\n ├─ UDP  (datagrams)\n └─ ICMP (echo, unreachable, time exceeded)  ← ping lives here',
      concept: 'icmp',
    },
    {
      id: 'echo',
      kind: 'interact',
      title: 'Echo Request, Echo Reply',
      body: 'Step through a ping: a request goes out, a reply comes back, and the round-trip time is measured.',
      widget: 'icmp-ping',
      concept: 'icmp',
    },
    {
      id: 'check-proves',
      kind: 'question',
      title: 'Checkpoint: what a reply proves',
      question: {
        prompt: 'ping 10.0.0.2 succeeds. What can you safely conclude?',
        options: [
          'The web server on 10.0.0.2 is running',
          'There is a working IP path to 10.0.0.2 and back',
          'Port 80 on 10.0.0.2 is open',
          'DNS is configured correctly',
        ],
        answerIndex: 1,
        explain:
          'A reply proves IP-layer reachability in both directions - routing, addressing and the link are all sound. It says nothing about ports, services or name resolution; a host can answer ping while every application on it is down.',
      },
      concept: 'icmp',
    },
    {
      id: 'check-fail',
      kind: 'question',
      title: 'Checkpoint: reading a failure',
      question: {
        prompt: 'ping to a remote host returns "Request timed out", but ping to your own gateway succeeds. Where is the fault most likely NOT?',
        options: [
          'Somewhere beyond your gateway - routing or the remote end',
          'Your own IP address or subnet mask',
          'The path from your gateway onward',
          'The remote host being down',
        ],
        answerIndex: 1,
        explain:
          'Reaching your gateway proves your address, mask and local link are fine. The break is further along: a missing route, a down link beyond the gateway, or the remote host itself.',
      },
      concept: 'icmp',
    },
    {
      id: 'recap',
      kind: 'teach',
      title: 'ICMP in one line',
      body: 'ping sends an ICMP Echo Request and waits for an Echo Reply. Success means the IP path works both ways - the cheapest, first check in any troubleshooting session.',
      concept: 'icmp',
    },
  ],
}

export const SERVICE_LESSONS: InteractiveLesson[] = [DHCP_LESSON, DNS_LESSON, NAT_LESSON, ICMP_LESSON]
