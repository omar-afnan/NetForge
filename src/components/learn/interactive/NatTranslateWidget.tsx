import { SequenceStepper, StageNode, StagePacket } from './SequenceStepper'

/**
 * NAT lets a whole private network share one public address. The router
 * rewrites the source as traffic leaves, records the mapping, and rewrites it
 * back on the way in - flows told apart by port.
 */

const FRAMES = [
  { caption: 'PC 192.168.1.10 wants a web server. But 192.168.1.0/24 is private - it is never routed on the public Internet.' },
  { caption: 'The packet reaches the router with source 192.168.1.10:51000.' },
  { caption: 'NAT rewrites the source to the router\'s public address and records the mapping in its translation table.' },
  { caption: 'The reply returns addressed to 203.0.113.7:51000. NAT looks up the table and rewrites the destination back.' },
  { caption: 'One public address, many private hosts - each conversation kept separate by its port number. That is how private IPv4 reaches the Internet.' },
]

export function NatTranslateWidget() {
  return (
    <SequenceStepper
      label="NAT · address translation"
      frames={FRAMES}
      startLabel="Send the packet"
      nextLabel="Next"
      doneLabel="Translation working"
      render={(i) => (
        <>
          <StageNode label="PC" sub="192.168.1.10" x="4%" active={i === 1} />
          <StageNode label="ROUTER / NAT" sub="203.0.113.7" x="40%" active={i === 2 || i === 3} />
          <StageNode label="WEB SERVER" sub="public" x="76%" active={i >= 4} tone="up" />
          {i === 1 && <StagePacket label="src 192.168.1.10:51000 →" x="16%" />}
          {i === 2 && <StagePacket label="src 203.0.113.7:51000 →" x="52%" tone="up" />}
          {i === 3 && <StagePacket label="← dst 203.0.113.7:51000" x="50%" tone="amber" />}
          {i >= 2 && (
            <div className="absolute bottom-0 left-[4%] border border-[var(--accent-link)] bg-[var(--bg-elevated)] px-2 py-1 font-data text-[9px] text-[var(--accent-link)]">
              NAT table: 192.168.1.10:51000 ↔ 203.0.113.7:51000
            </div>
          )}
        </>
      )}
    />
  )
}
