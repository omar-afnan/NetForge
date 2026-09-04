import { SequenceStepper, StageNode, StagePacket } from './SequenceStepper'

/**
 * How a router picks where to send a packet: it scans its routing table and
 * takes the most specific (longest-prefix) match. The default route is only
 * used when nothing else matches.
 */

const TABLE: { net: string; via: string; more: boolean }[] = [
  { net: '10.1.0.0/24', via: 'connected · Gi0/0', more: false },
  { net: '10.2.0.0/16', via: 'via 10.1.0.2 · Gi0/1', more: true },
  { net: '0.0.0.0/0', via: 'via 203.0.113.1', more: false },
]

const FRAMES = [
  { caption: 'A packet for 10.2.5.7 arrives at the router. It checks its routing table for a match.' },
  { caption: '10.2.5.7 falls inside 10.2.0.0/16. It also technically matches 0.0.0.0/0 - but /16 is more specific, so it wins.' },
  { caption: 'The router forwards the packet to next-hop 10.1.0.2, out interface Gi0/1.' },
  { caption: 'Longest-prefix match: the route covering the smallest block that still contains the address is always chosen. No match at all -> the packet takes 0.0.0.0/0, the default route.' },
]

export function RoutingTableWidget() {
  return (
    <SequenceStepper
      label="Routing · longest-prefix match"
      frames={FRAMES}
      startLabel="Deliver the packet"
      doneLabel="Forwarded via best route"
      stageClassName="h-44"
      render={(i) => (
        <>
          <StageNode label="PACKET" sub="→ 10.2.5.7" x="2%" active={i === 0} />
          <StageNode label="ROUTER" x="40%" active={i === 1} />
          <StageNode label="10.2.0.0/16" sub="behind 10.1.0.2" x="74%" active={i >= 2} tone={i >= 2 ? 'up' : 'link'} />
          {i === 2 && <StagePacket label="→ next-hop 10.1.0.2" x="52%" tone="up" />}
          <div className="absolute bottom-0 left-0 right-0 border border-[var(--border)] bg-[var(--bg-inset)] font-data text-[9px]">
            <div className="border-b border-[var(--border)] px-2 py-0.5 uppercase tracking-wider text-[var(--text-dim)]">
              show ip route
            </div>
            {TABLE.map((r) => {
              const chosen = i >= 1 && r.net === '10.2.0.0/16'
              return (
                <div
                  key={r.net}
                  className="flex items-center justify-between px-2 py-0.5"
                  style={{
                    color: chosen ? 'var(--status-up)' : 'var(--text-secondary)',
                    background: chosen ? 'color-mix(in srgb, var(--status-up) 12%, transparent)' : 'transparent',
                  }}
                >
                  <span>{r.net}</span>
                  <span className="text-[var(--text-dim)]">{r.via}</span>
                  {chosen && <span>◄ best</span>}
                </div>
              )
            })}
          </div>
        </>
      )}
    />
  )
}
