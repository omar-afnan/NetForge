import { useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, Circle, FlaskConical, Lock } from 'lucide-react'
import { CURRICULUM, type CurriculumModule, type Lesson } from '@/data/curriculum'
import { useLearnProgress } from '@/store/progressStore'
import { useNetworkStore } from '@/store/networkStore'
import { useUIStore } from '@/store/uiStore'
import { ALL_LABS } from '@/data/labs'

function SectionBlock({ type, text }: { type: Lesson['content'][number]['type']; text: string }) {
  if (type === 'code' || type === 'diagram') {
    return (
      <pre
        className={`my-2 overflow-x-auto border border-[var(--border)] bg-[var(--bg-inset)] p-2.5 font-data text-[11px] leading-relaxed ${
          type === 'diagram' ? 'text-[var(--accent-link)]' : 'text-[var(--text-secondary)]'
        }`}
      >
        {text}
      </pre>
    )
  }
  if (type === 'keyterms') {
    return (
      <div className="my-2 border-l-2 border-[var(--accent-amber)] bg-[rgba(240,180,41,0.06)] px-3 py-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
        {text}
      </div>
    )
  }
  return <p className="my-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">{text}</p>
}

function LessonReader({
  module,
  lesson,
  onBack,
}: {
  module: CurriculumModule
  lesson: Lesson
  onBack: () => void
}) {
  const toggleLesson = useLearnProgress((s) => s.toggleLesson)
  const done = useLearnProgress((s) => Boolean(s.lessons[`${module.id}/${lesson.id}`]))
  const loadLab = useNetworkStore((s) => s.loadLab)
  const setActiveView = useUIStore((s) => s.setActiveView)

  const relatedLabs = useMemo(
    () => ALL_LABS.filter((lab) => module.relatedLabIds?.includes(lab.id)),
    [module.relatedLabIds],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>
          L{module.level} · {module.title}
        </span>
        <button
          type="button"
          className="border border-[var(--border)] px-2 py-0.5 font-data text-[10px] font-normal normal-case tracking-normal text-[var(--text-secondary)] transition-colors hover:border-[var(--border-bright)] hover:text-[var(--text-primary)]"
          onClick={onBack}
        >
          ← Back to modules
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
            {lesson.minutes} min lesson
          </div>
          <h2 className="mt-1 text-lg font-bold text-[var(--text-primary)]">{lesson.title}</h2>
          {lesson.content.map((section, index) => (
            <SectionBlock key={index} type={section.type} text={section.text} />
          ))}

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              className={`flex items-center gap-1.5 border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                done
                  ? 'border-[var(--status-up)] text-[var(--status-up)]'
                  : 'border-[var(--border-bright)] text-[var(--text-primary)] hover:border-[var(--accent-link)]'
              }`}
              onClick={() => toggleLesson(module.id, lesson.id)}
            >
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
              {done ? 'Completed ✓' : 'Mark as complete'}
            </button>
            {relatedLabs.map((lab) => (
              <button
                key={lab.id}
                type="button"
                className="flex items-center gap-1.5 border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--accent-link)] transition-colors hover:border-[var(--accent-link)]"
                onClick={() => {
                  loadLab(lab)
                  setActiveView('topology')
                }}
              >
                <FlaskConical className="h-3.5 w-3.5" strokeWidth={1.75} />
                Practice: {lab.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function LearnView() {
  const lessons = useLearnProgress((s) => s.lessons)
  const [openModuleId, setOpenModuleId] = useState<string | null>(null)
  const [openLessonId, setOpenLessonId] = useState<string | null>(null)

  const openModule = CURRICULUM.find((m) => m.id === openModuleId)
  const openLesson = openModule?.lessons.find((l) => l.id === openLessonId)

  const totalDone = CURRICULUM.reduce(
    (sum, m) => sum + m.lessons.filter((l) => lessons[`${m.id}/${l.id}`]).length,
    0,
  )
  const totalAvailable = CURRICULUM.reduce((sum, m) => sum + m.lessons.length, 0)
  const overallPct = totalAvailable ? Math.round((totalDone / totalAvailable) * 100) : 0

  if (openModule && openLesson) {
    return (
      <LessonReader
        module={openModule}
        lesson={openLesson}
        onBack={() => setOpenLessonId(null)}
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
          Learning — CCNA-level curriculum
        </span>
        <span className="font-data text-[10px] font-normal normal-case tracking-normal text-[var(--text-secondary)]">
          {totalDone}/{totalAvailable} lessons · {overallPct}%
        </span>
      </div>

      <div className="border-b border-[var(--border)] px-3 pb-2 pt-2">
        <div className="h-1.5 w-full bg-[var(--bg-inset)]">
          <div className="h-full bg-[var(--accent-link)] transition-all" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <div className="mx-auto grid max-w-3xl gap-3">
          {CURRICULUM.map((module) => {
            const doneCount = module.lessons.filter((l) => lessons[`${module.id}/${l.id}`]).length
            const pct = module.lessons.length ? Math.round((doneCount / module.lessons.length) * 100) : 0
            const expanded = openModuleId === module.id
            return (
              <div key={module.id} className="panel border">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 p-3 text-left"
                  onClick={() => setOpenModuleId(expanded ? null : module.id)}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center border font-data text-sm font-bold ${
                      module.comingSoon
                        ? 'border-[var(--border)] text-[var(--text-dim)]'
                        : pct === 100
                          ? 'border-[var(--status-up)] text-[var(--status-up)]'
                          : 'border-[var(--accent-link)] text-[var(--accent-link)]'
                    }`}
                  >
                    {module.comingSoon ? <Lock className="h-4 w-4" strokeWidth={1.75} /> : module.level}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-[var(--text-primary)]">{module.title}</span>
                      {module.comingSoon && <span className="badge text-[9px]">coming soon</span>}
                      {!module.comingSoon && pct === 100 && (
                        <span className="badge badge-cyan text-[9px]">completed</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-secondary)]">
                      {module.blurb}
                    </div>
                    {!module.comingSoon && module.lessons.length > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 w-28 bg-[var(--bg-inset)]">
                          <div className="h-full bg-[var(--accent-link)]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-data text-[9px] text-[var(--text-dim)]">
                          {doneCount}/{module.lessons.length}
                        </span>
                      </div>
                    )}
                  </div>
                </button>

                {expanded && !module.comingSoon && (
                  <ul className="border-t border-[var(--border)]">
                    {module.lessons.map((lesson) => {
                      const done = Boolean(lessons[`${module.id}/${lesson.id}`])
                      return (
                        <li key={lesson.id} className="border-b border-[var(--border)] last:border-b-0">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-elevated)]"
                            onClick={() => setOpenLessonId(lesson.id)}
                          >
                            {done ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--status-up)]" strokeWidth={1.75} />
                            ) : (
                              <Circle className="h-3.5 w-3.5 shrink-0 text-[var(--text-dim)]" strokeWidth={1.75} />
                            )}
                            <span className="flex-1 text-[12px] text-[var(--text-primary)]">{lesson.title}</span>
                            <span className="font-data text-[9px] text-[var(--text-dim)]">{lesson.minutes} min</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
