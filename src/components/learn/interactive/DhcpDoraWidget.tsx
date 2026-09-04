import { SequenceStepper, StageNode, StagePacket } from './SequenceStepper'

/**
 * DHCP DORA, one message at a time. A new client with no address broadcasts a
 * DISCOVER, the server OFFERs an address, the client REQUESTs it, the server
 * ACKs - and the client ends up with IP, mask, gateway and DNS.
 */

const FRAMES = [
  { caption: 'A new device joins the network with no IP address. It cannot send a normal unicast packet yet - so it broadcasts.' },
  { caption: 'DISCOVER - the client broadcasts "is there a DHCP server out there?" to every host on the segment.' },
  { caption: 'OFFER - a DHCP server replies with an address it is willing to lease: 192.168.1.50.' },
  { caption: 'REQUEST - the client formally asks for that specific address (there could be more than one server offering).' },
  { caption: 'ACK - the server confirms the lease and sends the full configuration: mask, gateway and DNS, for 24 hours.' },
  { caption: 'The client now has IP, mask, gateway and DNS from one four-step exchange: Discover, Offer, Request, Acknowledge.' },
]

export function DhcpDoraWidget() {
  return (
    <SequenceStepper
      label="DHCP · DORA"
      frames={FRAMES}
      startLabel="Boot the client"
      nextLabel="Next message"
      doneLabel="Client configured"
      render={(i) => (
        <>
          <StageNode
            label="CLIENT"
            sub={i >= 5 ? '192.168.1.50/24' : 'no IP'}
            x="6%"
            active={i === 1 || i === 3}
            tone={i >= 5 ? 'up' : 'link'}
          />
          <StageNode label="DHCP SERVER" sub="192.168.1.1" x="66%" active={i === 2 || i === 4} />
          {i === 1 && <StagePacket label="DISCOVER →" x="38%" tone="amber" />}
          {i === 2 && <StagePacket label="← OFFER .50" x="38%" />}
          {i === 3 && <StagePacket label="REQUEST .50 →" x="38%" />}
          {i === 4 && <StagePacket label="← ACK (mask/gw/dns)" x="34%" tone="up" />}
          {i >= 5 && (
            <div className="absolute bottom-0 left-[6%] border border-[var(--status-up)] bg-[var(--bg-elevated)] px-2 py-1 font-data text-[9px] text-[var(--status-up)]">
              ip .50 · mask /24 · gw .1 · dns .1 · lease 24h
            </div>
          )}
        </>
      )}
    />
  )
}
