import { beforeEach, describe, expect, it } from 'vitest'
import {
  bumpConcept,
  CONCEPT_LABELS,
  CONCEPT_ORDER,
  useConceptMastery,
} from './masteryStore'

const store = () => useConceptMastery.getState()

beforeEach(() => {
  store().reset()
})

describe('concept mastery store', () => {
  it('starts every tracked concept at zero', () => {
    for (const c of CONCEPT_ORDER) {
      expect(store().scores[c]).toBe(0)
    }
  })

  it('every ordered concept has a label and vice versa', () => {
    expect(new Set(CONCEPT_ORDER).size).toBe(CONCEPT_ORDER.length)
    for (const c of CONCEPT_ORDER) expect(CONCEPT_LABELS[c]).toBeTruthy()
    expect(Object.keys(CONCEPT_LABELS).sort()).toEqual([...CONCEPT_ORDER].sort())
  })

  it('bump adds and clamps to 100', () => {
    store().bump('cidr', 30)
    expect(store().scores.cidr).toBe(30)
    store().bump('cidr', 90)
    expect(store().scores.cidr).toBe(100)
  })

  it('bump never lowers a score', () => {
    store().bump('cidr', 50)
    store().bump('cidr', -20)
    expect(store().scores.cidr).toBe(50)
  })

  it('raiseTo sets a floor, never a ceiling', () => {
    store().raiseTo('tcp', 65)
    expect(store().scores.tcp).toBe(65)
    store().raiseTo('tcp', 40)
    expect(store().scores.tcp).toBe(65)
    store().raiseTo('tcp', 80)
    expect(store().scores.tcp).toBe(80)
  })

  it('bumpConcept helper writes through to the store', () => {
    bumpConcept('arp', 16)
    expect(store().scores.arp).toBe(16)
  })

  it('reset returns everything to zero', () => {
    store().bump('routing', 40)
    store().reset()
    expect(store().scores.routing).toBe(0)
  })
})
