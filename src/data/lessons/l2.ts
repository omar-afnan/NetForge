import type { InteractiveLesson } from './types'

/**
 * Layer-2 and routing concept labs: MAC / Ethernet frames, switch MAC
 * learning, ARP, and the router's longest-prefix-match decision. Same step
 * model as the other interactive lessons - teach, learner-paced animation,
 * checkpoints that reinforce the reasoning, recap.
 */

export const MAC_LESSON: InteractiveLesson = {
  id: 'mac',
  labNumber: 'LAB 13',
  title: 'MAC Addresses & Ethernet Frames',
  subtitle: 'Addressing the next hop',
  minutes: 6,
  outcomes: [
    'What a MAC address is and where it lives',
    'The fields of an Ethernet frame',
    'Why a switch forwards by destination MAC',
    'Why MAC addresses are only local to one link',
  ],
  concepts: ['mac'],
  steps: [
    {
      id: 'what-mac',
      kind: 'teach',
      title: 'Every interface has a burned-in address',
      body: 'A MAC address is a 48-bit hardware address on one network interface, written as six hex pairs like AA:BB:CC:DD:EE:FF. IP gets a packet across the whole Internet; MAC gets a frame across one link.',
      diagram:
        'IP packet  -> wrapped in ->  Ethernet frame\n                               [ dst MAC | src MAC | type | payload | FCS ]',
      concept: 'mac',
    },
    {
      id: 'frame',
      kind: 'interact',
      title: 'A frame from A to B',
      body: 'Step through building and sending one frame. Watch which field the switch reads to decide where it goes.',
      widget: 'ethernet-frame',
      concept: 'mac',
    },
    {
      id: 'check-forward',
      kind: 'question',
      title: 'Checkpoint: how the switch decides',
      question: {
        prompt: 'Which field does a switch use to decide which port to send a frame out of?',
        options: ['Source MAC', 'Destination MAC', 'Destination IP', 'The type field'],
        answerIndex: 1,
        explain:
          'A switch forwards by destination MAC. It reads the source MAC too - but only to learn which port that sender is on, for future frames.',
      },
      concept: 'mac',
    },
    {
      id: 'check-local',
      kind: 'question',
      title: 'Checkpoint: crossing a router',
      question: {
        prompt: 'A packet travels PC -> router -> another router -> server. How many times is the Ethernet frame rebuilt with new MAC addresses?',
        options: ['Never - the frame is the same end to end', 'Once', 'At every routed hop', 'Only at the server'],
        answerIndex: 2,
        explain:
          'MAC addresses are link-local. Each router strips the incoming frame and builds a new one addressed to the next hop\'s MAC. The IP addresses stay the same the whole way; the MAC addresses change every hop.',
      },
      concept: 'mac',
    },
    {
      id: 'recap',
      kind: 'teach',
      title: 'MAC in one line',
      body: 'A hardware address that means something only on the wire in front of you. The frame that carries it is rebuilt at every router; the IP packet inside it is not.',
      concept: 'mac',
    },
  ],
}

export const SWITCHING_LESSON: InteractiveLesson = {
  id: 'switching',
  labNumber: 'LAB 14',
  title: 'How a Switch Learns',
  subtitle: 'The MAC address table, built from traffic',
  minutes: 6,
  outcomes: [
    'How a switch fills its MAC address table',
    'What "flooding" is and when it happens',
    'Why the first frame to a new host is flooded but later ones are not',
  ],
  concepts: ['switching'],
  steps: [
    {
      id: 'the-rule',
      kind: 'teach',
      title: 'One rule: learn from the source',
      body: 'Whenever a frame arrives on a port, the switch records "this source MAC is on this port." That single habit builds the whole forwarding table - no configuration required.',
      concept: 'switching',
    },
    {
      id: 'learn',
      kind: 'interact',
      title: 'Watch the table fill in',
      body: 'Send a frame to a host the switch has never seen. Follow what it learns, and what it has to flood.',
      widget: 'switch-learning',
      concept: 'switching',
    },
    {
      id: 'check-flood',
      kind: 'question',
      title: 'Checkpoint: unknown destination',
      question: {
        prompt: 'A frame arrives for a destination MAC that is not in the switch\'s table. What does the switch do?',
        options: [
          'Drops the frame',
          'Sends it to the default gateway',
          'Floods it out every port except the one it arrived on',
          'Holds it until the destination sends traffic',
        ],
        answerIndex: 2,
        explain:
          'Unknown-unicast frames are flooded - the switch\'s safety net. The destination replies, the switch learns its port from that reply, and every frame after that is sent to just one port.',
      },
      concept: 'switching',
    },
    {
      id: 'check-source',
      kind: 'question',
      title: 'Checkpoint: what gets learned',
      question: {
        prompt: 'A frame with source MAC-A and destination MAC-B arrives on port 1. What does the switch learn?',
        options: [
          'MAC-B is on port 1',
          'MAC-A is on port 1',
          'Both MAC-A and MAC-B are on port 1',
          'Nothing until MAC-B replies',
        ],
        answerIndex: 1,
        explain:
          'The switch only knows where a frame came from, not where the destination is. It learns MAC-A -> port 1. It will learn MAC-B\'s port when MAC-B sends something.',
      },
      concept: 'switching',
    },
    {
      id: 'recap',
      kind: 'teach',
      title: 'Switching in one line',
      body: 'Learn the source of every frame; flood what you do not yet know; forward directly once you do. After one round trip the table is complete.',
      concept: 'switching',
    },
  ],
}

