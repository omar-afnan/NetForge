import type { ConceptId } from '@/store/masteryStore'

/**
 * Shared shape for every interactive concept lab (IPv4 & CIDR, TCP, UDP,
 * Subnetting Practice, ...). A lesson is an ordered list of steps; each step is
 * one small idea shown as visual -> short explanation -> interaction ->
 * (sometimes) a checkpoint question. `InteractiveLessonRunner` mounts one step
 * at a time and only unlocks "Next" on a question once it is answered correctly.
 */

export type WidgetKey =
  | 'octet-bits'
  | 'cidr-explorer'
  | 'mask-derivation'
  | 'boundary-borrow'
  | 'subnet-splitter'
  | 'address-breakdown'
  | 'tcp-handshake'
  | 'tcp-reliability'
  | 'transport-compare'

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
