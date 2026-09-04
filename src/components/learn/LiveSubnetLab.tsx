import { useMemo, useState } from 'react'
import { ArrowRight, Check, Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NetworkSimulator } from '@/network/simulator'
import type { Device, NetworkLink } from '@/network/types'
import { isValidIpv4, isSameSubnet } from '@/network/ip'
import { describePrefix, addressBreakdown } from '@/lib/subnetMath'
import { bumpConcept } from '@/store/masteryStore'
import { celebrateLab } from '@/lib/celebrate'

/**
 * "Now use what you learned." A finished concept lesson hands off to a tiny
 * REAL network: two PCs on a switch, an address plan, and a ping that runs on
 * the actual NetworkSimulator. Every pass / fail message is derived from the
 * simulator's own result - nothing is scripted.
 */

interface HostPlan {
  name: string
  ip: string
}

export interface LiveSubnetLabProps {
  title?: string
  /** e.g. "192.168.10.0/24" */
  network?: string
  /** Router address on the plan (shown, not required for a same-subnet ping). */
  gatewayIp?: string
  hosts?: [HostPlan, HostPlan]
  onExit?: () => void
  onComplete?: () => void
}

interface Cfg {
  ip: string
  mask: string
}

const MAC = (n: string) => `AA:AA:AA:AA:AA:${n}`
const SWMAC = (n: string) => `BB:BB:BB:BB:BB:${n}`

function buildScenario(h1: Cfg, h2: Cfg, gw: string): { devices: Device[]; links: NetworkLink[] } {
  const mk = (id: string, host: string, c: Cfg, mac: string, link: string): Device => ({
    id,
    hostname: host,
    type: 'pc',
    status: 'healthy',
    defaultGateway: gw || undefined,
    interfaces: [
      {
        id: `${id}-e0`,
        name: 'Eth0',
        macAddress: mac,
        status: 'up',
        ipAddress: c.ip || undefined,
        subnetMask: c.mask || undefined,
        connectedLinkId: link,
      },
    ],
  })
  const pc1 = mk('pc1', 'PC1', h1, MAC('01'), 'l1')
  const pc2 = mk('pc2', 'PC2', h2, MAC('02'), 'l2')
  const sw: Device = {
    id: 'sw1',
    hostname: 'SW1',
    type: 'switch',
    status: 'healthy',
    interfaces: [
      { id: 'sw1-f1', name: 'Fa0/1', macAddress: SWMAC('01'), status: 'up', connectedLinkId: 'l1' },
      { id: 'sw1-f2', name: 'Fa0/2', macAddress: SWMAC('02'), status: 'up', connectedLinkId: 'l2' },
    ],
  }
  const links: NetworkLink[] = [
    { id: 'l1', sourceDeviceId: 'pc1', sourceInterfaceId: 'pc1-e0', targetDeviceId: 'sw1', targetInterfaceId: 'sw1-f1', status: 'up', kind: 'copper' },
    { id: 'l2', sourceDeviceId: 'pc2', sourceInterfaceId: 'pc2-e0', targetDeviceId: 'sw1', targetInterfaceId: 'sw1-f2', status: 'up', kind: 'copper' },
  ]
  return { devices: [pc1, pc2, sw], links }
}

/** Turn a raw simulator failureReason into a teaching explanation, checked against the plan. */
function explain(reason: string | undefined, h1: Cfg, h2: Cfg, planMask: string, planIp1: string, planIp2: string): string {
  if (!reason) return ''
  if (reason.includes('Invalid source or destination')) {
    if (!h2.ip) return 'PC2 has no IP address yet, so there is nothing for PC1 to reach. Give PC2 its planned address.'
    if (!h1.ip) return 'PC1 has no IP address, so it cannot send anything. Give PC1 its planned address.'
    return 'One of the addresses is not a valid IPv4 address. Compare each field with the address plan.'
  }
  if (reason.includes('ARP resolution failed')) {
    const sameSubnet = h1.ip && h1.mask && h2.ip && isValidIpv4(h1.ip) && isValidIpv4(h1.mask) && isValidIpv4(h2.ip) && isSameSubnet(h1.ip, h2.ip, h1.mask)
    if (!sameSubnet) {
      return `With PC1 as ${h1.ip}/${h1.mask || '?'}, PC1 does not consider ${h2.ip} to be on its own network, so it never even ARPs for it. The plan puts both hosts in ${planIp1.split('.').slice(0, 3).join('.')}.0 with mask ${planMask}.`
    }
    return 'PC1 asked "who has that address?" and got no answer - the destination is not reachable on the segment. Check PC2\'s address matches the plan.'
  }
  if (reason.includes('gateway')) {
    return `PC1 thinks the destination is on a different network and is trying to use its gateway. For a same-subnet ping no gateway is needed - the mask is the thing to fix. Plan: mask ${planMask}, so ${planIp1} and ${planIp2} are neighbours.`
  }
  if (reason.includes('Interface down')) return 'An interface is down. Both PCs need an IP and mask on an up interface.'
  return reason
}

