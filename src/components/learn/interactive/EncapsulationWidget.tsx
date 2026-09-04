import { SequenceStepper } from './SequenceStepper'

/**
 * Encapsulation: the application's data is wrapped by each layer on the way
 * down - transport adds ports, network adds IPs, the data link adds MACs - and
 * unwrapped in reverse at the far end.
 */

interface Layer {
  tag: string
  value: string
  color: string
}

// Headers are prepended as we go down the stack; the payload stays at the end.
const LAYERS: Layer[] = [
  { tag: 'MAC', value: 'AA:… → BB:…', color: 'var(--accent-amber)' },
  { tag: 'IP', value: '192.168.1.10 → 203.0.113.9', color: 'var(--accent-link)' },
  { tag: 'TCP', value: 'port 49152 → 443', color: 'var(--status-up)' },
]

const FRAMES = [
  { caption: 'The application has data to send: GET /index.html' },
  { caption: 'TRANSPORT wraps it - adds a source and destination port (49152 → 443). It is now a TCP segment.' },
  { caption: 'NETWORK wraps that - adds a source and destination IP address. It is now an IP packet.' },
  { caption: 'DATA LINK wraps that - adds source and destination MAC plus a checksum. It is now an Ethernet frame: this is what goes on the wire.' },
  { caption: 'At the destination each layer strips its own header in reverse, until the application gets back exactly: GET /index.html' },
]

/** How many headers are shown at frame i (0..3), and whether we are unwrapping. */
function shown(i: number): { headers: number; unwrapped: boolean } {
  if (i <= 3) return { headers: i, unwrapped: false }
  return { headers: 0, unwrapped: true }
}

export function EncapsulationWidget() {
  return (
    <SequenceStepper
      label="Encapsulation · down the stack"
      frames={FRAMES}
      startLabel="Wrap it"
      nextLabel="Next layer"
      doneLabel="Delivered · headers stripped"
      stageClassName="h-36"
      render={(i) => {
        const { headers, unwrapped } = shown(i)
        const active = LAYERS.slice(3 - headers) // headers added, outermost first
        return (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
            <div className="flex overflow-x-auto border border-[var(--border)] font-data text-[9px]">
              {active.map((l) => (
                <div
                  key={l.tag}
                  className="border-r border-[var(--border)] px-2 py-1.5"
                  style={{ background: 'color-mix(in srgb, var(--bg-inset) 80%, transparent)' }}
                >
                  <div className="uppercase tracking-wider" style={{ color: l.color }}>{l.tag} hdr</div>
                  <div className="text-[var(--text-dim)]">{l.value}</div>
                </div>
              ))}
              <div className="flex-1 px-2 py-1.5">
                <div className="uppercase tracking-wider text-[var(--text-dim)]">application data</div>
                <div className="text-[var(--text-primary)]">GET /index.html</div>
              </div>
              {headers === 3 && (
                <div className="border-l border-[var(--border)] px-2 py-1.5 text-[var(--text-dim)]">
                  <div className="uppercase tracking-wider">FCS</div>
                  <div>crc32</div>
                </div>
              )}
            </div>
            <div className="mt-2 text-center font-data text-[10px] text-[var(--text-dim)]">
              {unwrapped
                ? 'application data only'
                : headers === 0
                  ? 'application layer'
                  : headers === 1
                    ? 'TCP segment'
                    : headers === 2
                      ? 'IP packet'
                      : 'Ethernet frame — on the wire'}
            </div>
          </div>
        )
      }}
    />
  )
}
