import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  IPV4_CIDR_LESSON,
  type InteractiveLesson,
  type InteractiveStep,
  type WidgetKey,
} from '@/data/lessons/ipv4-cidr'
import { OctetBitVisualizer } from '@/components/learn/interactive/OctetBitVisualizer'
import { CidrExplorer } from '@/components/learn/interactive/CidrExplorer'
import { MaskDerivation } from '@/components/learn/interactive/MaskDerivation'
import { BoundaryBorrowAnimation } from '@/components/learn/interactive/BoundaryBorrowAnimation'
import { SubnetSplitter } from '@/components/learn/interactive/SubnetSplitter'
import { AddressBreakdownCard } from '@/components/learn/interactive/AddressBreakdownCard'
import { SubnetDesignChallenge } from '@/components/learn/SubnetDesignChallenge'
import { useLearnProgress } from '@/store/progressStore'
import { bumpConcept, useConceptMastery } from '@/store/masteryStore'
import { celebrateLab } from '@/lib/celebrate'

const WIDGETS: Record<WidgetKey, (props: Record<string, unknown>) => React.ReactElement> = {
  'octet-bits': (p) => <OctetBitVisualizer {...p} />,
  'cidr-explorer': (p) => <CidrExplorer {...p} />,
  'mask-derivation': (p) => <MaskDerivation {...p} />,
  'boundary-borrow': (p) => <BoundaryBorrowAnimation {...p} />,
  'subnet-splitter': (p) => <SubnetSplitter {...p} />,
  'address-breakdown': (p) => <AddressBreakdownCard {...p} />,
}

const KIND_LABEL: Record<InteractiveStep['kind'], string> = {
  teach: 'Learn',
  demo: 'Watch',
  interact: 'Try it',
  question: 'Check',
  practice: 'Practice',
}

export function InteractiveLessonRunner({
  moduleId,
  lesson = IPV4_CIDR_LESSON,
  startAtPractice = false,
  onExit,
}: {
  moduleId: string
  lesson?: InteractiveLesson
  startAtPractice?: boolean
  onExit: () => void
}) {
  const steps = lesson.steps
  const practiceIndex = steps.findIndex((s) => s.kind === 'practice')
  const [index, setIndex] = useState(startAtPractice && practiceIndex >= 0 ? practiceIndex : 0)
  const [picked, setPicked] = useState<number | null>(null)
  const awarded = useRef<Set<string>>(new Set())

  const toggleLesson = useLearnProgress((s) => s.toggleLesson)
  const lessonDone = useLearnProgress((s) => Boolean(s.lessons[`${moduleId}/${lesson.id}`]))
  const raiseTo = useConceptMastery((s) => s.raiseTo)

  const step = steps[index]
  const isQuestion = step.kind === 'question'
  const answeredRight = isQuestion && picked === step.question!.answerIndex
  const canAdvance = !isQuestion || answeredRight
  const atLast = index === steps.length - 1

  const progressPct = useMemo(
    () => Math.round(((index + 1) / steps.length) * 100),
    [index, steps.length],
  )

  const awardForStep = (s: InteractiveStep) => {
    if (!s.concept || awarded.current.has(s.id)) return
    awarded.current.add(s.id)
    bumpConcept(s.concept, s.kind === 'question' ? 16 : 9)
  }

  const finish = () => {
    if (!lessonDone) toggleLesson(moduleId, lesson.id)
    lesson.concepts.forEach((c) => raiseTo(c, 65))
    celebrateLab()
    onExit()
  }

  const goNext = () => {
    awardForStep(step)
    if (atLast) {
      finish()
      return
    }
    setPicked(null)
    setIndex((i) => i + 1)
  }

  const goBack = () => {
    if (index === 0) {
      onExit()
      return
    }
    setPicked(null)
    setIndex((i) => i - 1)
  }

  // Practice step gets the full challenge surface.
  if (step.kind === 'practice') {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <StepRail lesson={lesson} index={index} progressPct={progressPct} />
        <div className="min-h-0 flex-1">
          <SubnetDesignChallenge onExit={goBack} />
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5">
          <Button variant="secondary" size="sm" onClick={goBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <Button variant="accent" size="sm" onClick={finish}>
            <Check className="h-3.5 w-3.5" />
            Finish lesson
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <StepRail lesson={lesson} index={index} progressPct={progressPct} />

      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="badge badge-cyan text-[9px]">{KIND_LABEL[step.kind]}</span>
            <span className="font-data text-[10px] text-[var(--text-dim)]">
              Step {index + 1} of {steps.length}
            </span>
          </div>
          <h2 className="mt-1.5 text-lg font-bold text-[var(--text-primary)]">{step.title}</h2>
          {step.body && (
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              {step.body}
            </p>
          )}
          {step.diagram && (
            <pre className="my-3 overflow-x-auto border border-[var(--border)] bg-[var(--bg-inset)] p-2.5 font-data text-[11px] leading-relaxed text-[var(--accent-link)]">
              {step.diagram}
            </pre>
          )}

          {step.widget && WIDGETS[step.widget](step.widgetProps ?? {})}

          {isQuestion && step.question && (
            <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)] p-3">
              <p className="text-[12px] font-semibold text-[var(--text-primary)]">
                {step.question.prompt}
              </p>
              <div className="mt-2 space-y-1.5">
                {step.question.options.map((opt, i) => {
                  const chosen = picked === i
                  const isAnswer = i === step.question!.answerIndex
                  const revealed = picked !== null
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPicked(i)}
                      className={`flex w-full items-center gap-2 border px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                        revealed && isAnswer
                          ? 'border-[var(--status-up)] text-[var(--status-up)]'
                          : chosen
                            ? 'border-[var(--status-down)] text-[var(--status-down)]'
                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-bright)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span className="font-data text-[10px] text-[var(--text-dim)]">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                    </button>
                  )
                })}
              </div>
              {picked !== null && (
                <p
                  className={`mt-2 text-[11px] leading-relaxed ${
                    answeredRight ? 'text-[var(--status-up)]' : 'text-[var(--accent-amber)]'
                  }`}
                >
                  {answeredRight ? '✓ Correct. ' : 'Not quite - '}
                  {step.question.explain}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5">
        <Button variant="secondary" size="sm" onClick={goBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {index === 0 ? 'Exit' : 'Back'}
        </Button>
        <Button variant="accent" size="sm" onClick={goNext} disabled={!canAdvance}>
          {atLast ? 'Finish' : 'Next'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function StepRail({
  lesson,
  index,
  progressPct,
}: {
  lesson: InteractiveLesson
  index: number
  progressPct: number
}) {
  return (
    <div className="border-b border-[var(--border)]">
      <div className="panel-header flex items-center justify-between">
        <span className="flex items-center gap-2">
          <GraduationCap className="h-3.5 w-3.5" strokeWidth={1.75} />
          {lesson.title}
        </span>
        <span className="font-data text-[10px] font-normal normal-case tracking-normal text-[var(--text-secondary)]">
          {progressPct}%
        </span>
      </div>
      <div className="flex gap-1 px-3 py-2">
        {lesson.steps.map((s, i) => (
          <div
            key={s.id}
            className={`h-1 flex-1 transition-colors ${
              i < index
                ? 'bg-[var(--status-up)]'
                : i === index
                  ? 'bg-[var(--accent-link)]'
                  : 'bg-[var(--border)]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
