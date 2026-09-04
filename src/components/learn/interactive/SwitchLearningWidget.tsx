import { SequenceStepper, StageNode, StagePacket } from './SequenceStepper'

/**
 * A switch builds its MAC address table by watching source addresses. Unknown
 * destinations are flooded; once the reply comes back the switch has learned
 * both ends and forwards directly.
 */

const FRAMES = [
  { caption: 'PC-A is on port 1, PC-B on port 2, PC-C on port 3. The switch\'s MAC address table starts empty.' },
  { caption: 'PC-A sends a frame to PC-C. It arrives on port 1, so the switch learns: MAC-A lives on port 1.' },
  { caption: 'There is still no entry for MAC-C, so the switch floods the frame out every other port (2 and 3).' },
  { caption: 'PC-C answers. Its reply arrives on port 3, so the switch learns: MAC-C lives on port 3.' },
  { caption: 'Both ends are now known. Every further frame between A and C goes to just the right port - no more flooding.' },
]

function macTable(i: number) {
  const rows: string[] = []
  if (i >= 1) rows.push('AA:AA:…  →  port 1')
  if (i >= 3) rows.push('CC:CC:…  →  port 3')
  return rows
}

export function SwitchLearningWidget() {
  return (
    <SequenceStepper
      label="Switch · MAC learning"
      frames={FRAMES}
      startLabel="Send a frame"
      doneLabel="Table learned · unicast only"
      stageClassName="h-44"
      render={(i) => {
        const rows = macTable(i)
        return (
          <>
            <StageNode label="PC-A" sub="port 1" x="2%" active={i === 1} />
            <StageNode label="SWITCH" x="40%" active={i >= 1} />
            <StageNode label="PC-C" sub="port 3" x="76%" active={i === 3} tone={i === 3 ? 'up' : 'link'} />
            {i === 1 && <StagePacket label="to MAC-C →" x="22%" />}
            {i === 2 && <StagePacket label="FLOOD → ports 2, 3" x="50%" tone="amber" />}
            {i === 3 && <StagePacket label="← reply from C" x="52%" tone="up" />}
            <div className="absolute bottom-0 left-0 border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1 font-data text-[9px]">
              <div className="mb-0.5 uppercase tracking-wider text-[var(--text-dim)]">MAC address table</div>
              {rows.length === 0 ? (
                <div className="text-[var(--text-dim)]">(empty)</div>
              ) : (
                rows.map((r) => (
                  <div key={r} className="text-[var(--text-secondary)]">
                    {r}
                  </div>
                ))
              )}
            </div>
          </>
        )
      }}
    />
  )
}
