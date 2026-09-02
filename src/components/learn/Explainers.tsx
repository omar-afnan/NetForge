import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'

/**
 * Animated concept explainers - short, self-contained visual walkthroughs
 * (30-90 s equivalent) used inside Learn lessons. Pure CSS/React animation,
 * no video assets. Each explainer is a sequence of scenes with a caption;
 * packet/node positions transition between scenes.
 */

interface Scene {
  caption: string
  detail?: string
}

interface ExplainerProps {
  scenes: Scene[]
  render: (scene: number) => React.ReactNode
  duration?: number
}

const SCENE_MS = 2600

function ExplainerFrame({ scenes, render, duration = SCENE_MS }: ExplainerProps) {
  const [scene, setScene] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (timer.current) clearInterval(timer.current)
    if (playing) {
      timer.current = setInterval(() => {
        setScene((s) => {
          if (s >= scenes.length - 1) {
            setPlaying(false)
            return s
          }
          return s + 1
        })
      }, duration)
    }
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [playing, scenes.length, duration])

  const replay = () => {
    setScene(0)
    setPlaying(true)
  }

  const current = scenes[scene]

  return (
    <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          <Play className="h-3 w-3 text-[var(--accent-link)]" />
          Visual explainer
        </span>
        <button
          type="button"
          onClick={replay}
          className="flex items-center gap-1 border border-[var(--border)] px-2 py-0.5 font-data text-[10px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-link)] hover:text-[var(--accent-link)]"
        >
          <RotateCcw className="h-3 w-3" />
          {playing ? 'Restart' : 'Play'}
        </button>
      </div>

      <div className="relative h-56 overflow-hidden bg-[var(--bg-inset)]">{render(scene)}</div>

      <div className="border-t border-[var(--border)] px-3 py-2.5">
        <p className="text-[12px] font-semibold text-[var(--text-primary)]">{current.caption}</p>
        {current.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">{current.detail}</p>}
        <div className="mt-2 flex items-center gap-1.5">
          {scenes.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 transition-colors duration-300 ${
                i <= scene ? 'bg-[var(--accent-link)]' : 'bg-[var(--border)]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Shared building blocks ─────────────────────────────────────────────── */

function Node({ label, sub, style, highlight }: { label: string; sub?: string; style: React.CSSProperties; highlight?: boolean }) {
  return (
    <div
      className={`absolute flex w-20 flex-col items-center justify-center border px-1 py-2 text-center transition-all duration-700 ${
        highlight ? 'border-[var(--accent-link)] bg-[var(--accent-link)]/10' : 'border-[var(--border-bright)] bg-[var(--bg-elevated)]'
      }`}
      style={style}
    >
      <span className="font-data text-[10px] font-bold text-[var(--text-primary)]">{label}</span>
      {sub && <span className="mt-0.5 font-data text-[8px] leading-tight text-[var(--text-dim)]">{sub}</span>}
    </div>
  )
}

function Packet({ label, style, tone = 'cyan' }: { label: string; style: React.CSSProperties; tone?: 'cyan' | 'amber' | 'green' }) {
  const color =
    tone === 'amber' ? 'var(--accent-amber)' : tone === 'green' ? 'var(--status-up)' : 'var(--accent-link)'
  return (
    <div
      className="absolute z-10 border px-1.5 py-0.5 font-data text-[9px] font-bold transition-all duration-1000 ease-in-out"
      style={{ background: 'var(--bg-elevated)', borderColor: color, color, ...style }}
    >
      {label}
    </div>
  )
}

const POS = {
  left: { left: '6%', top: '38%' },
  mid: { left: '42%', top: '38%' },
  right: { left: '78%', top: '38%' },
  cloud: { left: '78%', top: '8%' },
} as const

/* ── ARP ────────────────────────────────────────────────────────────────── */

export function ArpExplainer() {
  const scenes: Scene[] = [
    { caption: 'PC1 (192.168.1.10) wants to reach the router (192.168.1.1).', detail: 'It knows the destination IP - but to build an Ethernet frame it needs the destination MAC address.' },
    { caption: 'PC1 broadcasts an ARP Request: "Who has 192.168.1.1?"', detail: 'The frame is sent to FF:FF:FF:FF:FF:FF - every device on the segment receives it.' },
    { caption: 'The router recognizes its own IP and sends an ARP Reply.', detail: 'Unicast back to PC1: "192.168.1.1 is at AA:BB:CC:DD:EE:FF".' },
    { caption: 'PC1 caches the IP→MAC mapping in its ARP table.', detail: 'Now it can address frames directly. Run "show arp" / "arp -a" to see real entries.' },
  ]
  return (
    <ExplainerFrame
      scenes={scenes}
      render={(s) => (
        <>
          <Node label="PC1" sub="192.168.1.10" style={POS.left} highlight={s === 0 || s === 1} />
          <Node label="R1" sub=".1 · AA:BB:CC:DD:EE:FF" style={POS.right} highlight={s === 2 || s === 3} />
          {s >= 1 && s < 3 && <Packet label="ARP: Who has .1?" style={s === 1 ? POS.left : POS.mid} tone="amber" />}
          {s >= 2 && <Packet label=".1 is at AA:BB:CC:DD:EE:FF" style={s === 2 ? POS.right : POS.mid} tone="green" />}
          {s === 3 && (
            <div className="absolute bottom-3 left-[6%] border border-[var(--status-up)] bg-[var(--bg-elevated)] px-2 py-1 font-data text-[9px] text-[var(--status-up)]">
              ARP table: 192.168.1.1 → AA:BB:CC:DD:EE:FF ✓
            </div>
          )}
        </>
      )}
    />
  )
}

/* ── Default Gateway ────────────────────────────────────────────────────── */

export function GatewayExplainer() {
  const scenes: Scene[] = [
    { caption: 'PC (192.168.1.10) wants to reach 8.8.8.8 - far outside its subnet.', detail: 'First question every host asks: is the destination in MY subnet (192.168.1.0/24)?' },
    { caption: 'No - so the PC hands the packet to its default gateway.', detail: 'The frame is addressed to the gateway MAC, but the packet IP still says 8.8.8.8.' },
    { caption: 'The router looks at the destination IP and routes onward.', detail: 'A new frame is built for the next hop. This repeats router by router.' },
    { caption: 'The reply finds its way back the same way.', detail: 'Without a default gateway, all off-subnet traffic dies at the PC - the most common LAN fault.' },
  ]
  return (
    <ExplainerFrame
      scenes={scenes}
      render={(s) => (
        <>
          <Node label="PC" sub="192.168.1.10" style={POS.left} highlight={s === 0 || s === 1} />
          <Node label="SW1" style={POS.mid} highlight={s === 1} />
          <Node label="R1" sub="GW 192.168.1.1" style={POS.right} highlight={s === 2} />
          <Node label="INTERNET" sub="8.8.8.8" style={POS.cloud} highlight={s === 3} />
          {s >= 1 && s < 3 && <Packet label="→ 8.8.8.8 via GW" style={s === 1 ? POS.left : s === 2 ? POS.mid : POS.right} />}
          {s === 3 && <Packet label="← reply" style={POS.right} tone="green" />}
          <div className="absolute bottom-2 left-[6%] font-data text-[8px] text-[var(--text-dim)]">
            same subnet → deliver locally · different subnet → send to gateway
          </div>
        </>
      )}
    />
  )
}

/* ── Static Route ───────────────────────────────────────────────────────── */

export function StaticRouteExplainer() {
  const scenes: Scene[] = [
    { caption: 'PC pings 10.2.0.50 - a network behind R2.', detail: 'R1 only knows directly connected networks. It checks its routing table…' },
    { caption: 'R1 has no route to 10.2.0.0/24 → the packet is dropped.', detail: 'The link is fine - routing is what is missing. Classic "Missing Route" fault.' },
    { caption: 'Add: ip route 10.2.0.0 255.255.255.0 10.1.0.2', detail: 'Read it as: "for 10.2.0.0/24, hand packets to next-hop 10.1.0.2 (R2)".' },
    { caption: 'Now R1 forwards to R2, which delivers the packet.', detail: 'Every router along the path needs a route - forward AND return.' },
  ]
  return (
    <ExplainerFrame
      scenes={scenes}
      render={(s) => (
        <>
          <Node label="PC" sub="10.1.10.10" style={POS.left} />
          <Node label="R1" style={POS.mid} highlight={s === 1 || s === 3} />
          <Node label="R2" style={POS.right} highlight={s === 3} />
          <Node label="REMOTE" sub="10.2.0.0/24" style={POS.cloud} highlight={s === 3} />
          {s >= 1 && <Packet label={s === 1 ? '✗ no route' : '→ 10.2.0.50'} style={s === 1 ? POS.mid : s === 2 ? POS.mid : POS.right} tone={s === 1 ? 'amber' : 'green'} />}
          {s >= 2 && (
            <div className="absolute bottom-2 left-[6%] border border-[var(--accent-link)] bg-[var(--bg-elevated)] px-2 py-1 font-data text-[9px] text-[var(--accent-link)]">
              R1# ip route 10.2.0.0 255.255.255.0 10.1.0.2 ✓
            </div>
          )}
        </>
      )}
    />
  )
}

/* ── TCP Handshake ──────────────────────────────────────────────────────── */

export function TcpHandshakeExplainer() {
  const scenes: Scene[] = [
    { caption: 'A browser opens a TCP connection to a web server on port 80.', detail: 'Before any data, both sides must agree to talk. TCP is connection-oriented.' },
    { caption: 'Client → Server: SYN ("I want to talk, starting at sequence x").', detail: 'Step 1 of the three-way handshake.' },
    { caption: 'Server → Client: SYN-ACK ("Okay - my sequence is y, yours acknowledged").', detail: 'Step 2. The server also asks to be acknowledged.' },
    { caption: 'Client → Server: ACK - connection established.', detail: 'Step 3. Data flows. UDP skips all of this - faster, but unreliable.' },
  ]
  return (
    <ExplainerFrame
      scenes={scenes}
      render={(s) => (
        <>
          <Node label="CLIENT" sub="port 51000" style={POS.left} highlight={s === 1 || s === 3} />
          <Node label="SERVER" sub="port 80" style={POS.right} highlight={s === 2} />
          {s === 1 && <Packet label="SYN →" style={POS.mid} />}
          {s === 2 && <Packet label="← SYN-ACK" style={POS.mid} tone="amber" />}
          {s === 3 && <Packet label="ACK →" style={POS.mid} tone="green" />}
          {s === 3 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 border border-[var(--status-up)] bg-[var(--bg-elevated)] px-2 py-1 font-data text-[9px] text-[var(--status-up)]">
              ESTABLISHED - data flows both ways ✓
            </div>
          )}
        </>
      )}
    />
  )
}

/* ── VLANs ──────────────────────────────────────────────────────────────── */

export function VlanExplainer() {
  const port = (n: number, vlan: 10 | 20, active: boolean) => (
    <div
      key={n}
      className={`absolute flex h-9 w-9 items-center justify-center border font-data text-[9px] font-bold transition-all duration-700 ${
        active
          ? vlan === 10
            ? 'border-[var(--accent-link)] bg-[var(--accent-link)]/15 text-[var(--accent-link)]'
            : 'border-[var(--accent-amber)] bg-[rgba(240,180,41,0.15)] text-[var(--accent-amber)]'
          : 'border-[var(--border-bright)] bg-[var(--bg-elevated)] text-[var(--text-dim)]'
      }`}
      style={{ left: `${8 + n * 14}%`, top: '18%' }}
    >
      {n}
    </div>
  )
  const scenes: Scene[] = [
    { caption: 'One physical switch - but ports can be grouped into virtual LANs.', detail: 'Ports 1-4 → VLAN 10 (Sales). Ports 5-7 → VLAN 20 (Engineering).' },
    { caption: 'A broadcast arrives on a VLAN 10 port.', detail: 'Without VLANs, a broadcast floods EVERY port. With VLANs, the switch has rules.' },
    { caption: 'The switch floods the frame only within VLAN 10.', detail: 'VLAN 20 ports never see it - the groups are completely isolated at layer 2.' },
    { caption: 'A trunk link carries BOTH VLANs between switches.', detail: 'Frames are tagged with their VLAN id (802.1Q) so the other switch knows the group.' },
  ]
  return (
    <ExplainerFrame
      scenes={scenes}
      render={(s) => (
        <>
          <div className="absolute left-[6%] right-[6%] top-[12%] border border-[var(--border-bright)] bg-[var(--bg-elevated)] px-2 py-6">
            <span className="absolute left-2 top-1 font-data text-[9px] font-bold text-[var(--text-primary)]">SW1</span>
          </div>
          {[1, 2, 3, 4].map((n) => port(n, 10, s === 1 || s === 2))}
          {[5, 6, 7].map((n) => port(n, 20, false))}
          {s === 2 && <Packet label="BROADCAST" style={{ left: '8%', top: '52%' }} tone="amber" />}
          {s === 2 && <Packet label="BROADCAST" style={{ left: '50%', top: '52%' }} tone="amber" />}
          {s === 3 && <div className="absolute left-[8%] top-[52%] font-data text-[9px] text-[var(--accent-link)]">↳ floods VLAN 10 only</div>}
          {s === 3 && <Packet label="TRUNK: VLAN 10 + 20 (tagged)" style={{ left: '30%', top: '78%' }} />}
        </>
      )}
    />
  )
}

/** Registry used by LearnView: the section's text holds the explainer key. */
export const EXPLAINERS: Record<string, () => React.ReactElement> = {
  arp: ArpExplainer,
  'default-gateway': GatewayExplainer,
  'static-route': StaticRouteExplainer,
  'tcp-handshake': TcpHandshakeExplainer,
  vlan: VlanExplainer,
}
