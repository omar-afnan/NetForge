import { SequenceStepper, StageNode, StagePacket } from './SequenceStepper'

/**
 * ARP turns a known IP address into the MAC address a frame needs. Broadcast
 * question, unicast answer, cached result - then the frame can finally be
 * built.
 */

const FRAMES = [
  { caption: 'PC-A wants to send to 192.168.1.20 - same subnet, so it needs that host\'s MAC address to build a frame. It does not have one.' },
  { caption: 'PC-A broadcasts an ARP request: "Who has 192.168.1.20? Tell 192.168.1.10." Destination MAC FF:FF:FF:FF:FF:FF.' },
  { caption: 'The switch floods the broadcast to every port. Every host sees it, but only the owner of .20 will answer.' },
  { caption: 'PC-B replies directly (unicast): "192.168.1.20 is at BB:BB:BB:BB:BB:BB."' },
  { caption: 'PC-A caches the mapping and builds the frame. The chain: IP address -> ARP -> MAC address -> Ethernet frame.' },
]

export function ArpResolveWidget() {
  return (
    <SequenceStepper
      label="ARP · address resolution"
      frames={FRAMES}
      startLabel="Start"
      doneLabel="MAC resolved · cached"
      stageClassName="h-36"
      render={(i) => (
        <>
          <StageNode label="PC-A" sub="192.168.1.10" x="2%" active={i === 1 || i >= 4} tone={i >= 4 ? 'up' : 'link'} />
          <StageNode label="SWITCH" x="40%" active={i === 2} />
          <StageNode label="PC-B" sub="192.168.1.20" x="74%" active={i === 3} />
          {i === 1 && <StagePacket label="Who has .20? → (broadcast)" x="14%" tone="amber" />}
          {i === 2 && <StagePacket label="FF:FF:FF:FF:FF:FF → all ports" x="44%" tone="amber" />}
          {i === 3 && <StagePacket label="← .20 is at BB:BB:…" x="30%" tone="up" />}
          {i >= 3 && (
            <div className="absolute bottom-0 left-0 border border-[var(--status-up)] bg-[var(--bg-elevated)] px-2 py-1 font-data text-[9px] text-[var(--status-up)]">
              ARP cache: 192.168.1.20 → BB:BB:BB:BB:BB:BB
            </div>
          )}
        </>
      )}
    />
  )
}
