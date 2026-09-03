import type { ConceptId } from '@/store/masteryStore'

/**
 * The flagship interactive concept lab: "Understanding IPv4 & CIDR".
 *
 * A lesson is an ordered list of steps. Each step is one small idea shown as
 * visual -> short explanation -> interaction -> (sometimes) a checkpoint
 * question. The runner (InteractiveLessonRunner) mounts one step at a time and
 * only unlocks "Next" on a question once it is answered correctly.
 */

export type WidgetKey =
  | 'octet-bits'
  | 'cidr-explorer'
  | 'mask-derivation'
  | 'boundary-borrow'
  | 'subnet-splitter'
  | 'address-breakdown'

export interface StepQuestion {
  prompt: string
  options: string[]
  answerIndex: number
  /** Always a networking reason, never just "wrong". Shown on any answer. */
  explain: string
}

export interface InteractiveStep {
  id: string
  kind: 'teach' | 'demo' | 'interact' | 'question' | 'practice'
  title: string
  /** 1-3 short sentences. No walls of text. */
  body?: string
  /** Static monospace diagram shown under the body. */
  diagram?: string
  widget?: WidgetKey
  widgetProps?: Record<string, unknown>
  question?: StepQuestion
  /** Mastery concept this step reinforces. */
  concept?: ConceptId
}

export interface InteractiveLesson {
  id: string
  /** Cosmetic lab number for the intro screen. */
  labNumber: string
  title: string
  subtitle: string
  minutes: number
  /** "What you'll learn" checklist on the intro screen. */
  outcomes: string[]
  /** Concepts this lesson tops up when completed. */
  concepts: ConceptId[]
  steps: InteractiveStep[]
}

