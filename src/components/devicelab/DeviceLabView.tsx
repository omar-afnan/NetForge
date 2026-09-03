import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Cable, ChevronLeft, Cpu, Lightbulb, Monitor, Network, Server } from 'lucide-react'
import { useDeviceLabStore } from '@/store/deviceLabStore'
import { useUIStore } from '@/store/uiStore'
import type { DeviceKind } from '@/store/deviceLabStore'
import { COURSES, allLessons, findLesson } from '@/devicelab/lessons'
import { explorerHotspots, explorerFirstLesson } from '@/devicelab/explorerData'
import { DeviceExplorer } from '@/components/devicelab/DeviceExplorer'
// The bench pulls in three.js - keep it out of the main bundle.
const HardwareBench = lazy(() =>
  import('@/components/devicelab/HardwareBench').then((m) => ({ default: m.HardwareBench })),
)
import { BENCHES } from '@/devicelab/hardwareBench'
import type { LessonCheckCtx } from '@/devicelab/lessons'
import type { CliDevice, EndpointDevice } from '@/devicelab/cli'
import { celebrateLab } from '@/lib/celebrate'
import { handleMessage } from '@/assistant/engine'
import { VideoContent } from '@/components/common/VideoContent'

const COURSE_ICONS = { router: Network, switch: Cpu, server: Server, pc: Monitor } as const

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-inset)]">
        <div className="h-full rounded-full bg-[var(--accent-link)] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[10px] text-[var(--text-dim)]">{done} / {total} completed</div>
    </div>
  )
}