export const ARP_LESSON: InteractiveLesson = {
  id: 'arp',
  labNumber: 'LAB 15',
  title: 'Understanding ARP',
  subtitle: 'From IP address to MAC address',
  minutes: 6,
  outcomes: [
    'Why a host needs ARP before it can send a frame',
    'The broadcast request and the unicast reply',
    'What the ARP cache stores and why',
    'Where ARP sits in the chain: IP -> ARP -> MAC -> frame',
  ],
  concepts: ['arp'],
  steps: [
    {
      id: 'the-gap',
      kind: 'teach',
      title: 'You know the IP. You need the MAC.',
      body: 'To build an Ethernet frame for a host on your own subnet you need its MAC address - but you only have its IP. ARP bridges that gap.',
      diagram: 'destination IP  ──ARP──▶  destination MAC  ──▶  Ethernet frame',
      concept: 'arp',
    },
    {
      id: 'resolve',
      kind: 'interact',
      title: 'Who has 192.168.1.20?',
      body: 'Step through a resolution: a broadcast question, a unicast answer, a cached result.',
      widget: 'arp-resolve',
      concept: 'arp',
    },
    {
      id: 'check-broadcast',
      kind: 'question',
      title: 'Checkpoint: request vs reply',
      question: {
        prompt: 'How are the ARP request and the ARP reply addressed at Layer 2?',
        options: [
          'Both are broadcast',
          'Request is broadcast (FF:FF:FF:FF:FF:FF); reply is unicast back to the asker',
          'Both are unicast',
          'Request is unicast; reply is broadcast',
        ],
        answerIndex: 1,
        explain:
          'The asker does not know who owns the IP, so the request goes to everyone. The replier knows exactly who asked - the source MAC was right there in the request - so it answers directly.',
      },
      concept: 'arp',
    },
    {
      id: 'check-cache',
      kind: 'question',
      title: 'Checkpoint: why cache it',
      question: {
        prompt: 'Why does a host keep an ARP cache instead of resolving every time?',
        options: [
          'To avoid a broadcast for every single frame to the same neighbour',
          'Because ARP replies are unreliable',
          'To hide its MAC address',
          'The cache is required by IP',
        ],
        answerIndex: 0,
        explain:
          'Without a cache, every frame would need its own broadcast round trip. Entries are kept for a few minutes - long enough to be useful, short enough to notice when a device moves or is replaced.',
      },
      concept: 'arp',
    },
    {
      id: 'recap',
      kind: 'teach',
      title: 'ARP in one line',
      body: 'Broadcast "who has this IP?", get a unicast MAC back, cache it, build the frame. It runs once per conversation, then the cache carries the rest.',
      concept: 'arp',
    },
  ],
}

export const ROUTING_LESSON: InteractiveLesson = {
  id: 'routing',
  labNumber: 'LAB 16',
  title: 'How a Router Chooses',
  subtitle: 'Longest-prefix match',
  minutes: 6,
  outcomes: [
    'What a router does with a packet\'s destination IP',
    'Why the most specific route wins',
    'What the default route (0.0.0.0/0) is for',
  ],
  concepts: ['routing'],
  steps: [
    {
      id: 'the-job',
      kind: 'teach',
      title: 'Receive, look up, forward one hop',
      body: 'A router\'s whole job per packet: read the destination IP, find the best matching route in its table, and send the packet to that route\'s next hop. Every router along the way makes this decision independently.',
      concept: 'routing',
    },
    {
      id: 'lookup',
      kind: 'interact',
      title: 'A table lookup, step by step',
      body: 'A packet for 10.2.5.7 arrives. Watch the router compare routes and pick the most specific one.',
      widget: 'routing-table',
      concept: 'routing',
    },
    {
      id: 'check-specific',
      kind: 'question',
      title: 'Checkpoint: which route wins',
      question: {
        prompt: 'A packet for 10.2.5.7 matches both 10.2.0.0/16 and 0.0.0.0/0. Which route does the router use?',
        options: [
          '0.0.0.0/0 - it was listed first as the fallback',
          '10.2.0.0/16 - it is the more specific (longer prefix) match',
          'Whichever has the lower metric',
          'It load-balances across both',
        ],
        answerIndex: 1,
        explain:
          'Longest-prefix match: /16 pins down a smaller block than /0, so it is the more specific answer and always wins. The default route is only the answer when nothing more specific matches.',
      },
      concept: 'routing',
    },
    {
      id: 'check-default',
      kind: 'question',
      title: 'Checkpoint: the default route',
      question: {
        prompt: 'What does a default route (0.0.0.0/0) match?',
        options: [
          'Only traffic staying on the local network',
          'Only broadcast traffic',
          'Any destination that has no more specific route',
          'Only addresses in the 10.0.0.0/8 range',
        ],
        answerIndex: 2,
        explain:
          '0.0.0.0/0 is the shortest possible prefix, so it matches everything - but only as a last resort. It keeps routing tables small: a home router needs its local routes plus one default pointing at the ISP.',
      },
      concept: 'routing',
    },
    {
      id: 'recap',
      kind: 'teach',
      title: 'Routing in one line',
      body: 'Scan the table, take the most specific match, forward to its next hop. If nothing matches, the default route catches it - or the packet is dropped.',
      concept: 'routing',
    },
  ],
}

export const L2_LESSONS: InteractiveLesson[] = [MAC_LESSON, SWITCHING_LESSON, ARP_LESSON, ROUTING_LESSON]
