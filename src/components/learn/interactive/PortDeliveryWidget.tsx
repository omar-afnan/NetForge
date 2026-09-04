import { SequenceStepper, StageNode, StagePacket } from './SequenceStepper'

/**
 * The IP address gets a packet to the machine; the destination port decides
 * which program on it receives the packet. Three services listen; packets for
 * different ports land in different places, and a packet for a closed port is
 * refused.
 */

const SERVICES = [
  { port: 443, name: 'HTTPS' },
  { port: 53, name: 'DNS' },
  { port: 22, name: 'SSH' },
]

const FRAMES = [
  { caption: 'The server has one IP address (203.0.113.9) and several programs running. The destination port on each packet says which one gets it.' },
  { caption: 'A packet for 203.0.113.9:443 arrives. Port 443 is HTTPS - the web server process receives it.' },
  { caption: 'Another packet, same IP, destination port 53. Same machine, different door: the DNS service handles this one.' },
  { caption: 'A packet for port 8080. Nothing is listening there, so the server refuses the connection.' },
  { caption: 'One IP, many ports. 80 HTTP · 443 HTTPS · 53 DNS · 22 SSH - the well-known ports are just agreed door numbers.' },
]

/** Which service index frame i delivers to (-1 = refused, null = none). */
const TARGET: (number | null)[] = [null, 0, 1, -1, null]

export function PortDeliveryWidget() {
  return (
    <SequenceStepper
      label="Ports · delivery to a service"
      frames={FRAMES}
      startLabel="Start"
      doneLabel="Delivered by port number"
      stageClassName="h-40"
      render={(i) => {
        const target = TARGET[i]
        return (
          <>
            <StageNode label="CLIENT" x="2%" active={i >= 1 && i <= 3} />
            {i === 1 && <StagePacket label="dst :443 →" x="26%" />}
            {i === 2 && <StagePacket label="dst :53 →" x="26%" />}
            {i === 3 && <StagePacket label="dst :8080 →" x="26%" tone="down" />}
            <div className="absolute right-0 top-1/2 w-40 -translate-y-1/2 border border-[var(--border-bright)] bg-[var(--bg-inset)] p-1.5">
              <div className="mb-1 font-data text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
                203.0.113.9
              </div>
              {SERVICES.map((s, idx) => {
                const hit = target === idx
                return (
                  <div
                    key={s.port}
                    className="flex items-center justify-between border px-1.5 py-0.5 font-data text-[10px] transition-colors"
                    style={{
                      borderColor: hit ? 'var(--status-up)' : 'var(--border)',
                      color: hit ? 'var(--status-up)' : 'var(--text-secondary)',
                      marginTop: idx ? 2 : 0,
                    }}
                  >
                    <span>:{s.port}</span>
                    <span>{s.name}</span>
                  </div>
                )
              })}
              {target === -1 && (
                <div className="mt-1 border border-[var(--status-down)] px-1.5 py-0.5 font-data text-[10px] text-[var(--status-down)]">
                  :8080 refused
                </div>
              )}
            </div>
          </>
        )
      }}
    />
  )
}
