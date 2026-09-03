import { Check, Clock, FlaskConical, GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { InteractiveLesson } from '@/data/lessons/ipv4-cidr'

/**
 * The lab entry screen. Instead of dropping the learner onto a blank canvas,
 * it states what they'll learn, roughly how long it takes, and lets them
 * choose the guided lesson or jump straight to the practice challenge.
 */
export function LabIntro({
  lesson,
  done,
  onLearn,
  onPractice,
  onBack,
}: {
  lesson: InteractiveLesson
  done?: boolean
  onLearn: () => void
  onPractice: () => void
  onBack: () => void
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>{lesson.labNumber} · Interactive Lesson</span>
        <button
          type="button"
          onClick={onBack}
          className="border border-[var(--border)] px-2 py-0.5 font-data text-[10px] font-normal normal-case tracking-normal text-[var(--text-secondary)] transition-colors hover:border-[var(--border-bright)] hover:text-[var(--text-primary)]"
        >
          ← Back to modules
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
            <GraduationCap className="h-3.5 w-3.5" strokeWidth={1.75} />
            Concept lab
            {done && <span className="badge badge-completed text-[9px]">completed</span>}
          </div>
          <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{lesson.title}</h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{lesson.subtitle}</p>

          <div className="mt-6 border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
              What you'll learn
            </div>
            <ul className="mt-2 space-y-1.5">
              {lesson.outcomes.map((o) => (
                <li key={o} className="flex items-start gap-2 text-[12px] text-[var(--text-secondary)]">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-up)]" strokeWidth={2} />
                  {o}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center gap-1.5 border-t border-[var(--border)] pt-3 font-data text-[11px] text-[var(--text-dim)]">
              <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
              Estimated time: {lesson.minutes} minutes
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button variant="accent" onClick={onLearn}>
              <GraduationCap className="h-4 w-4" strokeWidth={1.75} />
              Learn the Concept
            </Button>
            <Button variant="secondary" onClick={onPractice}>
              <FlaskConical className="h-4 w-4" strokeWidth={1.75} />
              Skip to Practice
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