export const IPV4_CIDR_LESSON: InteractiveLesson = {
  id: 'ipv4-cidr',
  labNumber: 'LAB 04',
  title: 'Understanding IPv4 & CIDR',
  subtitle: 'Understanding Subnetting',
  minutes: 12,
  outcomes: [
    'What an IPv4 address really is',
    'Binary, octets and the 32-bit layout',
    'Network bits vs host bits',
    'CIDR notation from /8 to /32',
    'How a prefix becomes a subnet mask',
    'Network, broadcast and usable host range',
    'Why borrowing bits splits a network',
  ],
  concepts: ['ipv4-addressing', 'subnet-masks', 'cidr', 'network-addresses'],
  steps: [
    {
      id: 'what-is-ipv4',
      kind: 'teach',
      title: 'An IPv4 address is one 32-bit number',
      body: 'We write it as four decimal numbers separated by dots, but underneath it is just 32 binary digits. Each of the four parts - an octet - is 8 of those bits, so its value runs 0 to 255.',
      diagram:
        '192   .   168   .   10   .   0\n11000000.10101000.00001010.00000000\n<---8--><---8---><--8---><---8-->\n              32 bits total',
      concept: 'ipv4-addressing',
    },
    {
      id: 'octet-binary',
      kind: 'interact',
      title: 'Decimal is just binary added up',
      body: 'Each bit in an octet has a fixed weight: 128, 64, 32, 16, 8, 4, 2, 1. Switch bits on and the decimal value is simply their sum. Build 192.',
      widget: 'octet-bits',
      widgetProps: { target: 192 },
      concept: 'ipv4-addressing',
    },
    {
      id: 'check-octet',
      kind: 'question',
      title: 'Quick check: binary to decimal',
      body: 'You just saw how bit weights add up.',
      question: {
        prompt: 'What decimal value is the binary octet 11111100?',
        options: ['248', '252', '254', '224'],
        answerIndex: 1,
        explain:
          '11111100 = 128 + 64 + 32 + 16 + 8 + 4 = 252. The two right-hand zeros are worth 2 and 1, which are exactly the values left out.',
      },
      concept: 'ipv4-addressing',
    },
    {
      id: 'network-vs-host',
      kind: 'teach',
      title: 'Part of the address names the network, the rest names the host',
      body: 'Reading left to right, the first chunk of bits is shared by every device on the same network - that is the network portion. The remaining bits on the right count the individual hosts.',
      diagram:
        'NETWORK PORTION            HOST PORTION\n11111111 11111111 11111111 | 00000000\n<-------- shared --------->  <-per host->',
      concept: 'cidr',
    },
    {
      id: 'cidr-explorer',
      kind: 'interact',
      title: 'CIDR: the prefix is where the boundary sits',
      body: '/24 means "the first 24 bits are the network". Drag the slider and watch the boundary move one bit at a time - and watch the mask, the address count and the usable-host count change with it.',
      widget: 'cidr-explorer',
      widgetProps: { initialPrefix: 24, baseAddress: '192.168.10.0' },
      concept: 'cidr',
    },
    {
      id: 'check-24',
      kind: 'question',
      title: 'Checkpoint: what does /24 mean?',
      question: {
        prompt: 'In 192.168.10.0/24, how many bits number the hosts?',
        options: ['24', '16', '8', '4'],
        answerIndex: 2,
        explain:
          'An IPv4 address is 32 bits. /24 uses 24 for the network, leaving 32 - 24 = 8 host bits. 8 host bits give 256 addresses, 254 of them usable.',
      },
      concept: 'cidr',
    },
    {
      id: 'check-16-8',
      kind: 'question',
      title: 'Checkpoint: bigger blocks',
      question: {
        prompt: 'Which prefix gives the most host addresses?',
        options: ['/8', '/16', '/24', 'They are equal'],
        answerIndex: 0,
        explain:
          'Fewer network bits means more host bits. /8 leaves 24 host bits (16,777,216 addresses); /16 leaves 16 (65,536); /24 leaves 8 (256). The smaller the number after the slash, the bigger the network.',
      },
      concept: 'cidr',
    },
    {
      id: 'mask-derivation',
      kind: 'demo',
      title: 'A prefix and a subnet mask are the same thing',
      body: 'The mask just writes the boundary out as a dotted-decimal number: put a 1 under every network bit, a 0 under every host bit, then read each octet as decimal.',
      widget: 'mask-derivation',
      widgetProps: { prefix: 24 },
      concept: 'subnet-masks',
    },
    {
      id: 'check-mask',
      kind: 'question',
      title: 'Checkpoint: prefix to mask',
      question: {
        prompt: 'What subnet mask matches /26?',
        options: ['255.255.255.0', '255.255.255.192', '255.255.255.224', '255.255.255.252'],
        answerIndex: 1,
        explain:
          '/26 = 26 network bits. The fourth octet holds 2 of them: 11000000 = 192. So the mask is 255.255.255.192. Each borrowed bit doubles the last octet step: .128, .192, .224, .240 ...',
      },
      concept: 'subnet-masks',
    },
    {
      id: 'address-breakdown',
      kind: 'interact',
      title: 'Every subnet has four landmark addresses',
      body: 'The network address (all host bits 0) and the broadcast address (all host bits 1) are reserved. Everything between them is the usable host range. Try other addresses and see where the landmarks land.',
      widget: 'address-breakdown',
      widgetProps: { defaultIp: '192.168.10.42', defaultPrefix: 24 },
      concept: 'network-addresses',
    },
    {
      id: 'check-broadcast',
      kind: 'question',
      title: 'Checkpoint: find the broadcast',
      question: {
        prompt: 'For 10.0.5.0/24, what is the broadcast address?',
        options: ['10.0.5.1', '10.0.5.254', '10.0.5.255', '10.0.255.255'],
        answerIndex: 2,
        explain:
          'Broadcast = every host bit set to 1. With a /24 the host bits are the whole last octet, so 11111111 = 255: the broadcast is 10.0.5.255. The last usable host is one below it, 10.0.5.254.',
      },
      concept: 'network-addresses',
    },
    {
      id: 'boundary-borrow',
      kind: 'demo',
      title: 'Borrowing a host bit splits the network in two',
      body: 'Move the boundary one bit right and that bit stops counting hosts and starts numbering subnets. One borrowed bit makes 2 subnets; two bits make 4; three make 8.',
      widget: 'boundary-borrow',
      widgetProps: { baseCidr: '192.168.1.0/24' },
      concept: 'cidr',
    },
    {
      id: 'subnet-splitter',
      kind: 'interact',
      title: 'Keep splitting and watch the space divide',
      body: 'Each "Split each" borrows one more bit from every block. /24 becomes two /25s, then four /26s, then eight /27s - the same address space cut into smaller and smaller pieces.',
      widget: 'subnet-splitter',
      widgetProps: { baseCidr: '192.168.1.0/24' },
      concept: 'cidr',
    },
    {
      id: 'special-cases',
      kind: 'teach',
      title: '/31 and /32 are deliberate exceptions',
      body: 'The "subtract 2 for network and broadcast" rule assumes a block big enough to spare them. It is not always true.',
      diagram:
        '/30  4 addresses  ->  2 usable   (normal rule)\n/31  2 addresses  ->  2 usable   RFC 3021: both ends of a point-to-point link\n/32  1 address    ->  1 usable   a single host route, no network/broadcast',
      concept: 'subnet-masks',
    },
    {
      id: 'practice',
      kind: 'practice',
      title: 'Practice: design an office network',
      body: 'You have learned the mechanics. Now apply them: carve 192.168.10.0/24 into right-sized subnets for four departments.',
      concept: 'network-addresses',
    },
  ],
}
