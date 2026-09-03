import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import { splitNetwork } from '@/lib/subnetMath'
import { useReducedMotion } from '@/lib/useReducedMotion'

/**
 * Shows what "borrowing a bit" means: the boundary between network and host
 * bits steps right by one, the newly-borrowed bit flips 0 -> 1 in place, and
 * the original block splits into two. Numbers come from splitNetwork.
 */
export function BoundaryBorrowAnimation({
  baseCidr = '192.168.1.0/24',
}: {
  baseCidr?: string
}) {
  const [, fromPrefixStr] = baseCidr.split('/')
  const fromPrefix = Number(fromPrefixStr)
  const toPrefix = fromPrefix + 1
  const reduced = useReducedMotion()

  // phase 0: before  1: bit borrowed  2: split shown
  const [phase, setPhase] = useState(reduced ? 2 : 0)

  useEffect(() => {
    if (reduced || phase >= 2) return
    const t = setTimeout(() => setPhase((p) => p + 1), 1400)
    return () => clearTimeout(t)
  }, [phase, reduced])

  const subnets = splitNetwork(baseCidr, toPrefix)
  const borrowedIndex = fromPrefix // 0-based position of the borrowed bit

  return (
    <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="font-data text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          Borrowing one host bit: /{fromPrefix} -&gt; /{toPrefix}
        </span>
        <button
          type="button"
          onClick={() => setPhase(0)}
          className="flex items-center gap-1 border border-[var(--border)] px-2 py-0.5 font-data text-[10px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-link)] hover:text-[var(--accent-link)]"
        >
          <Play className="h-3 w-3" />
          Replay
        </button>
      </div>

      <div className="p-4">
        {/* bit strip around the boundary (show 16 bits centred on the split) */}
        <div className="flex justify-center gap-[2px]">
          {Array.from({ length: 16 }, (_, k) => {
            const bitPos = fromPrefix - 8 + k
            if (bitPos < 0 || bitPos > 31) return <div key={k} className="w-4" />
            const isNetworkNow = phase >= 1 ? bitPos < toPrefix : bitPos < fromPrefix
            const isBorrowed = bitPos === borrowedIndex
            return (
              <div key={k} className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-4 items-center justify-center border font-data text-[10px] font-bold transition-all duration-700 ${
                    isBorrowed && phase >= 1
                      ? 'border-[var(--accent-link)] bg-[var(--accent-link-dim)] text-[var(--accent-link)]'
                      : isNetworkNow
                        ? 'border-[var(--status-up)] bg-[color-mix(in_srgb,var(--status-up)_22%,var(--bg-inset))] text-[var(--status-up)]'
                        : 'border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-dim)]'
                  }`}
                >
                  {isBorrowed ? (phase >= 1 ? '1' : '0') : isNetworkNow ? '1' : '0'}
                </div>
                {isBorrowed && (
                  <span className="mt-0.5 font-data text-[8px] uppercase text-[var(--accent-link)]">
                    borrowed
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-center text-[12px] text-[var(--text-secondary)]">
          {phase === 0 && `Start: ${baseCidr} - one network, ${32 - fromPrefix} host bits.`}
          {phase === 1 &&
            'You moved the boundary one bit right. That bit is now part of the network number.'}
          {phase >= 2 && 'One borrowed bit = 2 subnetworks. The address space is now split in two:'}
        </p>

        {phase >= 2 && (
          <div className="mx-auto mt-3 flex max-w-sm flex-col gap-1.5">
            {subnets.map((s) => (
              <div
                key={s.cidr}
                className="flex items-center justify-between border border-[var(--status-up)]/40 bg-[var(--bg-inset)] px-3 py-1.5 font-data text-[12px]"
              >
                <span className="font-bold text-[var(--text-primary)]">{s.cidr}</span>
                <span className="text-[var(--text-dim)]">
                  {s.usableHosts.toLocaleString()} usable
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
