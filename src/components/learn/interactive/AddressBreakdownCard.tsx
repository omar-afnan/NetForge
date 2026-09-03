import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { addressBreakdown, splitNetwork } from '@/lib/subnetMath'
import { isValidIpv4 } from '@/network/ip'
import { ExplainPopover } from '@/components/learn/ExplainPopover'

/**
 * Given a host address and a prefix, lay out the four addresses every subnet
 * has: network, first host, last host, broadcast. Then a quick task - pick
 * the range the host actually lives in.
 */
export function AddressBreakdownCard({
  defaultIp = '192.168.10.42',
  defaultPrefix = 24,
  askWhichSubnet = true,
  onSolved,
}: {
  defaultIp?: string
  defaultPrefix?: number
  askWhichSubnet?: boolean
  onSolved?: () => void
}) {
  const [ip, setIp] = useState(defaultIp)
  const valid = isValidIpv4(ip)
  const prefix = defaultPrefix
  const b = useMemo(
    () => (valid ? addressBreakdown(ip, prefix) : null),
    [ip, prefix, valid],
  )

  // "which subnet" mini-task: split the parent /(<prefix>) block into the next
  // size down and ask which slice holds the IP.
  const splitPrefix = Math.min(32, prefix + 2)
  const parentCidr = b ? `${addressBreakdown(ip, prefix).network}/${prefix}` : ''
  const options = useMemo(
    () => (b ? splitNetwork(parentCidr, splitPrefix) : []),
    [b, parentCidr, splitPrefix],
  )
  const correctIdx = useMemo(() => {
    if (!b) return -1
    const target = addressBreakdown(ip, splitPrefix).network
    return options.findIndex((o) => o.network === target)
  }, [b, ip, options, splitPrefix])

  const [picked, setPicked] = useState<number | null>(null)

  const rows: { label: string; value: string; objectKey?: string; tone?: string }[] = b
    ? [
        { label: 'IP address', value: b.ip },
        { label: 'Subnet mask', value: b.mask, objectKey: 'subnet-mask' },
        { label: 'Network', value: b.network, objectKey: 'network-address', tone: 'var(--accent-link)' },
        { label: 'First host', value: b.firstHost, tone: 'var(--status-up)' },
        { label: 'Last host', value: b.lastHost, tone: 'var(--status-up)' },
        { label: 'Broadcast', value: b.broadcast, objectKey: 'broadcast', tone: 'var(--accent-amber)' },
      ]
    : []

  return (
    <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="font-data text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          Address breakdown
        </span>
        <span className="flex items-center gap-1.5 font-data text-[11px] text-[var(--text-secondary)]">
          <input
            value={ip}
            onChange={(e) => {
              setIp(e.target.value.trim())
              setPicked(null)
            }}
            spellCheck={false}
            className="w-32 border border-[var(--border)] bg-[var(--bg-inset)] px-1.5 py-0.5 text-right font-data text-[11px] text-[var(--text-primary)] focus:border-[var(--accent-link)] focus:outline-none"
          />
          <span className="text-[var(--text-dim)]">/{prefix}</span>
        </span>
      </div>

      <div className="p-4">
        {!valid ? (
          <p className="text-center text-[12px] text-[var(--status-down)]">
            {ip || '(empty)'} is not a valid IPv4 address.
          </p>
        ) : (
          <>
            <div className="divide-y divide-[var(--border)] border border-[var(--border)]">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between px-3 py-1.5">
                  <span className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]">
                    {r.label}
                    {r.objectKey && <ExplainPopover objectKey={r.objectKey} />}
                  </span>
                  <span
                    className="font-data text-[12px] font-bold"
                    style={{ color: r.tone ?? 'var(--text-primary)' }}
                  >
                    {r.value}
                  </span>
                </div>
              ))}
            </div>

            {b?.note && (
              <p className="mt-2 border-l-2 border-[var(--accent-amber)] bg-[rgba(240,180,41,0.06)] px-3 py-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                {b.note}
              </p>
            )}

            {askWhichSubnet && options.length > 1 && correctIdx >= 0 && (
              <div className="mt-4 border border-[var(--border)] bg-[var(--bg-inset)] p-3">
                <p className="text-[12px] font-semibold text-[var(--text-primary)]">
                  If this block were split into /{splitPrefix}s, which subnet does {ip} land in?
                </p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {options.map((o, i) => {
                    const chosen = picked === i
                    const revealed = picked !== null
                    const isAnswer = i === correctIdx
                    return (
                      <button
                        key={o.cidr}
                        type="button"
                        onClick={() => {
                          setPicked(i)
                          if (i === correctIdx) onSolved?.()
                        }}
                        className={`border px-2.5 py-1.5 text-left font-data text-[11px] transition-colors ${
                          revealed && isAnswer
                            ? 'border-[var(--status-up)] text-[var(--status-up)]'
                            : chosen
                              ? 'border-[var(--status-down)] text-[var(--status-down)]'
                              : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-bright)]'
                        }`}
                      >
                        {o.cidr}
                        <span className="ml-1 text-[var(--text-dim)]">
                          (.{o.network.split('.').pop()} - .{o.broadcast.split('.').pop()})
                        </span>
                      </button>
                    )
                  })}
                </div>
                {picked !== null && (
                  <p
                    className={`mt-2 flex items-center gap-1.5 text-[11px] ${
                      picked === correctIdx ? 'text-[var(--status-up)]' : 'text-[var(--accent-amber)]'
                    }`}
                  >
                    {picked === correctIdx && <Check className="h-3.5 w-3.5" />}
                    {ip} falls between {options[correctIdx].network} and{' '}
                    {options[correctIdx].broadcast}, so it belongs to {options[correctIdx].cidr}.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
