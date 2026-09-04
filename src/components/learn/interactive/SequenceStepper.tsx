import { useState } from 'react'
import { ArrowRight, Check, RotateCcw } from 'lucide-react'

/**
 * Shared shell for the learner-paced protocol animations (DHCP, DNS, NAT,
 * ICMP, ...). The learner presses "Next" to advance one exchange at a time -
 * nothing is on a timer. Each widget supplies its `frames` (one caption each)
 * and a `render(i)` that draws the stage for frame i.
 *
 * Same visual idiom as the bordered interactive cards elsewhere in Learn.
 */
export function SequenceStepper({
  label,
  frames,
  render,
  startLabel = 'Start',
  nextLabel = 'Next',
  doneLabel,
  doneTone = 'up',
  stageClassName = 'h-28',
}: {
  label: string
  frames: { caption: string }[]
  render: (i: number) => React.ReactNode
  startLabel?: string
  nextLabel?: string
  doneLabel: string
  doneTone?: 'up' | 'amber'
  /** Height utility for the stage area (default h-28). */
  stageClassName?: string
}) {
  const [i, setI] = useState(0)
  const atEnd = i === frames.length - 1
  const toneVar = doneTone === 'amber' ? 'var(--accent-amber)' : 'var(--status-up)'

  return (
    <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="font-data text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          {label}
        </span>
        <button
          type="button"
          onClick={() => setI(0)}
          className="flex items-center gap-1 border border-[var(--border)] px-2 py-0.5 font-data text-[10px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-link)] hover:text-[var(--accent-link)]"
        >
          <RotateCcw className="h-3 w-3" />
          Restart
        </button>
      </div>

      <div className="p-4">
        <div className={`relative ${stageClassName}`}>{render(i)}</div>

        <div className="mt-3 flex justify-center gap-1.5">
          {frames.map((_, k) => (
            <div
              key={k}
              className={`h-1 w-7 transition-colors ${k <= i ? 'bg-[var(--accent-link)]' : 'bg-[var(--border)]'}`}
            />
          ))}
        </div>

        <p className="mt-3 min-h-[3.5rem] text-center text-[12px] leading-relaxed text-[var(--text-secondary)]">
          {frames[i].caption}
        </p>

        <div className="mt-2 flex justify-center">
          {atEnd ? (
            <span
              className="flex items-center gap-1.5 border px-3 py-1.5 text-[12px] font-semibold"
              style={{ borderColor: toneVar, color: toneVar }}
            >
              <Check className="h-3.5 w-3.5" />
              {doneLabel}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setI((v) => Math.min(v + 1, frames.length - 1))}
              className="flex items-center gap-1.5 border border-[var(--accent-link)] bg-[var(--accent-link-dim)] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-link)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent-link)_22%,transparent)]"
            >
              {i === 0 ? startLabel : nextLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── shared stage pieces ─────────────────────────────────────────────────── */

export function StageNode({
  label,
  sub,
  x,
  active,
  tone = 'link',
}: {
  label: string
  sub?: string
  /** left offset as a percentage string, e.g. "6%". */
  x: string
  active?: boolean
  tone?: 'link' | 'amber' | 'up'
}) {
  const color =
    tone === 'amber' ? 'var(--accent-amber)' : tone === 'up' ? 'var(--status-up)' : 'var(--accent-link)'
  return (
    <div
      className="absolute top-1/2 flex w-24 -translate-y-1/2 flex-col items-center border px-1 py-1.5 text-center transition-colors"
      style={{
        left: x,
        borderColor: active ? color : 'var(--border-bright)',
        background: active ? 'color-mix(in srgb, var(--accent-link) 8%, var(--bg-inset))' : 'var(--bg-inset)',
      }}
    >
      <span className="font-data text-[10px] font-bold text-[var(--text-primary)]">{label}</span>
      {sub && <span className="mt-0.5 font-data text-[8px] leading-tight text-[var(--text-dim)]">{sub}</span>}
    </div>
  )
}

export function StagePacket({
  label,
  x,
  tone = 'link',
}: {
  label: string
  x: string
  tone?: 'link' | 'amber' | 'up' | 'down'
}) {
  const color =
    tone === 'amber'
      ? 'var(--accent-amber)'
      : tone === 'up'
        ? 'var(--status-up)'
        : tone === 'down'
          ? 'var(--status-down)'
          : 'var(--accent-link)'
  return (
    <div
      className="absolute top-1/2 z-10 -translate-y-1/2 border px-1.5 py-0.5 font-data text-[9px] font-bold transition-all duration-700 ease-in-out"
      style={{ left: x, borderColor: color, color, background: 'var(--bg-elevated)' }}
    >
      {label}
    </div>
  )
}
