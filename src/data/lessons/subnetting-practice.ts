import type { InteractiveLesson } from './types'

/**
 * Subnetting Practice - a difficulty ladder that comes after "Understanding
 * IPv4 & CIDR". Every question is graded by InteractiveLessonRunner (must be
 * right to advance) and every answer shows the networking reason, not just a
 * tick. The numbers all match src/lib/subnetMath.ts so the explanations can
 * never drift from the widgets.
 */

export const SUBNETTING_PRACTICE_LESSON: InteractiveLesson = {
  id: 'subnetting-practice',
  labNumber: 'LAB 08',
  title: 'Subnetting Practice',
  subtitle: 'From "what is the mask" to designing a network',
  minutes: 12,
  outcomes: [
    'Convert a prefix to a subnet mask',
    'Count total and usable addresses for any prefix',
    'Find the network and broadcast address of a block',
    'Work out which subnet an address belongs to',
    'Split a network into equal subnets',
    'Design right-sized subnets for a real office',
  ],
  concepts: ['cidr', 'subnet-masks', 'network-addresses'],
  steps: [
    {
      id: 'level-1',
      kind: 'question',
      title: 'Level 1 - Prefix to mask',
      body: 'The mask is just the prefix written in dotted decimal: a 1 under every network bit.',
      question: {
        prompt: 'What is the subnet mask for a /24?',
        options: ['255.255.255.0', '255.255.0.0', '255.255.255.128', '255.255.255.192'],
        answerIndex: 0,
        explain:
          '/24 = 24 one-bits = three full octets of 1s and one octet of 0s = 255.255.255.0. Each octet of all-ones is 255.',
      },
      concept: 'subnet-masks',
    },
    {
      id: 'level-2',
      kind: 'question',
      title: 'Level 2 - Address capacity',
      body: 'Total addresses = 2 ^ (host bits). Host bits = 32 - prefix.',
      question: {
        prompt: 'How many total addresses are in a /26?',
        options: ['64', '62', '32', '128'],
        answerIndex: 0,
        explain:
          'A /26 leaves 32 - 26 = 6 host bits. 2^6 = 64 total addresses. 62 of them are usable once you set aside the network and broadcast addresses.',
      },
      concept: 'cidr',
    },
    {
      id: 'level-3',
      kind: 'question',
      title: 'Level 3 - Network address',
      body: 'The network address is the block\'s first address: every host bit set to 0.',
      question: {
        prompt: 'What is the network address for 192.168.10.42/24?',
        options: ['192.168.10.0', '192.168.10.1', '192.168.10.42', '192.168.10.255'],
        answerIndex: 0,
        explain:
          'With a /24 the whole last octet is host bits. Set them all to 0: 192.168.10.0. That address names the network and is never assigned to a device.',
      },
      concept: 'network-addresses',
    },
    {
      id: 'level-4',
      kind: 'question',
      title: 'Level 4 - Broadcast address',
      body: 'The broadcast address is the block\'s last address: every host bit set to 1.',
      question: {
        prompt: 'What is the broadcast address for 192.168.10.42/24?',
        options: ['192.168.10.255', '192.168.10.254', '192.168.10.0', '192.168.10.42'],
        answerIndex: 0,
        explain:
          'Set every host bit to 1. With a /24 that is 11111111 in the last octet = 255, so 192.168.10.255. The last usable host is one below it, .254.',
      },
      concept: 'network-addresses',
    },
    {
      id: 'level-5',
      kind: 'question',
      title: 'Level 5 - Which subnet?',
      body: '192.168.1.0/24 has been split into four /26 blocks: .0, .64, .128, .192. Each block is 64 addresses wide.',
      question: {
        prompt: 'Which subnet contains the address 192.168.1.130?',
        options: ['192.168.1.0/26', '192.168.1.64/26', '192.168.1.128/26', '192.168.1.192/26'],
        answerIndex: 2,
        explain:
          'Blocks start every 64 addresses: .0-.63, .64-.127, .128-.191, .192-.255. 130 falls in .128-.191, so it belongs to 192.168.1.128/26.',
      },
      concept: 'network-addresses',
    },
    {
      id: 'level-6',
      kind: 'interact',
      title: 'Level 6 - Split into four',
      body: 'Press "Split each" twice to divide 192.168.1.0/24 into four equal subnets. Each split borrows one host bit: /24 -> two /25s -> four /26s.',
      widget: 'subnet-splitter',
      widgetProps: { baseCidr: '192.168.1.0/24' },
      concept: 'cidr',
    },
    {
      id: 'check-6',
      kind: 'question',
      title: 'Checkpoint: four equal subnets',
      question: {
        prompt: 'To get exactly four equal subnets from a /24, what prefix does each become?',
        options: ['/25', '/26', '/27', '/28'],
        answerIndex: 1,
        explain:
          'Four subnets needs 2 borrowed bits (2^2 = 4). /24 + 2 = /26. Each /26 has 64 addresses, 62 usable.',
      },
      concept: 'cidr',
    },
    {
      id: 'level-7',
      kind: 'practice',
      title: 'Level 7 - Design the network',
      body: 'Put it together: size a subnet for every department out of one block - big enough for its hosts, no bigger than it needs.',
      widgetProps: {
        base: '172.16.4.0/24',
        title: 'Design a branch-office network',
        departments: [
          { id: 'eng', name: 'Engineering', need: 60 },
          { id: 'support', name: 'Support', need: 28 },
          { id: 'finance', name: 'Finance', need: 12 },
          { id: 'ops', name: 'Ops', need: 6 },
        ],
      },
      concept: 'network-addresses',
    },
    {
      id: 'level-8',
      kind: 'apply',
      title: 'Level 8 - Configure and verify',
      body: 'One of those subnets, on real hosts: give PC1 and PC2 addresses from the plan and confirm they can reach each other.',
      concept: 'network-addresses',
      widgetProps: {
        title: 'Configure a subnet and prove it works',
        network: '10.20.30.0/26',
        gatewayIp: '10.20.30.1',
        hosts: [
          { name: 'PC1', ip: '10.20.30.10' },
          { name: 'PC2', ip: '10.20.30.40' },
        ],
      },
    },
  ],
}
