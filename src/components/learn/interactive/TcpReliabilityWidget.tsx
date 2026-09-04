import { useMemo, useState } from 'react'
import { ArrowRight, Check, RotateCcw } from 'lucide-react'

/**
 * Reliability, side by side with UDP. Five segments/datagrams are sent; the
 * network drops number 3. In `tcp` mode the missing segment is detected and
 * retransmitted until the receiver has all five in order. In `udp` mode the
 * loss is simply permanent - nothing resends it. The learner steps through one
 * event at a time.
 */

type Mode = 'tcp' | 'udp'
type Slot = 'empty' | 'ok' | 'lost'

interface Frame {
  /** Sender chips 1..5: which is lit / lost / resent this frame. */
  sender: (Slot | 'send' | 'resend')[]
  /** Receiver buffer slots 1..5. */
  buffer: Slot[]
  caption: string
}

const N = 5
const rowEmpty = (): Slot[] => Array(N).fill('empty')

function tcpFrames(): Frame[] {
  return [
    {
      sender: rowEmpty(),
      buffer: rowEmpty(),
      caption:
        'A file is split into 5 segments. TCP numbers every one and waits for an acknowledgement (ACK) before it considers it delivered.',
    },
    {
      sender: ['send', 'empty', 'empty', 'empty', 'empty'],
      buffer: ['ok', 'empty', 'empty', 'empty', 'empty'],
      caption: 'Segment 1 arrives. Receiver sends ACK 1. Sender moves on.',
    },
    {
      sender: ['ok', 'send', 'empty', 'empty', 'empty'],
      buffer: ['ok', 'ok', 'empty', 'empty', 'empty'],
      caption: 'Segment 2 arrives. ACK 2.',
    },
    {
      sender: ['ok', 'ok', 'lost', 'empty', 'empty'],
      buffer: ['ok', 'ok', 'lost', 'empty', 'empty'],
      caption: 'Segment 3 is dropped by the network. No ACK 3 comes back.',
    },
    {
      sender: ['ok', 'ok', 'lost', 'send', 'empty'],
      buffer: ['ok', 'ok', 'lost', 'ok', 'empty'],
      caption:
        'Segment 4 arrives - but 3 is still missing. The receiver holds 4 and re-sends ACK 2 (a duplicate ACK): "still waiting for 3".',
    },
    {
      sender: ['ok', 'ok', 'lost', 'ok', 'send'],
      buffer: ['ok', 'ok', 'lost', 'ok', 'ok'],
      caption: 'Segment 5 arrives. Another duplicate ACK 2. The sender now has three duplicate ACKs.',
    },
    {
      sender: ['ok', 'ok', 'resend', 'ok', 'ok'],
      buffer: ['ok', 'ok', 'ok', 'ok', 'ok'],
      caption: 'Three duplicate ACKs trigger a fast retransmit. Segment 3 is sent again - and this time it arrives.',
    },
    {
      sender: ['ok', 'ok', 'ok', 'ok', 'ok'],
      buffer: ['ok', 'ok', 'ok', 'ok', 'ok'],
      caption: 'All 5 segments delivered, in order. This is what "reliable, ordered delivery" means.',
    },
  ]
}

function udpFrames(): Frame[] {
  return [
    {
      sender: rowEmpty(),
      buffer: rowEmpty(),
      caption:
        'The same 5 chunks, sent as UDP datagrams. No connection, no sequence tracking, no acknowledgements.',
    },
    {
      sender: ['send', 'empty', 'empty', 'empty', 'empty'],
      buffer: ['ok', 'empty', 'empty', 'empty', 'empty'],
      caption: 'Datagram 1 arrives. The sender does not wait for anything - it just keeps going.',
    },
    {
      sender: ['ok', 'send', 'empty', 'empty', 'empty'],
      buffer: ['ok', 'ok', 'empty', 'empty', 'empty'],
      caption: 'Datagram 2 arrives.',
    },
    {
      sender: ['ok', 'ok', 'lost', 'empty', 'empty'],
      buffer: ['ok', 'ok', 'lost', 'empty', 'empty'],
      caption: 'Datagram 3 is dropped. Nobody is tracking sequence numbers, so nobody notices.',
    },
    {
      sender: ['ok', 'ok', 'lost', 'send', 'empty'],
      buffer: ['ok', 'ok', 'lost', 'ok', 'empty'],
      caption: 'Datagram 4 arrives and is delivered to the app immediately - ahead of the missing 3.',
    },
    {
      sender: ['ok', 'ok', 'lost', 'ok', 'send'],
      buffer: ['ok', 'ok', 'lost', 'ok', 'ok'],
      caption: 'Datagram 5 arrives.',
    },
    {
      sender: ['ok', 'ok', 'lost', 'ok', 'ok'],
      buffer: ['ok', 'ok', 'lost', 'ok', 'ok'],
      caption:
        'Datagram 3 is gone for good - UDP will never resend it. Lower overhead, but the application must tolerate the gap (or not care).',
    },
  ]
}

