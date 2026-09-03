import { useEffect, useState } from 'react'
import { describePrefix } from '@/lib/subnetMath'

/**
 * A tiny read-only taste of the subnetting lesson for the landing page: the
 * network/host boundary slides between /24 and /25 on a loop, and the address
 * math underneath keeps pace. Self-contained - no lesson state pulled in.
 */
const CYCLE = [24, 24, 25, 25] as const

export function HeroSubnetDemo() {
  const [i, setI] = useState(0)
  const prefix = CYCLE[i % CYCLE.length]

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const t = setInterval(() => setI((n) => n + 1), 1600)
    return () => clearInterval(t)
  }, [])

  const f = describePrefix(prefix)
  const subnets = 2 ** (prefix - 24)

  return (
    <div className="mt-10 max-w-md border border-[var(--border)] bg-[var(--bg-panel)] p-4">
      <div className="flex items-center justify-between font-data text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
        <span>192.168.1.0</span>
        <span className="text-[var(--accent-link)]">/{prefix}</span>
      </div>

      <div className="mt-2 flex gap-[2px]">
        {Array.from({ length: 32 }, (_, b) => {
          const isNet = b < prefix
          const gap = b % 8 === 7 && b !== 31
          return (
            <div
              key={b}
              className={`h-5 flex-1 border transition-colors duration-500 ${
                isNet
                  ? 'border-[var(--status-up)] bg-[color-mix(in_srgb,var(--status-up)_22%,transparent)]'
                  : 'border-[var(--border)] bg-[var(--bg-inset)]'
              }`}
              style={{ marginRight: gap ? 3 : 0 }}
            />
          )
        })}
      </div>

      <div className="mt-2 flex justify-between font-data text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
        <span className="text-[var(--status-up)]">network</span>
        <span>host</span>
      </div>

      <div className="mt-3 border-t border-[var(--border)] pt-3 font-data text-[11px] text-[var(--text-secondary)]">
        {subnets} subnet{subnets > 1 ? 's' : ''} · {f.usableHosts.toLocaleString()} usable hosts
        {subnets > 1 ? ' each' : ''}
      </div>
    </div>
  )
}
