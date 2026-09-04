import { SequenceStepper, StageNode, StagePacket } from './SequenceStepper'

/**
 * A name resolves to an address before any connection is made. The browser
 * asks its resolver, the resolver walks the hierarchy, an address comes back
 * and is cached - then the real connection begins.
 */

const FRAMES = [
  { caption: 'You type example.com. The browser needs an IP address first - names mean nothing to the IP layer.' },
  { caption: 'The browser asks its DNS resolver: "what is the address for example.com?"' },
  { caption: 'The resolver walks the hierarchy - root server, then the .com server, then example.com\'s authoritative server.' },
  { caption: 'The answer comes back: example.com is at 93.184.216.34. The resolver caches it, honouring the record\'s TTL.' },
  { caption: 'Only now does the browser open a connection - to 93.184.216.34. DNS did just one job: name to address.' },
]

export function DnsResolveWidget() {
  return (
    <SequenceStepper
      label="DNS · name resolution"
      frames={FRAMES}
      startLabel="Enter the name"
      nextLabel="Next"
      doneLabel="Address resolved"
      render={(i) => (
        <>
          <StageNode label="BROWSER" sub={i >= 4 ? '→ 93.184.216.34' : 'example.com'} x="4%" active={i === 1} tone={i >= 4 ? 'up' : 'link'} />
          <StageNode label="RESOLVER" sub="8.8.8.8" x="40%" active={i === 2 || i === 3} />
          <StageNode label="AUTHORITATIVE" sub="example.com" x="74%" active={i === 2} />
          {i === 1 && <StagePacket label="A? example.com →" x="20%" />}
          {i === 2 && <StagePacket label="root → .com → example.com" x="46%" tone="amber" />}
          {i === 3 && <StagePacket label="← 93.184.216.34" x="20%" tone="up" />}
          {i >= 3 && (
            <div className="absolute bottom-0 left-[4%] border border-[var(--status-up)] bg-[var(--bg-elevated)] px-2 py-1 font-data text-[9px] text-[var(--status-up)]">
              cache: example.com → 93.184.216.34 (TTL)
            </div>
          )}
        </>
      )}
    />
  )
}