export function TcpReliabilityWidget({ mode = 'tcp' }: { mode?: Mode }) {
  const frames = useMemo(() => (mode === 'tcp' ? tcpFrames() : udpFrames()), [mode])
  const [i, setI] = useState(0)
  const frame = frames[i]
  const atEnd = i === frames.length - 1
  const unit = mode === 'tcp' ? 'segment' : 'datagram'
  const delivered = frame.buffer.filter((s) => s === 'ok').length

  return (
    <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="font-data text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          {mode === 'tcp' ? 'TCP' : 'UDP'} · delivering 5 {unit}s
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
        <Row label="Sender" cells={frame.sender.map(chipOf)} />
        <div className="my-3 flex items-center justify-center gap-2 font-data text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
          <span className="h-px w-16 bg-[var(--border)]" />
          network
          <span className="h-px w-16 bg-[var(--border)]" />
        </div>
        <Row label="Receiver" cells={frame.buffer.map(chipOf)} />

        <div className="mt-2 text-center font-data text-[10px] text-[var(--text-dim)]">
          delivered in order: {delivered} / {N}
        </div>

        <div className="mt-3 flex justify-center gap-1.5">
          {frames.map((_, k) => (
            <div
              key={k}
              className={`h-1 w-6 transition-colors ${k <= i ? 'bg-[var(--accent-link)]' : 'bg-[var(--border)]'}`}
            />
          ))}
        </div>

        <p className="mt-3 min-h-[3.5rem] text-center text-[12px] leading-relaxed text-[var(--text-secondary)]">
          {frame.caption}
        </p>

        <div className="mt-2 flex justify-center">
          {atEnd ? (
            <span
              className={`flex items-center gap-1.5 border px-3 py-1.5 text-[12px] font-semibold ${
                mode === 'tcp'
                  ? 'border-[var(--status-up)] text-[var(--status-up)]'
                  : 'border-[var(--accent-amber)] text-[var(--accent-amber)]'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              {mode === 'tcp' ? 'Reliable & ordered' : 'Best-effort only'}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setI((v) => Math.min(v + 1, frames.length - 1))}
              className="flex items-center gap-1.5 border border-[var(--accent-link)] bg-[var(--accent-link-dim)] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-link)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent-link)_22%,transparent)]"
            >
              {i === 0 ? 'Send first' : 'Next event'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface Chip {
  text: string
  cls: string
}

function chipOf(s: Slot | 'send' | 'resend'): Chip {
  switch (s) {
    case 'ok':
    case 'send':
      return { text: '✓', cls: 'border-[var(--status-up)] bg-[color-mix(in_srgb,var(--status-up)_18%,var(--bg-inset))] text-[var(--status-up)]' }
    case 'resend':
      return { text: '↻', cls: 'border-[var(--accent-link)] bg-[var(--accent-link-dim)] text-[var(--accent-link)]' }
    case 'lost':
      return { text: '✕', cls: 'border-[var(--status-down)] bg-[color-mix(in_srgb,var(--status-down)_15%,var(--bg-inset))] text-[var(--status-down)]' }
    default:
      return { text: '·', cls: 'border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-dim)]' }
  }
}

function Row({ label, cells }: { label: string; cells: Chip[] }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 font-data text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
        {label}
      </span>
      <div className="flex flex-1 justify-center gap-1.5">
        {cells.map((c, k) => (
          <div
            key={k}
            className={`flex h-9 w-9 flex-col items-center justify-center border font-data text-[11px] font-bold transition-colors duration-500 ${c.cls}`}
          >
            <span className="text-[8px] text-[var(--text-dim)]">{k + 1}</span>
            <span className="leading-none">{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
