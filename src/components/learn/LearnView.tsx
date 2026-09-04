import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, Circle, FlaskConical, GraduationCap, Lock, Monitor, Sparkles } from 'lucide-react'
import { EXPLAINERS } from '@/components/learn/Explainers'
import { CURRICULUM, type CurriculumModule, type Lesson } from '@/data/curriculum'
import { useLearnProgress } from '@/store/progressStore'
import { useNetworkStore } from '@/store/networkStore'
import { useUIStore } from '@/store/uiStore'
import { ALL_LABS } from '@/data/labs'
import { IPV4_CIDR_LESSON } from '@/data/lessons/ipv4-cidr'
import type { InteractiveLesson } from '@/data/lessons/types'
import { SUBNETTING_PRACTICE_LESSON } from '@/data/lessons/subnetting-practice'
import { TCP_LESSON, UDP_LESSON, TCP_VS_UDP_LESSON } from '@/data/lessons/transport'
import { DHCP_LESSON, DNS_LESSON, NAT_LESSON, ICMP_LESSON } from '@/data/lessons/services'
import { MAC_LESSON, SWITCHING_LESSON, ARP_LESSON, ROUTING_LESSON } from '@/data/lessons/l2'
import { VLSM_LESSON, PORTS_LESSON, PACKET_JOURNEY_LESSON } from '@/data/lessons/advanced'
import { LabIntro } from '@/components/learn/LabIntro'
import { InteractiveLessonRunner } from '@/components/learn/InteractiveLessonRunner'
import { ConceptMasteryPanel } from '@/components/learn/ConceptMasteryPanel'

/** Interactive concept labs, keyed by CurriculumModule.interactiveLessonId. */
const INTERACTIVE_LESSONS: Record<string, InteractiveLesson> = {
  'ipv4-cidr': IPV4_CIDR_LESSON,
  'subnetting-practice': SUBNETTING_PRACTICE_LESSON,
  tcp: TCP_LESSON,
  udp: UDP_LESSON,
  'tcp-udp-choose': TCP_VS_UDP_LESSON,
  dhcp: DHCP_LESSON,
  dns: DNS_LESSON,
  nat: NAT_LESSON,
  icmp: ICMP_LESSON,
  mac: MAC_LESSON,
  switching: SWITCHING_LESSON,
  arp: ARP_LESSON,
  routing: ROUTING_LESSON,
  vlsm: VLSM_LESSON,
  ports: PORTS_LESSON,
  'packet-journey': PACKET_JOURNEY_LESSON,
}

/** All interactive concept-lab ids a module offers (new plural field + legacy singular). */
function moduleInteractiveIds(module: CurriculumModule): string[] {
  const ids = module.interactiveLessonIds ?? (module.interactiveLessonId ? [module.interactiveLessonId] : [])
  return ids.filter((id) => INTERACTIVE_LESSONS[id])
}

/** Maps each Learn module to the Device Lab lesson that lets the student practice the concept hands-on. */
const MODULE_DEVICE_LAB: Record<string, { kind: 'router' | 'switch' | 'server' | 'pc'; lessonId: string; label: string }> = {
  fundamentals: { kind: 'router', lessonId: 'r-meet', label: 'Meet the Router' },
  ethernet: { kind: 'switch', lessonId: 's-meet', label: 'Meet the Switch' },
  ipv4: { kind: 'pc', lessonId: 'p-ip', label: 'Configure IPv4' },
  subnetting: { kind: 'pc', lessonId: 'p-mask', label: 'Configure a Subnet Mask' },
  arp: { kind: 'router', lessonId: 'r-verify', label: 'Verify an Interface' },
  switching: { kind: 'switch', lessonId: 's-vlan', label: 'Create a VLAN' },
  routing: { kind: 'router', lessonId: 'r-static-route', label: 'Add a Static Route' },
  'tcp-udp': { kind: 'server', lessonId: 'v-web', label: 'Explore the Web Service' },
  'dhcp-dns': { kind: 'server', lessonId: 'v-dhcp', label: 'Explore DHCP' },
  nat: { kind: 'router', lessonId: 'r-default-route', label: 'Configure a Default Route' },
  services: { kind: 'server', lessonId: 'v-meet', label: 'Meet the Server' },
  security: { kind: 'router', lessonId: 'r-secret', label: 'Configure an Enable Secret' },
  troubleshooting: { kind: 'pc', lessonId: 'p-diagnose', label: 'Diagnose Connectivity' },
}

