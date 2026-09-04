import { ExplainPopover } from '@/components/learn/ExplainPopover'

/**
 * TCP vs UDP at a glance - a split-screen property table. Deliberately static:
 * the animated behaviour lives in TcpReliabilityWidget; this is the summary the
 * learner keeps in their head.
 */

const ROWS: { trait: string; tcp: string; udp: string }[] = [
  { trait: 'Connection', tcp: 'Set up first (handshake)', udp: 'None - just send' },
  { trait: 'Delivery', tcp: 'Guaranteed (resends losses)', udp: 'Best-effort' },
  { trait: 'Ordering', tcp: 'Reassembled in order', udp: 'Arrive in any order' },
  { trait: 'Acknowledgements', tcp: 'Every byte ACKed', udp: 'None' },
  { trait: 'Flow / congestion control', tcp: 'Yes', udp: 'No' },
  { trait: 'Header overhead', tcp: '20+ bytes', udp: '8 bytes' },
  { trait: 'Speed to first byte', tcp: 'Slower (round trips first)', udp: 'Immediate' },
  { trait: 'Typical uses', tcp: 'Web, SSH, email, file transfer', udp: 'DNS, VoIP, video, gaming' },
]

export function TransportCompareWidget() {
  return (
    <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="font-data text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          TCP vs UDP
        </span>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr] text-[11px]">
        <div className="border-b border-[var(--border)] px-3 py-2 font-data text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
          Property
        </div>
        <div className="flex items-center gap-1 border-b border-l border-[var(--border)] px-3 py-2 font-data text-[10px] font-bold uppercase tracking-widest text-[var(--accent-link)]">
          TCP <ExplainPopover objectKey="tcp" />
        </div>
        <div className="flex items-center gap-1 border-b border-l border-[var(--border)] px-3 py-2 font-data text-[10px] font-bold uppercase tracking-widest text-[var(--accent-amber)]">
          UDP <ExplainPopover objectKey="udp" />
        </div>

        {ROWS.map((r) => (
          <div key={r.trait} className="contents">
            <div className="border-b border-[var(--border)] px-3 py-2 text-[var(--text-secondary)]">
              {r.trait}
            </div>
            <div className="border-b border-l border-[var(--border)] px-3 py-2 text-[var(--text-primary)]">
              {r.tcp}
            </div>
            <div className="border-b border-l border-[var(--border)] px-3 py-2 text-[var(--text-primary)]">
              {r.udp}
            </div>
          </div>
        ))}
      </div>

      <p className="px-3 py-2.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
        Same job - move bytes between two apps. TCP pays a setup and bookkeeping cost to
        guarantee every byte arrives in order. UDP skips all of it: faster and lighter, but
        the application deals with any loss itself.
      </p>
    </div>
  )
}
