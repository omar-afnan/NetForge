import { SequenceStepper, StageNode, StagePacket } from './SequenceStepper'

/**
 * What ping actually does: an ICMP Echo Request out, an ICMP Echo Reply back,
 * round-trip time measured. It is not TCP and not UDP - it is ICMP, and it
 * only proves IP-level reachability.
 */

const FRAMES = [
  { caption: 'ping tests whether one host can reach another at the IP layer. It is not TCP and not UDP - it uses ICMP.' },
  { caption: 'PC-A sends an ICMP Echo Request addressed to 10.0.0.2.' },
  { caption: 'PC-B receives it and answers with an ICMP Echo Reply back to PC-A.' },
  { caption: 'The reply arrives and the round-trip time is measured. A reply proves IP reachability both ways - nothing about ports or applications.' },
]

export function IcmpPingWidget() {
  return (
    <SequenceStepper
      label="ICMP · ping"
      frames={FRAMES}
      startLabel="Run ping"
      nextLabel="Next"
      doneLabel="Reply received · RTT measured"
      render={(i) => (
        <>
          <StageNode label="PC-A" sub="10.0.0.1" x="6%" active={i === 1} />
          <StageNode label="PC-B" sub="10.0.0.2" x="70%" active={i === 2} />
          {i === 1 && <StagePacket label="ICMP Echo Request →" x="34%" />}
          {i === 2 && <StagePacket label="← ICMP Echo Reply" x="34%" tone="up" />}
          {i >= 3 && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 border border-[var(--status-up)] bg-[var(--bg-elevated)] px-2 py-1 font-data text-[9px] text-[var(--status-up)]">
              64 bytes from 10.0.0.2 · time=1 ms
            </div>
          )}
        </>
      )}
    />
  )
}