function QuizBlock({ section }: { section: Lesson['content'][number] }) {
  const [picked, setPicked] = useState<number | null>(null)
  const correct = picked === section.answerIndex
  return (
    <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">Quick check</div>
      <p className="mt-1 text-[12px] font-semibold text-[var(--text-primary)]">{section.question}</p>
      <div className="mt-2 space-y-1.5">
        {section.options?.map((opt, i) => {
          const chosen = picked === i
          const isAnswer = i === section.answerIndex
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
                    ? 'border-red-500/60 text-red-300'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-bright)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="font-data text-[10px] text-[var(--text-dim)]">{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <p className={`mt-2 text-[11px] ${correct ? 'text-[var(--status-up)]' : 'text-[var(--accent-amber)]'}`}>
          {correct ? '✓ Correct. ' : 'Not quite. '}
          {section.explanation}
        </p>
      )}
    </div>
  )
}

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
  const openDeviceLabLesson = useUIStore((s) => s.openDeviceLabLesson)
  const setActiveView = useUIStore((s) => s.setActiveView)

  const relatedLabs = useMemo(
    () => ALL_LABS.filter((lab) => module.relatedLabIds?.includes(lab.id)),
    [module.relatedLabIds],
  )
  const deviceLab = MODULE_DEVICE_LAB[module.id]

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
          {lesson.content.map((section, index) => {
            if (section.type === 'quiz') return <QuizBlock key={index} section={section} />
            if (section.type === 'explainer') {
              const Explainer = EXPLAINERS[section.text]
              return Explainer ? <Explainer key={index} /> : null
            }
            return <SectionBlock key={index} type={section.type} text={section.text} />
          })}

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
            {deviceLab && (
              <button
                type="button"
                className="flex items-center gap-1.5 border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--accent-link)] transition-colors hover:border-[var(--accent-link)]"
                onClick={() => openDeviceLabLesson(deviceLab.kind, deviceLab.lessonId)}
              >
                <Monitor className="h-3.5 w-3.5" strokeWidth={1.75} />
                Try in Device Lab: {deviceLab.label}
              </button>
            )}
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
  /** Active interactive concept lab, if any. */
  const [interactive, setInteractive] = useState<
    { moduleId: string; lessonId: string; phase: 'intro' | 'learn' | 'practice' } | null
  >(null)

  const openModule = CURRICULUM.find((m) => m.id === openModuleId)
  const openLesson = openModule?.lessons.find((l) => l.id === openLessonId)

  if (interactive) {
    const lesson = INTERACTIVE_LESSONS[interactive.lessonId]
    if (lesson) {
      const done = Boolean(lessons[`${interactive.moduleId}/${lesson.id}`])
      if (interactive.phase === 'intro') {
        return (
          <LabIntro
            lesson={lesson}
            done={done}
            onLearn={() => setInteractive({ ...interactive, phase: 'learn' })}
            onPractice={() => setInteractive({ ...interactive, phase: 'practice' })}
            onBack={() => setInteractive(null)}
          />
        )
      }
      return (
        <InteractiveLessonRunner
          moduleId={interactive.moduleId}
          lesson={lesson}
          startAtPractice={interactive.phase === 'practice'}
          onExit={() => setInteractive(null)}
        />
      )
    }
  }

  const totalDone = CURRICULUM.reduce(
    (sum, m) => sum + m.lessons.filter((l) => lessons[`${m.id}/${l.id}`]).length,
    0,
  )
  const totalAvailable = CURRICULUM.reduce((sum, m) => sum + m.lessons.length, 0)
  const overallPct = totalAvailable ? Math.round((totalDone / totalAvailable) * 100) : 0

  // Learn hub - a linear walk of every teachable lesson in curriculum order, used
  // to resolve "Continue Learning" (first unfinished lesson you've already reached)
  // and "Recommended Next" (the lesson to line up after that).
  const orderedLessons = useMemo(
    () =>
      CURRICULUM.filter((m) => !m.comingSoon).flatMap((m) =>
        m.lessons.map((l) => ({
          moduleId: m.id,
          moduleTitle: m.title,
          level: m.level,
          lesson: l,
          done: Boolean(lessons[`${m.id}/${l.id}`]),
        })),
      ),
    [lessons],
  )
  const firstIncompleteIdx = orderedLessons.findIndex((x) => !x.done)
  const anyDone = totalDone > 0
  const continueItem =
    anyDone && firstIncompleteIdx >= 0 ? orderedLessons[firstIncompleteIdx] : null
  const recommendedIdx = continueItem
    ? orderedLessons.findIndex((x, i) => i > firstIncompleteIdx && !x.done)
    : firstIncompleteIdx
  const recommendedItem = recommendedIdx >= 0 ? orderedLessons[recommendedIdx] : null

  const openTo = (moduleId: string, lessonId: string) => {
    setOpenModuleId(moduleId)
    setOpenLessonId(lessonId)
  }

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
          Learning - CCNA-level curriculum
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
        <div className="mx-auto max-w-3xl">
          {(continueItem || recommendedItem) && (
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              {continueItem && (
                <button
                  type="button"
                  onClick={() => openTo(continueItem.moduleId, continueItem.lesson.id)}
                  className="panel flex flex-col items-start border border-[var(--accent-link)] bg-[var(--accent-link-dim)] p-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--accent-link)_22%,transparent)]"
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-link)]">
                    <BookOpen className="h-3 w-3" strokeWidth={2} />
                    Continue learning
                  </span>
                  <span className="mt-1.5 text-[13px] font-bold text-[var(--text-primary)]">
                    {continueItem.lesson.title}
                  </span>
                  <span className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                    L{continueItem.level} · {continueItem.moduleTitle} · {continueItem.lesson.minutes} min
                  </span>
                  <span className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-link)]">
                    Continue <ArrowRight className="h-3 w-3" strokeWidth={2} />
                  </span>
                </button>
              )}
              {recommendedItem && (
                <button
                  type="button"
                  onClick={() => openTo(recommendedItem.moduleId, recommendedItem.lesson.id)}
                  className="panel flex flex-col items-start border p-3 text-left transition-colors hover:border-[var(--border-bright)] hover:bg-[var(--bg-elevated)]"
                >
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
                    <Sparkles className="h-3 w-3" strokeWidth={2} />
                    {continueItem ? 'Recommended next' : 'Start here'}
                  </span>
                  <span className="mt-1.5 text-[13px] font-bold text-[var(--text-primary)]">
                    {recommendedItem.lesson.title}
                  </span>
                  <span className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                    L{recommendedItem.level} · {recommendedItem.moduleTitle} · {recommendedItem.lesson.minutes} min
                  </span>
                  <span className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    Open lesson <ArrowRight className="h-3 w-3" strokeWidth={2} />
                  </span>
                </button>
              )}
            </div>
          )}
          {!continueItem && !recommendedItem && totalDone > 0 && (
            <div className="mb-3 flex items-center gap-2 border border-[var(--status-up)] bg-[rgba(63,185,80,0.06)] px-3 py-2 text-[11px] text-[var(--status-up)]">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Every lesson complete - revisit any module below, or head to the Lab Library for troubleshooting challenges.
            </div>
          )}
          <ConceptMasteryPanel />
        </div>
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

                {expanded && !module.comingSoon &&
                  moduleInteractiveIds(module).map((lessonId) => {
                    const il = INTERACTIVE_LESSONS[lessonId]
                    return (
                      <button
                        key={lessonId}
                        type="button"
                        onClick={() =>
                          setInteractive({ moduleId: module.id, lessonId, phase: 'intro' })
                        }
                        className="flex w-full items-center gap-2.5 border-t border-[var(--border)] bg-[var(--accent-link-dim)] px-3 py-2.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--accent-link)_22%,transparent)]"
                      >
                        <GraduationCap className="h-4 w-4 shrink-0 text-[var(--accent-link)]" strokeWidth={1.75} />
                        <span className="flex-1">
                          <span className="block text-[12px] font-bold text-[var(--text-primary)]">
                            Interactive Lesson · {il.title}
                          </span>
                          <span className="block text-[10px] text-[var(--text-secondary)]">
                            {il.subtitle} · guided visuals + practice
                          </span>
                        </span>
                        <span className="badge badge-cyan text-[9px]">
                          {Boolean(lessons[`${module.id}/${lessonId}`]) ? 'done' : 'new'}
                        </span>
                      </button>
                    )
                  })}

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
