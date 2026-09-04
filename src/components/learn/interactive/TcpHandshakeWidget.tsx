import { useState } from 'react'
import { ArrowRight, Check, RotateCcw } from 'lucide-react'
import { useReducedMotion } from '@/lib/useReducedMotion'
import { ExplainPopover } from '@/components/learn/ExplainPopover'

/**
 * The TCP three-way handshake, one exchange at a time. The learner presses
 * "Next packet" to fire SYN, then SYN-ACK, then ACK, watching the sequence and
 * acknowledgement numbers line up until the connection is ESTABLISHED. Nothing
 * here is on a timer - the learner controls the pace.
 */

interface Phase {
  /** Which arrow is in flight: 0 none, 1 SYN, 2 SYN-ACK, 3 ACK. */
  arrow: 0 | 1 | 2 | 3
  dir: 'ltr' | 'rtl' | null
  flag: string
  seq: string
  caption: string
}

const PHASES: Phase[] = [
  {
    arrow: 0,
    dir: null,
    flag: '',
    seq: '',
    caption: 'Client wants to talk to the server on port 80. Before any data, both sides must agree to open the connection.',
  },
  {
    arrow: 1,
    dir: 'ltr',
    flag: 'SYN',
    seq: 'SEQ=100',
    caption: 'Step 1 - SYN. The client picks a starting sequence number (100) and asks to synchronise.',
  },
  {
    arrow: 2,
    dir: 'rtl',
    flag: 'SYN-ACK',
    seq: 'SEQ=300  ACK=101',
    caption: 'Step 2 - SYN-ACK. The server acknowledges 100 (ACK=101 = "send 101 next") and picks its own sequence number (300).',
  },
  {
    arrow: 3,
    dir: 'ltr',
    flag: 'ACK',
    seq: 'ACK=301',
    caption: 'Step 3 - ACK. The client acknowledges the server (ACK=301). Both sides are now synchronised.',
  },
  {
    arrow: 0,
    dir: null,
    flag: '',
    seq: '',
    caption: 'ESTABLISHED. Data can flow both ways. Every byte from here on is acknowledged - lost data is resent.',
  },
]

export function TcpHandshakeWidget() {
  const reduced = useReducedMotion()
  const [i, setI] = useState(0)
  const phase = PHASES[i]
  const established = i === PHASES.length - 1

  return (
    <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="flex items-center gap-1.5 font-data text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          Three-way handshake
          <ExplainPopover objectKey="handshake" />
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
        <div className="relative grid grid-cols-[80px_1fr_80px] items-start gap-2">
          <Endpoint label="CLIENT" sub="port 51000" active={phase.dir === 'ltr'} />

          <div className="relative h-24">
            {/* the wire */}
            <div className="absolute left-0 right-0 top-1/2 h-px bg-[var(--border)]" />
            {phase.arrow !== 0 && (
              <div
                className={`absolute top-1/2 -translate-y-1/2 border px-1.5 py-0.5 font-data text-[9px] font-bold ${
                  reduced ? '' : 'transition-all duration-700 ease-in-out'
                }`}
                style={{
                  left: phase.dir === 'ltr' ? '78%' : '2%',
                  borderColor: phase.arrow === 3 ? 'var(--status-up)' : 'var(--accent-link)',
                  color: phase.arrow === 3 ? 'var(--status-up)' : 'var(--accent-link)',
                  background: 'var(--bg-elevated)',
                }}
              >
                {phase.dir === 'rtl' && '← '}
                {phase.flag}
                {phase.dir === 'ltr' && ' →'}
              </div>
            )}
            {phase.seq && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 font-data text-[9px] text-[var(--text-dim)]">
                {phase.seq}
              </div>
            )}
            {established && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-[var(--status-up)] bg-[var(--bg-elevated)] px-2 py-1 font-data text-[10px] font-bold text-[var(--status-up)]">
                ESTABLISHED
              </div>
            )}
          </div>

          <Endpoint label="SERVER" sub="port 80" active={phase.dir === 'rtl'} />
        </div>

        {/* step pips */}
        <div className="mt-3 flex justify-center gap-1.5">
          {PHASES.map((_, k) => (
            <div
              key={k}
              className={`h-1 w-8 transition-colors ${
                k <= i ? 'bg-[var(--accent-link)]' : 'bg-[var(--border)]'
              }`}
            />
          ))}
        </div>

        <p className="mt-3 min-h-[3.5rem] text-center text-[12px] leading-relaxed text-[var(--text-secondary)]">
          {phase.caption}
        </p>

        <div className="mt-2 flex justify-center">
          {established ? (
            <span className="flex items-center gap-1.5 border border-[var(--status-up)] px-3 py-1.5 text-[12px] font-semibold text-[var(--status-up)]">
              <Check className="h-3.5 w-3.5" /> Connection open
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setI((v) => Math.min(v + 1, PHASES.length - 1))}
              className="flex items-center gap-1.5 border border-[var(--accent-link)] bg-[var(--accent-link-dim)] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-link)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent-link)_22%,transparent)]"
            >
              {i === 0 ? 'Start handshake' : 'Next packet'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Endpoint({ label, sub, active }: { label: string; sub: string; active: boolean }) {
  return (
    <div
      className={`flex flex-col items-center border px-1 py-2 text-center transition-colors ${
        active
          ? 'border-[var(--accent-link)] bg-[var(--accent-link-dim)]'
          : 'border-[var(--border-bright)] bg-[var(--bg-inset)]'
      }`}
    >
      <span className="font-data text-[10px] font-bold text-[var(--text-primary)]">{label}</span>
      <span className="mt-0.5 font-data text-[8px] leading-tight text-[var(--text-dim)]">{sub}</span>
    </div>
  )
}
