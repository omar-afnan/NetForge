import { SequenceStepper, StageNode, StagePacket } from './SequenceStepper'

/**
 * One Ethernet frame from PC-A to PC-B across a switch. Shows the frame's
 * fields (dst MAC, src MAC, type, payload, FCS) and makes the point that MAC
 * addresses only have meaning on this single link.
 */

const FRAMES = [
  { caption: 'PC-A has data for PC-B and already knows PC-B\'s MAC address. It wraps the data in an Ethernet frame.' },
  { caption: 'The frame header carries a destination MAC, a source MAC and a type field; then the payload, then a checksum (FCS).' },
  { caption: 'PC-A puts the frame on the wire. The switch receives it on PC-A\'s port.' },
  { caption: 'The switch reads the destination MAC and forwards the frame out only PC-B\'s port - not everywhere.' },
  { caption: 'PC-B sees the destination MAC is its own, strips the frame and hands the payload up. MAC addresses mattered only on this one hop.' },
]

export function EthernetFrameWidget() {
  return (
    <SequenceStepper
      label="Ethernet frame"
      frames={FRAMES}
      startLabel="Build the frame"
      doneLabel="Payload delivered"
      stageClassName="h-36"
      render={(i) => (
        <>
          <StageNode label="PC-A" sub="AA:AA:AA:AA:AA:AA" x="2%" active={i <= 1} />
          <StageNode label="SWITCH" x="40%" active={i === 2 || i === 3} />
          <StageNode label="PC-B" sub="BB:BB:BB:BB:BB:BB" x="74%" active={i >= 4} tone={i >= 4 ? 'up' : 'link'} />
          {i === 2 && <StagePacket label="frame →" x="24%" />}
          {i === 3 && <StagePacket label="frame →" x="56%" tone="up" />}
          {i >= 1 && (
            <div className="absolute bottom-0 left-0 right-0 flex overflow-x-auto border border-[var(--border)] font-data text-[8.5px]">
              {[
                ['dst MAC', 'BB:BB:BB:BB:BB:BB', 'var(--accent-amber)'],
                ['src MAC', 'AA:AA:AA:AA:AA:AA', 'var(--accent-link)'],
                ['type', '0x0800', 'var(--text-dim)'],
                ['payload', '…IP packet…', 'var(--text-secondary)'],
                ['FCS', 'crc32', 'var(--text-dim)'],
              ].map(([k, v, c]) => (
                <div key={k} className="flex-1 border-r border-[var(--border)] px-1.5 py-1 last:border-r-0">
                  <div className="uppercase tracking-wider text-[var(--text-dim)]">{k}</div>
                  <div style={{ color: c as string }}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    />
  )
}
