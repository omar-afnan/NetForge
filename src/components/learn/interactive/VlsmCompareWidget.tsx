import { useState } from 'react'
import { describePrefix, smallestPrefixForHosts } from '@/lib/subnetMath'

/**
 * Equal-size subnetting vs VLSM, on one /24. Toggle between "one prefix for
 * everyone" and "right-sized per department" and watch the wasted address
 * count - and the room left for growth - change.
 */

interface Dept {
  name: string
  need: number
}

const DEPTS: Dept[] = [
  { name: 'Engineering', need: 60 },
  { name: 'Sales', need: 25 },
  { name: 'HR', need: 10 },
  { name: 'WAN link', need: 2 },
]

const BASE_SIZE = 256

export function VlsmCompareWidget() {
  const [vlsm, setVlsm] = useState(false)

  // Equal mode: the smallest single prefix that fits the largest department.
  const equalPrefix = smallestPrefixForHosts(Math.max(...DEPTS.map((d) => d.need)))
  const equalSize = describePrefix(equalPrefix).totalAddresses

  const rows = DEPTS.map((d) => {
    // VLSM: right-size, but keep /30 as the conventional floor for a link.
    const prefix = vlsm
      ? Math.min(Math.max(smallestPrefixForHosts(d.need), 24), 30)
      : equalPrefix
    const facts = describePrefix(prefix)
    return {
      ...d,
      prefix,
      size: vlsm ? facts.totalAddresses : equalSize,
      usable: facts.usableHosts,
      wasted: Math.max(0, facts.usableHosts - d.need),
    }
  })

  const used = rows.reduce((s, r) => s + r.size, 0)
  const totalWasted = rows.reduce((s, r) => s + r.wasted, 0)
  const free = Math.max(0, BASE_SIZE - used)
  const overflow = used > BASE_SIZE

  return (
    <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="font-data text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          One /24 · 192.168.10.0/24
        </span>
        <div className="flex border border-[var(--border-bright)]">
          {(['Equal size', 'VLSM'] as const).map((label, i) => {
            const active = (i === 1) === vlsm
            return (
              <button
                key={label}
                type="button"
                onClick={() => setVlsm(i === 1)}
                className={`px-2.5 py-0.5 font-data text-[10px] transition-colors ${
                  active
                    ? 'bg-[var(--accent-link-dim)] text-[var(--accent-link)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4">
        {/* proportional bar */}
        <div className="flex h-9 w-full overflow-hidden border border-[var(--border)]">
          {rows.map((r) => (
            <div
              key={r.name}
              className="flex flex-col items-center justify-center border-r border-[var(--bg-root)] transition-all duration-500 last:border-r-0"
              style={{
                flexBasis: `${(Math.min(r.size, BASE_SIZE) / BASE_SIZE) * 100}%`,
                background:
                  r.wasted > r.need
                    ? 'color-mix(in srgb, var(--accent-amber) 22%, var(--bg-inset))'
                    : 'color-mix(in srgb, var(--accent-link) 18%, var(--bg-inset))',
              }}
            >
              <span className="truncate px-1 font-data text-[9px] text-[var(--text-secondary)]">{r.name}</span>
              <span className="font-data text-[8px] text-[var(--text-dim)]">/{r.prefix}</span>
            </div>
          ))}
          {free > 0 && (
            <div
              className="flex items-center justify-center bg-[var(--bg-inset)]"
              style={{ flexBasis: `${(free / BASE_SIZE) * 100}%` }}
            >
              <span className="font-data text-[9px] text-[var(--status-up)]">free</span>
            </div>
          )}
        </div>

        {/* per-department detail */}
        <div className="mt-3 space-y-1">
          {rows.map((r) => (
            <div
              key={r.name}
              className="flex items-center justify-between border border-[var(--border)] bg-[var(--bg-inset)] px-2.5 py-1 font-data text-[10.5px]"
            >
              <span className="text-[var(--text-secondary)]">
                {r.name} <span className="text-[var(--text-dim)]">needs {r.need}</span>
              </span>
              <span className="text-[var(--text-primary)]">
                /{r.prefix} · {r.usable} usable
                {r.wasted > 0 && (
                  <span className="text-[var(--accent-amber)]"> · {r.wasted} wasted</span>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 font-data text-[11px]">
          <Stat label="Addresses reserved" value={`${used} / ${BASE_SIZE}`} bad={overflow} />
          <Stat label="Total wasted" value={String(totalWasted)} bad={totalWasted > 60} />
        </div>

        <p className="mt-3 border-l-2 border-[var(--accent-amber)] bg-[rgba(240,180,41,0.06)] px-3 py-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {vlsm
            ? 'Right-sizing each subnet frees most of the /24 for later growth. The rule: allocate the biggest department first, then align every block to its own size.'
            : `One prefix for all four departments burns ${totalWasted} addresses - the WAN link alone is given ${rows[3].usable} where it needs ${rows[3].need}. Switch to VLSM.`}
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-widest text-[var(--text-dim)]">{label}</div>
      <div
        className="mt-0.5 text-[13px] font-bold"
        style={{ color: bad ? 'var(--accent-amber)' : 'var(--text-primary)' }}
      >
        {value}
      </div>
    </div>
  )
}