export function LiveSubnetLab({
  title = 'Put it on real devices',
  network = '192.168.10.0/24',
  gatewayIp = '192.168.10.1',
  hosts = [
    { name: 'PC1', ip: '192.168.10.10' },
    { name: 'PC2', ip: '192.168.10.20' },
  ],
  onExit,
  onComplete,
}: LiveSubnetLabProps) {
  const [, prefixStr] = network.split('/')
  const prefix = Number(prefixStr)
  const planMask = describePrefix(prefix).mask
  const planNet = addressBreakdown(hosts[0].ip, prefix).network

  const [pc1, setPc1] = useState<Cfg>({ ip: '', mask: '' })
  const [pc2, setPc2] = useState<Cfg>({ ip: '', mask: '' })
  const [result, setResult] = useState<{ ok: boolean; hops: string[]; reason?: string } | null>(null)
  const [solved, setSolved] = useState(false)

  const fieldErrors = useMemo(() => {
    const errs: string[] = []
    for (const [label, c] of [['PC1', pc1], ['PC2', pc2]] as const) {
      if (c.ip && !isValidIpv4(c.ip)) errs.push(`${label}: "${c.ip}" is not a valid IPv4 address.`)
      if (c.mask && !isValidIpv4(c.mask)) errs.push(`${label}: "${c.mask}" is not a valid subnet mask.`)
    }
    return errs
  }, [pc1, pc2])

  const runPing = () => {
    if (fieldErrors.length > 0) {
      setResult({ ok: false, hops: [], reason: 'Invalid source or destination' })
      return
    }
    const { devices, links } = buildScenario(pc1, pc2, gatewayIp)
    const sim = new NetworkSimulator(devices, links)
    let ping
    try {
      ping = sim.ping('PC1', 'PC2')
    } catch {
      setResult({ ok: false, hops: [], reason: 'Invalid source or destination' })
      return
    }
    setResult({ ok: ping.success, hops: ping.hops, reason: ping.failureReason })
    if (ping.success && !solved) {
      setSolved(true)
      bumpConcept('network-addresses', 30)
      bumpConcept('ipv4-addressing', 15)
      celebrateLab()
      onComplete?.()
    }
  }

  const explanation = result && !result.ok ? explain(result.reason, pc1, pc2, planMask, hosts[0].ip, hosts[1].ip) : ''

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>Apply · {title}</span>
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="border border-[var(--border)] px-2 py-0.5 font-data text-[10px] font-normal normal-case tracking-normal text-[var(--text-secondary)] transition-colors hover:border-[var(--border-bright)] hover:text-[var(--text-primary)]"
          >
            ← Back
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl">
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
            You worked out the numbers - now configure two real hosts and prove it with a ping. The ping
            runs on the same network engine the labs use; the result is not scripted.
          </p>

          {/* address plan */}
          <div className="mt-3 border border-[var(--border)] bg-[var(--bg-inset)] p-3 font-data text-[11px]">
            <div className="mb-1 text-[9px] uppercase tracking-widest text-[var(--text-dim)]">Address plan</div>
            <div className="grid gap-y-0.5 sm:grid-cols-2">
              <span className="text-[var(--text-secondary)]">Network</span>
              <span className="text-[var(--text-primary)]">{planNet}/{prefix}</span>
              <span className="text-[var(--text-secondary)]">Subnet mask</span>
              <span className="text-[var(--text-primary)]">{planMask}</span>
              <span className="text-[var(--text-secondary)]">Gateway (router)</span>
              <span className="text-[var(--text-primary)]">{gatewayIp}</span>
              <span className="text-[var(--text-secondary)]">{hosts[0].name}</span>
              <span className="text-[var(--text-primary)]">{hosts[0].ip}</span>
              <span className="text-[var(--text-secondary)]">{hosts[1].name}</span>
              <span className="text-[var(--text-primary)]">{hosts[1].ip}</span>
            </div>
          </div>

          {/* topology strip */}
          <div className="mt-3 flex items-center justify-center gap-2 font-data text-[10px] text-[var(--text-dim)]">
            <PathNode label="PC1" state={result ? (result.ok ? 'ok' : result.hops.length >= 1 ? 'ok' : 'bad') : 'idle'} />
            <span className="h-px w-8 bg-[var(--border)]" />
            <PathNode label="SW1" state={result ? (result.hops.length >= 2 ? 'ok' : 'bad') : 'idle'} />
            <span className="h-px w-8 bg-[var(--border)]" />
            <PathNode label="PC2" state={result ? (result.ok ? 'ok' : 'bad') : 'idle'} />
          </div>

          {/* config */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([['PC1', pc1, setPc1], ['PC2', pc2, setPc2]] as const).map(([label, cfg, set]) => (
              <div key={label} className="border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                <div className="mb-1.5 font-data text-[11px] font-bold text-[var(--text-primary)]">{label}</div>
                <label className="mb-1.5 block">
                  <span className="mb-0.5 block text-[10px] text-[var(--text-dim)]">IPv4 address</span>
                  <input
                    value={cfg.ip}
                    onChange={(e) => { set({ ...cfg, ip: e.target.value.trim() }); setResult(null) }}
                    placeholder="0.0.0.0"
                    spellCheck={false}
                    className="w-full border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1 font-data text-[12px] text-[var(--text-primary)] focus:border-[var(--accent-link)] focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-0.5 block text-[10px] text-[var(--text-dim)]">Subnet mask</span>
                  <input
                    value={cfg.mask}
                    onChange={(e) => { set({ ...cfg, mask: e.target.value.trim() }); setResult(null) }}
                    placeholder="0.0.0.0"
                    spellCheck={false}
                    className="w-full border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1 font-data text-[12px] text-[var(--text-primary)] focus:border-[var(--accent-link)] focus:outline-none"
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button variant="accent" size="sm" onClick={runPing}>
              <Play className="h-3.5 w-3.5" />
              Run ping · PC1 → PC2
            </Button>
            {fieldErrors.length === 0 && !result && (
              <span className="font-data text-[10px] text-[var(--text-dim)]">no gateway needed for this one - why?</span>
            )}
          </div>

          {fieldErrors.length > 0 && (
            <ul className="mt-3 border border-[var(--status-down)]/40 bg-[color-mix(in_srgb,var(--status-down)_7%,transparent)] p-3 text-[11px] text-[var(--text-secondary)]">
              {fieldErrors.map((e) => (
                <li key={e} className="flex gap-2"><X className="mt-0.5 h-3 w-3 shrink-0 text-[var(--status-down)]" />{e}</li>
              ))}
            </ul>
          )}

          {result && (
            <div
              className={`mt-3 border p-3 ${
                result.ok
                  ? 'border-[var(--status-up)]/50 bg-[color-mix(in_srgb,var(--status-up)_8%,transparent)]'
                  : 'border-[var(--status-down)]/50 bg-[color-mix(in_srgb,var(--status-down)_7%,transparent)]'
              }`}
            >
              <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${result.ok ? 'text-[var(--status-up)]' : 'text-[var(--status-down)]'}`}>
                {result.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {result.ok
                  ? `Reply from ${hosts[1].ip} · path ${result.hops.join(' → ')}`
                  : `Ping failed${result.reason ? ` — ${result.reason}` : ''}`}
              </div>
              {result.ok ? (
                <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {pc1.mask !== planMask && (
                    <span className="text-[var(--accent-amber)]">
                      It works, but your mask isn&apos;t the planned one - the plan uses {planMask}.{' '}
                    </span>
                  )}
                  Both PCs treat the other as a local neighbour, so PC1 ARPs for PC2 directly and the switch
                  forwards the frame - no gateway involved. You configured a network from your own numbers
                  and it works.
                </p>
              ) : (
                <p className="mt-1.5 whitespace-pre-line text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {explanation}
                </p>
              )}
            </div>
          )}

          {solved && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--status-up)]">
              <Check className="h-3.5 w-3.5" /> Concept applied to a live network. Continue to finish the lesson.
              <ArrowRight className="h-3.5 w-3.5" />
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function PathNode({ label, state }: { label: string; state: 'idle' | 'ok' | 'bad' }) {
  const color = state === 'ok' ? 'var(--status-up)' : state === 'bad' ? 'var(--status-down)' : 'var(--border-bright)'
  return (
    <span
      className="border px-2 py-1 font-data text-[10px] font-bold"
      style={{ borderColor: color, color: state === 'idle' ? 'var(--text-secondary)' : color }}
    >
      {label}
    </span>
  )
}