function HomePage({ onOpen, onOpenBench }: { onOpen: (kind: DeviceKind) => void; onOpenBench: (benchId: string) => void }) {
  const progress = useDeviceLabStore((s) => s.progress)
  const benchDone = useDeviceLabStore((s) => s.benchDone)
  return (
    <div className="view-enter flex h-full flex-col overflow-auto">
      <div className="panel-header">Device Lab</div>
      <div className="mx-auto w-full max-w-4xl p-3">
        <h1 className="text-base font-bold text-[var(--text-primary)]">Learn how real network devices are configured.</h1>
        <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
          Guided, hands-on configuration lessons on simulated devices. Choose a device to begin - your progress is saved locally.
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {COURSES.map((course) => {
            const Icon = COURSE_ICONS[course.kind]
            const lessons = allLessons(course)
            const done = lessons.filter((l) => progress[course.kind].includes(l.id)).length
            return (
              <button
                key={course.kind}
                type="button"
                onClick={() => onOpen(course.kind)}
                className="lesson-card hover-lift group rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-left transition-all hover:border-[var(--accent-link)] hover:shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-bright)] bg-[var(--bg-inset)]">
                    <Icon className="h-4 w-4 text-[var(--accent-link)]" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[var(--text-primary)]">{course.title}</div>
                    <div className="text-[10.5px] text-[var(--text-dim)]">{course.subtitle}</div>
                  </div>
                </div>
                <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-secondary)]">{course.blurb}</p>
                <div className="mt-2.5">
                  <ProgressBar done={done} total={lessons.length} />
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <Cable className="h-4 w-4 text-[var(--accent-link)]" strokeWidth={1.75} />
          <h2 className="text-[13px] font-bold text-[var(--text-primary)]">Hardware Bench</h2>
          <span className="text-[10.5px] text-[var(--text-dim)]">Plug it in - connect power and cables, step by step.</span>
        </div>
        <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
          {BENCHES.map((bench) => {
            const complete = benchDone.includes(bench.id)
            return (
              <button
                key={bench.id}
                type="button"
                onClick={() => onOpenBench(bench.id)}
                className="lesson-card hover-lift group rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-left transition-all hover:border-[var(--accent-link)] hover:shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-bright)] bg-[var(--bg-inset)]">
                    <Cable className="h-4 w-4 text-[var(--accent-link)]" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[var(--text-primary)]">{bench.title}</div>
                    <div className="text-[10.5px] text-[var(--text-dim)]">{bench.subtitle}</div>
                  </div>
                  {complete && (
                    <span className="ml-auto rounded-full border border-[var(--status-up)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--status-up)]">
                      Done
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-secondary)]">{bench.blurb}</p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function LessonListPage({ kind, onBack, onOpen, onExplore }: { kind: DeviceKind; onBack: () => void; onOpen: (lessonId: string) => void; onExplore: () => void }) {
  const progress = useDeviceLabStore((s) => s.progress)
  const course = COURSES.find((c) => c.kind === kind)!
  const lessons = allLessons(course)
  const done = lessons.filter((l) => progress[kind].includes(l.id)).length
  // A lesson is unlocked when every prior lesson is completed (prerequisite chain).
  let lockedEncountered = false

  return (
    <div className="view-slide-enter flex h-full flex-col overflow-auto">
      <div className="panel-header flex items-center gap-2">
        <button type="button" onClick={onBack} className="flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label="Back to Device Lab">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[var(--text-dim)]">/</span>
        <span>{course.title}</span>
        <span className="ml-auto font-data text-[10px] text-[var(--accent-link)]">{done}/{lessons.length}</span>
      </div>
      <div className="mx-auto w-full max-w-3xl p-3">
        <h1 className="text-base font-bold text-[var(--text-primary)]">{course.title}</h1>
        <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{course.blurb}</p>
        <div className="mt-2.5">
          <ProgressBar done={done} total={lessons.length} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExplore}
            className="rounded-md border border-[var(--accent-link)] bg-[var(--accent-link)]/10 px-3 py-1.5 text-[11.5px] font-semibold text-[var(--accent-link)] transition-colors hover:bg-[var(--accent-link)]/20"
          >
            Explore the {course.title.replace('Course', '').trim()} first
          </button>
          <button
            type="button"
            onClick={() => onOpen(lessons[0]?.id ?? '')}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[11.5px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Skip Introduction
          </button>
        </div>
        {course.sections.map((section) => (
          <div key={section.label} className="mt-4">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">{section.label}</div>
            <div className="overflow-hidden rounded-md border border-[var(--border)]">
              {section.lessons.map((lesson) => {
                const completed = progress[kind].includes(lesson.id)
                const locked = lockedEncountered && !completed
                if (!completed && !locked) lockedEncountered = true
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    disabled={locked}
                    onClick={() => onOpen(lesson.id)}
                    className={`lesson-card flex w-full items-center gap-2.5 border-b border-[var(--border)] px-3 py-2.5 text-left last:border-b-0 transition-colors ${
                      locked ? 'cursor-not-allowed opacity-40' : 'hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <span className={`font-data text-[12px] ${completed ? 'text-[var(--status-up)]' : 'text-[var(--text-dim)]'}`}>
                      {completed ? '✓' : locked ? '🔒' : '○'}
                    </span>
                    <span className="flex-1">
                      <span className="block text-[13px] font-semibold text-[var(--text-primary)]">{lesson.title}</span>
                      <span className="block text-[11px] text-[var(--text-dim)]">{lesson.description}</span>
                    </span>
                    <span className="hidden border border-[var(--border)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[var(--text-dim)] sm:inline">
                      {lesson.difficulty}
                    </span>
                    <span className="font-data text-[10px] text-[var(--text-dim)]">~{lesson.minutes}m</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Device panels (right side) ─────────────────────────────────────────── */

function maskShort(mask: string | null): string {
  if (!mask) return '?'
  const bits = mask.split('.').map((p) => Number(p).toString(2).padStart(8, '0')).join('')
  return String(bits.indexOf('0') === -1 ? 32 : bits.indexOf('0'))
}

function ConsolePanel({ kind, device }: { kind: 'router' | 'switch'; device: CliDevice }) {
  const lines = useDeviceLabStore((s) => (kind === 'router' ? s.routerConsole : s.switchConsole))
  const sendCommand = useDeviceLabStore((s) => s.sendCommand)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [lines])

  const submit = () => {
    if (!input.trim()) return
    sendCommand(kind, input)
    setInput('')
  }

  const awaiting = device.awaitingPassword
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[#0b1220]">
      <div className="border-b border-[var(--border)] px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
        Console
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-2.5 font-mono text-[11px] leading-relaxed">
        {lines.map((line) => (
          <div
            key={line.id}
            className={
              line.tone === 'in' ? 'text-[var(--accent-link)]'
              : line.tone === 'err' ? 'text-red-400'
              : line.tone === 'ok' ? 'text-emerald-400'
              : 'text-slate-300'
            }
          >
            {line.text}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-1.5">
        <span className="shrink-0 font-mono text-[11px] text-[var(--accent-link)]">{awaiting ? 'Password:' : ''}</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder={awaiting ? '' : 'type a command…'}
          spellCheck={false}
          autoComplete="off"
          className="w-full bg-transparent font-mono text-[11px] text-slate-100 outline-none placeholder:text-slate-600"
        />
        <button type="button" onClick={submit} className="shrink-0 rounded border border-[var(--border-bright)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          Enter
        </button>
      </div>
    </div>
  )
}

function CliDevicePanel({ kind, device }: { kind: 'router' | 'switch'; device: CliDevice }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-bright)] bg-[var(--bg-inset)]">
          {kind === 'router' ? <Network className="h-5 w-5 text-[var(--accent-link)]" strokeWidth={1.5} /> : <Cpu className="h-5 w-5 text-[var(--accent-amber)]" strokeWidth={1.5} />}
        </div>
        <div>
          <div className="font-mono text-[13px] font-bold text-[var(--text-primary)]">{device.hostname}</div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-dim)]">{kind === 'router' ? 'Router' : 'Switch'}</div>
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-1">
          {device.interfaces.map((iface) => (
            <div key={iface.name} className="rounded-sm border border-[var(--border)] px-1.5 py-0.5 text-center">
              <div className="font-mono text-[10px] text-[var(--text-secondary)]">{iface.short}</div>
              <div className="font-mono text-[9px] text-[var(--text-dim)]">{iface.ip ? `${iface.ip}/${maskShort(iface.mask)}` : 'no IP'}</div>
              <div className={`font-mono text-[9px] ${iface.status === 'up' ? 'text-[var(--status-up)]' : 'text-red-400'}`}>
                ● {iface.status === 'up' ? 'UP' : iface.status === 'down' ? 'DOWN' : 'ADMIN DOWN'}
              </div>
            </div>
          ))}
        </div>
      </div>
      <ConsolePanel kind={kind} device={device} />
    </div>
  )
}

function EndpointPanel({ kind, device, onInspected }: { kind: 'server' | 'pc'; device: EndpointDevice; onInspected: () => void }) {
  const setEndpoint = useDeviceLabStore((s) => s.setEndpoint)
  const pingEndpoint = useDeviceLabStore((s) => s.pingEndpoint)
  const toggleService = useDeviceLabStore((s) => s.toggleService)
  const [form, setForm] = useState({ ip: device.ip ?? '', mask: device.mask ?? '', gateway: device.gateway ?? '', dns: device.dns ?? '' })
  const [errors, setErrors] = useState<string[]>([])
  const [pingDest, setPingDest] = useState(device.gateway ?? '')
  const [lastPing, setLastPing] = useState<{ ok: boolean; destination: string; detail: string } | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    setForm({ ip: device.ip ?? '', mask: device.mask ?? '', gateway: device.gateway ?? '', dns: device.dns ?? '' })
    setPingDest(device.gateway ?? '')
  }, [device.ip, device.mask, device.gateway, device.dns])

  const isServer = kind === 'server'
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
      <div className="flex items-center gap-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border-bright)] bg-[var(--bg-inset)]">
          {isServer ? <Server className="h-5 w-5 text-[var(--accent-link)]" strokeWidth={1.5} /> : <Monitor className="h-5 w-5 text-[var(--accent-amber)]" strokeWidth={1.5} />}
        </div>
        <div>
          <div className="font-mono text-[13px] font-bold text-[var(--text-primary)]">{device.hostname}</div>
          <div className={`font-mono text-[10px] ${device.ip && device.gateway ? 'text-[var(--status-up)]' : 'text-red-400'}`}>
            ● {device.ip && device.gateway ? 'Connected' : 'Not configured'}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">Network</div>
        {([
          ['ip', 'IPv4 Address'],
          ['mask', 'Subnet Mask'],
          ['gateway', 'Default Gateway'],
          ['dns', 'DNS'],
        ] as const).map(([field, label]) => (
          <label key={field} className="mb-1.5 block">
            <span className="mb-0.5 block text-[11px] text-[var(--text-secondary)]">{label}</span>
            <input
              type="text"
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              placeholder="0.0.0.0"
              spellCheck={false}
              className="w-full rounded border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 font-mono text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-link)]"
            />
          </label>
        ))}
        <button
          type="button"
          onClick={() => setErrors(setEndpoint(kind, form))}
          className="mt-1 w-full rounded-md border border-[var(--accent-link)] bg-[var(--accent-link)]/10 px-3 py-1.5 text-[11.5px] font-semibold text-[var(--accent-link)] hover:bg-[var(--accent-link)]/20"
        >
          Apply Configuration
        </button>
        {errors.length > 0 && (
          <div className="mt-1.5 rounded border border-red-500/40 bg-red-500/10 p-2 text-[11px] text-red-300">
            {errors.map((err) => <div key={err}>✗ {err}</div>)}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setShowDetails(!showDetails)
            if (!showDetails) onInspected()
          }}
          className="mt-2.5 text-[11px] text-[var(--text-dim)] underline hover:text-[var(--text-secondary)]"
        >
          {showDetails ? 'Hide' : 'Show'} Interface Details
        </button>
        {showDetails && (
          <div className="mt-1.5 rounded border border-[var(--border)] bg-[var(--bg-inset)] p-2 font-mono text-[10.5px] text-[var(--text-secondary)]">
            <div>Interface: Ethernet0 (1000 Mbps, full duplex)</div>
            <div>MAC: 00:1B:44:11:3A:{kind === 'server' ? 'B7' : 'C4'}</div>
            <div>MTU: 1500 · DHCP: off (static)</div>
            <div>Link: {device.linked ? 'up' : 'down'}</div>
          </div>
        )}
      </div>
      <ConnectivityPanel kind={kind} pingDest={pingDest} setPingDest={setPingDest} lastPing={lastPing} setLastPing={setLastPing} pingEndpoint={pingEndpoint} />
      <ServicesPanel isServer={isServer} device={device} toggleService={toggleService} />
    </div>
  )
}

function ConnectivityPanel({ kind, pingDest, setPingDest, lastPing, setLastPing, pingEndpoint }: {
  kind: 'server' | 'pc'
  pingDest: string
  setPingDest: (v: string) => void
  lastPing: { ok: boolean; destination: string; detail: string } | null
  setLastPing: (p: { ok: boolean; destination: string; detail: string }) => void
  pingEndpoint: (kind: 'server' | 'pc', destination: string) => { ok: boolean; destination: string; detail: string }
}) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">Connectivity</div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={pingDest}
          onChange={(e) => setPingDest(e.target.value)}
          placeholder="192.168.1.1"
          spellCheck={false}
          className="w-full rounded border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 font-mono text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-link)]"
        />
        <button
          type="button"
          onClick={() => {
            const result = pingEndpoint(kind, pingDest.trim())
            setLastPing(result)
            // Play a synthesised audio cue so the user gets feedback even when
            // they are looking at the canvas, not the panel.
            if (result.ok) import('@/lib/audioEngine').then(m => m.playPingSuccess())
            else            import('@/lib/audioEngine').then(m => m.playPingFailure())
          }}
          className="shrink-0 rounded-md border border-[var(--border-bright)] px-3 py-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Run Ping
        </button>
      </div>
      {lastPing && (
        <div className={`mt-1.5 rounded border p-2 font-mono text-[11px] ${lastPing.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>
          {lastPing.ok ? `✓ Reply from ${lastPing.destination} - ${lastPing.detail}` : `✗ Ping to ${lastPing.destination} failed - ${lastPing.detail}`}
        </div>
      )}
    </div>
  )
}

function ServicesPanel({ isServer, device, toggleService }: {
  isServer: boolean
  device: EndpointDevice
  toggleService: (kind: 'server', service: 'web' | 'dns' | 'dhcp') => void
}) {
  if (!isServer) return null
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">Services</div>
      <div className="mb-2 text-[10px] leading-snug text-[var(--text-dim)]">These services are visual simulations - no real sockets are opened.</div>
      {([
        ['web', 'Web Server (HTTP)'],
        ['dns', 'DNS Server'],
        ['dhcp', 'DHCP Server'],
      ] as const).map(([svc, label]) => (
        <button
          key={svc}
          type="button"
          onClick={() => toggleService('server', svc)}
          className={`mb-1 flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-[11.5px] transition-colors ${
            device.services[svc]
              ? 'border-[var(--status-up)] text-[var(--status-up)]'
              : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-bright)]'
          }`}
        >
          <span>{label}</span>
          <span className="font-mono text-[10px]">{device.services[svc] ? '● RUNNING' : '○ STOPPED'}</span>
        </button>
      ))}
    </div>
  )
}

/* ── Lesson runner (two-column layout) ──────────────────────────────────── */

function LessonRunner({ kind, lessonId, onBack, onOpenLesson }: {
  kind: DeviceKind
  lessonId: string
  onBack: () => void
  onOpenLesson: (id: string) => void
}) {
  const found = findLesson(kind, lessonId)
  const store = useDeviceLabStore()
  // When the user presses "Ask Copilot" we flip a flag in the UI store so
  // App.tsx opens the right sidebar in Copilot mode for this lesson.
  const setDeviceLabCopilotRequested = useUIStore((s) => s.setDeviceLabCopilotRequested)
  const [hintLevel, setHintLevel] = useState(0) // 0 none, 1 hint, 2 solution
  const [feedback, setFeedback] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [inspected, setInspected] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const lastPingRef = useRef<{ ok: boolean; destination: string; detail: string } | undefined>(undefined)
  const setupRef = useRef<string | null>(null)

  useEffect(() => {
    // Reset per-lesson UI state; apply the lesson's scenario to a FRESH device once.
    setHintLevel(0)
    setFeedback(null)
    setCompleted(false)
    setInspected(false)
    lastPingRef.current = undefined
    if (setupRef.current !== lessonId) {
      setupRef.current = lessonId
      store.resetDevice(kind)
      applySetup(kind, lessonId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, kind])

  function applySetup(kind: DeviceKind, id: string) {
    const found = findLesson(kind, id)
    if (!found?.lesson.setup) return
    const fresh = JSON.parse(JSON.stringify(useDeviceLabStore.getState()[kind])) as CliDevice | EndpointDevice
    found.lesson.setup(fresh)
    useDeviceLabStore.setState({ [kind]: fresh } as never)
  }

  if (!found) return null
  const { course, lesson } = found
  const device = store[kind] as CliDevice | EndpointDevice
  const lessons = allLessons(course)
  const index = lessons.findIndex((l) => l.id === lessonId)
  const next = lessons[index + 1]

  const check = () => {
    const ctx: LessonCheckCtx = { lastPing: lastPingRef.current, inspected }
    const result = lesson.check(device, ctx)
    if (result === null) {
      if (!completed) {
        store.completeLesson(kind, lessonId)
        celebrateLab()
        // Audio fanfare for the "task complete" moment — a subtle but distinctive
        // cue so completion feels rewarding even with the screen reader / focus
        // on the device panel.
        import('@/lib/audioEngine').then(m => m.playTaskComplete())
      }
      setCompleted(true)
      setFeedback(null)
    } else {
      setCompleted(false)
      setFeedback(result)
    }
  }

  const askCopilot = () => {
    setDeviceLabCopilotRequested(true)
    handleMessage(
      `I'm in the Device Lab lesson "${lesson.title}" (task: ${lesson.objective}). ` +
      `Can you explain the concepts I need here, without configuring anything for me?`,
    )
  }

  const hardReset = () => {
    setupRef.current = null
    store.resetDevice(kind)
    applySetup(kind, lessonId)
    setFeedback(null)
    setHintLevel(0)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="panel-header flex items-center gap-2">
        <button type="button" onClick={onBack} className="flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]" aria-label="Back to lessons">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[var(--text-dim)]">/</span>
        <span>{lesson.title}</span>
        <span className="ml-auto font-data text-[10px] text-[var(--accent-link)]">Lesson {index + 1} / {lessons.length}</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        {/* LEFT - instructions */}
        <div className="lesson-panel-left min-h-0 overflow-auto border-r border-[var(--border)] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">Lesson</div>
          <h2 className="mt-0.5 text-[15px] font-bold text-[var(--text-primary)]">{lesson.title}</h2>
          <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-secondary)]">{lesson.description}</p>

          <div className="mt-3 border-t border-[var(--border)] pt-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">Objective</div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--text-primary)]">{lesson.objective}</p>
          </div>

          <div className="mt-3 border-t border-[var(--border)] pt-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">What you'll learn</div>
            <ul className="mt-1 space-y-0.5">
              {lesson.learn.map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-[var(--text-secondary)]">
                  <span className="mt-0.5 text-[var(--accent-link)]">•</span> {item}
                </li>
              ))}
            </ul>
          </div>

          {hintLevel >= 1 && (
            <div className="mt-3 rounded-md border border-[var(--border-bright)] bg-[var(--bg-elevated)] p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--accent-amber)]">
                <Lightbulb className="h-3 w-3" /> Hint
              </div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-secondary)]">{lesson.hint}</p>
            </div>
          )}
          {hintLevel >= 2 && (
            <div className="mt-2 rounded-md border border-[var(--border-bright)] bg-[var(--bg-elevated)] p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">Solution</div>
              <pre className="mt-0.5 whitespace-pre-wrap font-mono text-[11px] leading-snug text-[var(--text-primary)]">{lesson.solution}</pre>
            </div>
          )}

          {feedback && !completed && (
            <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-red-300">Not quite</div>
              <p className="mt-0.5 whitespace-pre-line text-[11.5px] leading-snug text-red-200">{feedback}</p>
            </div>
          )}

          {completed ? (
            <div className="task-complete-badge mt-3 rounded-md border border-[var(--status-up)]/50 bg-[var(--status-up)]/10 p-3">
              <div className="text-[12px] font-bold text-[var(--status-up)]">✓ Task completed</div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-secondary)]">The simulated device state genuinely passes this lesson's checks.</p>
              {next && (
                <button
                  type="button"
                  onClick={() => onOpenLesson(next.id)}
                  className="mt-2.5 rounded-md border border-[var(--accent-link)] bg-[var(--accent-link)]/10 px-3 py-1.5 text-[11.5px] font-semibold text-[var(--accent-link)] hover:bg-[var(--accent-link)]/20"
                >
                  Continue → {next.title}
                </button>
              )}
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={check}
                className="rounded-md border border-[var(--accent-link)] bg-[var(--accent-link)]/10 px-3 py-1.5 text-[11.5px] font-semibold text-[var(--accent-link)] hover:bg-[var(--accent-link)]/20"
              >
                Check Configuration
              </button>
              {hintLevel < 1 && (
                <button type="button" onClick={() => setHintLevel(1)} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[11.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  Show Hint
                </button>
              )}
              {hintLevel === 1 && (
                <button type="button" onClick={() => setHintLevel(2)} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[11.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  Show Solution
                </button>
              )}
              <button type="button" onClick={askCopilot} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[11.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Ask Copilot
              </button>
              <button
                type="button"
                onClick={() => setVideoOpen((v) => !v)}
                className={`rounded-md border px-3 py-1.5 text-[11.5px] transition-colors ${
                  videoOpen
                    ? 'border-[var(--accent-link)] bg-[var(--accent-link)]/10 text-[var(--accent-link)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                aria-expanded={videoOpen}
              >
                {videoOpen ? 'Hide walkthrough' : 'Watch concept'}
              </button>
              <button type="button" onClick={hardReset} className="ml-auto rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[10.5px] text-[var(--text-dim)] hover:text-[var(--text-secondary)]">
                Reset device
              </button>
            </div>
          )}
        </div>

        {/* RIGHT - the interactive device */}
        <div className="lesson-panel-right flex min-h-0 flex-col gap-2 p-3">
          {kind === 'router' && <CliDevicePanel kind="router" device={device as CliDevice} />}
          {kind === 'switch' && <CliDevicePanel kind="switch" device={device as CliDevice} />}
          {(kind === 'server' || kind === 'pc') && (
            <EndpointPanel kind={kind} device={device as EndpointDevice} onInspected={() => setInspected(true)} />
          )}
          {videoOpen && (
            <div className="video-panel-enter mt-1">
              <VideoContent
                title={`${course.title}: ${lesson.title}`}
                description={lesson.objective}
                scenes={[
                  {
                    id: 'concept',
                    label: 'Concept',
                    content: lesson.description,
                  },
                  {
                    id: 'task',
                    label: 'Your task',
                    content: lesson.objective,
                  },
                  {
                    id: 'hint',
                    label: 'Hint',
                    content: lesson.hint,
                  },
                ]}
                onClose={() => setVideoOpen(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom progress strip */}
      <div className="border-t border-[var(--border)] px-3 py-2">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="flex-1">
            <ProgressBar done={store.progress[kind].length} total={lessons.length} />
          </div>
          <span className="font-data text-[10px] text-[var(--text-dim)]">{course.title} {store.progress[kind].length}/{lessons.length}</span>
        </div>
      </div>
    </div>
  )
}

export function DeviceLabView() {
  const [openKind, setOpenKind] = useState<DeviceKind | null>(null)
  const [openLessonId, setOpenLessonId] = useState<string | null>(null)
  const [exploreKind, setExploreKind] = useState<DeviceKind | null>(null)
  const [benchId, setBenchId] = useState<string | null>(null)
  const pending = useUIStore((s) => s.pendingDeviceLabLesson)
  const clearPending = useUIStore((s) => s.clearPendingDeviceLabLesson)

  // Deep-link support: Learn's "Try in Device Lab" opens the lab directly at the
  // matching lesson instead of the course home page.
  // Consume the deep-link exactly once: clear it BEFORE setting state so a
  // re-render cannot re-fire the same navigation. This was a real bug — the
  // previous effect could run twice during the same render pass when both
  // `pending` and `clearPending` were in the deps, briefly leaving the user
  // trapped inside the same lesson.
  useEffect(() => {
    if (pending) {
      const { kind, lessonId } = pending
      clearPending()
      setOpenKind(kind)
      setOpenLessonId(lessonId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The right sidebar (Inspector / AI Copilot) is only useful while a lesson
  // with the interactive device is open - "Ask Copilot" answers render there.
  const setDeviceLabLessonOpen = useUIStore((s) => s.setDeviceLabLessonOpen)
  useEffect(() => {
    setDeviceLabLessonOpen(Boolean(openKind && openLessonId))
    return () => setDeviceLabLessonOpen(false)
  }, [openKind, openLessonId, setDeviceLabLessonOpen])

  if (benchId) {
    return (
      <Suspense fallback={<div className="flex h-full items-center justify-center text-[12px] text-[var(--text-dim)]">Loading 3D bench…</div>}>
        <HardwareBench benchId={benchId} onBack={() => setBenchId(null)} />
      </Suspense>
    )
  }
  if (exploreKind) {
    return (
      <DeviceExplorer
        kind={exploreKind}
        hotspots={explorerHotspots[exploreKind]}
        firstLessonId={explorerFirstLesson[exploreKind]}
        onBack={() => setExploreKind(null)}
        onStart={(lessonId) => {
          setExploreKind(null)
          setOpenKind(exploreKind)
          setOpenLessonId(lessonId)
        }}
      />
    )
  }
  if (openKind && openLessonId) {
    return <LessonRunner kind={openKind} lessonId={openLessonId} onBack={() => setOpenLessonId(null)} onOpenLesson={(id) => setOpenLessonId(id)} />
  }
  if (openKind) {
    return <LessonListPage kind={openKind} onBack={() => setOpenKind(null)} onOpen={(id) => setOpenLessonId(id)} onExplore={() => setExploreKind(openKind)} />
  }
  return (
    <HomePage
      onOpen={(kind) => { setOpenKind(kind); setOpenLessonId(null) }}
      onOpenBench={(id) => setBenchId(id)}
    />
  )
}