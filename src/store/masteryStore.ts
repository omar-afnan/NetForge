import { create } from 'zustand'
import { finiteNum, isRecord, readPersisted, writePersisted } from '@/lib/persist'

/**
 * Concept mastery - a small, professional progress signal for the Learn view.
 * Each interactive lesson step nudges the relevant concept score upward; the
 * ConceptMasteryPanel renders the running picture. Deliberately not a game:
 * no points, no streaks, no badges - just "how solid is this concept".
 */

const STORAGE_KEY = 'netforge-concept-mastery'
const SCHEMA_VERSION = 1

export type ConceptId =
  | 'ipv4-addressing'
  | 'subnet-masks'
  | 'cidr'
  | 'network-addresses'
  | 'default-gateways'
  | 'routing'
  | 'tcp'
  | 'udp'
  | 'ports'
  | 'dhcp'
  | 'dns'
  | 'nat'
  | 'icmp'
  | 'mac'
  | 'arp'
  | 'switching'
  | 'encapsulation'

export const CONCEPT_LABELS: Record<ConceptId, string> = {
  'ipv4-addressing': 'IPv4 addressing',
  'subnet-masks': 'Subnet masks',
  cidr: 'CIDR',
  'network-addresses': 'Network & broadcast',
  'default-gateways': 'Default gateways',
  routing: 'Routing',
  tcp: 'TCP',
  udp: 'UDP',
  ports: 'Ports & sockets',
  dhcp: 'DHCP',
  dns: 'DNS',
  nat: 'NAT',
  icmp: 'ICMP / ping',
  mac: 'MAC & Ethernet',
  arp: 'ARP',
  switching: 'Switching',
  encapsulation: 'Encapsulation',
}

export const CONCEPT_ORDER: ConceptId[] = [
  'ipv4-addressing',
  'subnet-masks',
  'cidr',
  'network-addresses',
  'default-gateways',
  'routing',
  'tcp',
  'udp',
  'ports',
  'dhcp',
  'dns',
  'nat',
  'icmp',
  'mac',
  'arp',
  'switching',
  'encapsulation',
]

type Scores = Record<ConceptId, number>

const EMPTY: Scores = {
  'ipv4-addressing': 0,
  'subnet-masks': 0,
  cidr: 0,
  'network-addresses': 0,
  'default-gateways': 0,
  routing: 0,
  tcp: 0,
  udp: 0,
  ports: 0,
  dhcp: 0,
  dns: 0,
  nat: 0,
  icmp: 0,
  mac: 0,
  arp: 0,
  switching: 0,
  encapsulation: 0,
}

interface MasteryState {
  scores: Scores
  /** Raise a concept score by `delta` (clamped 0-100). Never lowers it. */
  bump: (id: ConceptId, delta: number) => void
  /** Set a concept to at least `value` (clamped 0-100). */
  raiseTo: (id: ConceptId, value: number) => void
  reset: () => void
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/** Only known concepts survive; every score is a finite number clamped to 0-100. */
export function sanitizeScores(raw: unknown): Scores | null {
  if (!isRecord(raw) || !isRecord(raw.scores)) return null
  const scores = { ...EMPTY }
  for (const id of CONCEPT_ORDER) {
    scores[id] = clamp(finiteNum(raw.scores[id], 0))
  }
  return scores
}

function load(): Scores {
  return readPersisted(STORAGE_KEY, SCHEMA_VERSION, sanitizeScores) ?? { ...EMPTY }
}

function persist(scores: Scores) {
  writePersisted(STORAGE_KEY, SCHEMA_VERSION, { scores })
}

export const useConceptMastery = create<MasteryState>((set) => ({
  scores: load(),
  bump: (id, delta) =>
    set((state) => {
      const next = clamp((state.scores[id] ?? 0) + delta)
      if (next <= (state.scores[id] ?? 0)) return state
      const scores = { ...state.scores, [id]: next }
      persist(scores)
      return { scores }
    }),
  raiseTo: (id, value) =>
    set((state) => {
      const next = clamp(value)
      if (next <= (state.scores[id] ?? 0)) return state
      const scores = { ...state.scores, [id]: next }
      persist(scores)
      return { scores }
    }),
  reset: () => {
    persist({ ...EMPTY })
    set({ scores: { ...EMPTY } })
  },
}))

/** Non-hook accessor for one-off writes from event handlers. */
export const bumpConcept = (id: ConceptId, delta: number) =>
  useConceptMastery.getState().bump(id, delta)
