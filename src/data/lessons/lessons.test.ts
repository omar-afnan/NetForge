import { describe, expect, it } from 'vitest'
import type { InteractiveLesson } from './types'
import { IPV4_CIDR_LESSON } from './ipv4-cidr'
import { SUBNETTING_PRACTICE_LESSON } from './subnetting-practice'
import { TRANSPORT_LESSONS } from './transport'
import { SERVICE_LESSONS } from './services'
import { L2_LESSONS } from './l2'
import { ADVANCED_LESSONS } from './advanced'
import { CONCEPT_ORDER } from '@/store/masteryStore'
import { CURRICULUM } from '@/data/curriculum'

const ALL: InteractiveLesson[] = [
  IPV4_CIDR_LESSON,
  SUBNETTING_PRACTICE_LESSON,
  ...TRANSPORT_LESSONS,
  ...SERVICE_LESSONS,
  ...L2_LESSONS,
  ...ADVANCED_LESSONS,
]

const CONCEPTS = new Set<string>(CONCEPT_ORDER)

describe('interactive lessons', () => {
  it('every lesson id is unique', () => {
    const ids = ALL.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every lesson-level and step-level concept is a real mastery concept', () => {
    for (const lesson of ALL) {
      for (const c of lesson.concepts) {
        expect(CONCEPTS.has(c), `${lesson.id}: concept "${c}"`).toBe(true)
      }
      for (const step of lesson.steps) {
        if (step.concept) {
          expect(CONCEPTS.has(step.concept), `${lesson.id}/${step.id}: concept "${step.concept}"`).toBe(true)
        }
      }
    }
  })

  it('every question step is well-formed', () => {
    for (const lesson of ALL) {
      for (const step of lesson.steps) {
        if (step.kind !== 'question') continue
        const q = step.question
        expect(q, `${lesson.id}/${step.id} has no question`).toBeTruthy()
        expect(q!.options.length).toBeGreaterThanOrEqual(2)
        expect(q!.answerIndex).toBeGreaterThanOrEqual(0)
        expect(q!.answerIndex).toBeLessThan(q!.options.length)
        expect(q!.explain.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('every lesson ends on a non-question step and has at least one interaction', () => {
    for (const lesson of ALL) {
      expect(lesson.steps.length).toBeGreaterThan(1)
      expect(lesson.steps[lesson.steps.length - 1].kind).not.toBe('question')
      expect(lesson.steps.some((s) => s.kind === 'interact' || s.kind === 'demo' || s.kind === 'practice' || s.kind === 'apply')).toBe(true)
    }
  })
})

describe('curriculum wiring', () => {
  const known = new Set(ALL.map((l) => l.id))

  it('every interactiveLessonId referenced by a module actually exists', () => {
    for (const mod of CURRICULUM) {
      const ids = mod.interactiveLessonIds ?? (mod.interactiveLessonId ? [mod.interactiveLessonId] : [])
      for (const id of ids) {
        expect(known.has(id), `module "${mod.id}" -> unknown interactive lesson "${id}"`).toBe(true)
      }
    }
  })

  it('an interactive lesson id never collides with a text lesson id in the same module', () => {
    for (const mod of CURRICULUM) {
      const ids = mod.interactiveLessonIds ?? []
      const textIds = new Set(mod.lessons.map((l) => l.id))
      for (const id of ids) {
        expect(textIds.has(id), `module "${mod.id}": "${id}" collides with a text lesson`).toBe(false)
      }
    }
  })
})
