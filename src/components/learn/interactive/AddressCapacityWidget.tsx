import { useState } from 'react'
import { ArrowDown, RotateCcw } from 'lucide-react'
import { describePrefix } from '@/lib/subnetMath'
import { useReducedMotion } from '@/lib/useReducedMotion'

/**
 * "How many IP addresses?" - turns a prefix into a host-bit count, then walks
 * the power-of-two out longhand (2 x 2 x ... x 2) so the learner sees where the
 * total comes from, then subtracts the network + broadcast addresses. The bar
 * shrinks as the prefix grows so the address space visibly gets smaller.
 *
 * Every number is from describePrefix(), which already treats /31 and /32 as
 * the deliberate exceptions they are.
 */
export function AddressCapacityWidget({
  min = 8,
  max = 32,
  initialPrefix = 24,
}: {
  min?: number
  max?: number
  initialPrefix?: number
}) {
  const reduced = useReducedMotion()
  const [prefix, setPrefix] = useState(initialPrefix)
  const facts = describePrefix(prefix)
  const { hostBits, totalAddresses, usableHosts, note } = facts

  // Staged reveal of the calculation: 0 = just 2^N, 1 = the product spelled
  // out, 2 = the total, 3 = usable-host subtraction.
  const [stage, setStage] = useState(reduced ? 3 : 0)

  const setP = (p: number) => {
    const clamped = Math.max(min, Math.min(max, p))
    setPrefix(clamped)
    setStage(reduced ? 3 : 0)
  }

  // Bar width on a log2 scale: /8 (24 host bits) fills it, /32 is a sliver.
  const barPct = Math.max(2, (hostBits / 24) * 100)
  const product = hostBits === 0 ? '1' : Array.from({ length: hostBits }, () => '2').join(' x ')

  return (
    <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="font-data text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          How many addresses?
        </span>
        <button
          type="button"
          onClick={() => setStage(0)}
          className="flex items-center gap-1 border border-[var(--border)] px-2 py-0.5 font-data text-[10px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-link)] hover:text-[var(--accent-link)]"
        >
          <RotateCcw className="h-3 w-3" />
          Restart
        </button>
      </div>

      <div className="p-4">
        {/* prefix picker */}
        <div className="flex items-center gap-3">
          <span className="font-data text-lg font-bold text-[var(--accent-link)]">/{prefix}</span>
          <input
            type="range"
            min={min}
            max={max}
            value={prefix}
            onChange={(e) => setP(Number(e.target.value))}
            className="flex-1"
            style={{ accentColor: 'var(--accent-link)' }}
            aria-label="CIDR prefix length"
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setP(prefix - 1)}
              disabled={prefix <= min}
              className="h-6 w-6 border border-[var(--border-bright)] font-data text-[12px] text-[var(--text-primary)] transition-colors hover:border-[var(--accent-link)] disabled:opacity-30"
              aria-label="Fewer network bits"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => setP(prefix + 1)}
              disabled={prefix >= max}
              className="h-6 w-6 border border-[var(--border-bright)] font-data text-[12px] text-[var(--text-primary)] transition-colors hover:border-[var(--accent-link)] disabled:opacity-30"
              aria-label="More network bits"
            >
              +
            </button>
          </div>
        </div>

        {/* the derivation */}
        <div className="mt-4 flex flex-col items-center gap-1.5">
          <span className="font-data text-[12px] text-[var(--text-secondary)]">
            32 bits total - {prefix} network bits ={' '}
            <span className="font-bold text-[var(--text-primary)]">{hostBits} host bits</span>
          </span>
          <ArrowDown className="h-3.5 w-3.5 text-[var(--text-dim)]" />
          <span className="font-data text-[14px] font-bold text-[var(--accent-link)]">
            2<sup>{hostBits}</sup>
          </span>

          {stage >= 1 && (
            <>
              <ArrowDown className="h-3.5 w-3.5 text-[var(--text-dim)]" />
              <span className="max-w-full overflow-x-auto whitespace-nowrap font-data text-[12px] text-[var(--text-secondary)]">
                {product}
              </span>
            </>
          )}
          {stage >= 2 && (
            <>
              <ArrowDown className="h-3.5 w-3.5 text-[var(--text-dim)]" />
              <span className="font-data text-lg font-bold text-[var(--text-primary)]">
                {totalAddresses.toLocaleString()} total addresses
              </span>
            </>
          )}
          {stage >= 3 && (
            <>
              <ArrowDown className="h-3.5 w-3.5 text-[var(--text-dim)]" />
              <span className="font-data text-[12px] text-[var(--text-secondary)]">
                {note ? (
                  <span className="text-[var(--accent-amber)]">special case - see below</span>
                ) : (
                  <>
                    {totalAddresses.toLocaleString()} - 2 (network + broadcast) ={' '}
                    <span className="font-bold text-[var(--status-up)]">
                      {usableHosts.toLocaleString()} usable hosts
                    </span>
                  </>
                )}
              </span>
            </>
          )}

          {stage < 3 && (
            <button
              type="button"
              onClick={() => setStage((s) => Math.min(3, s + 1))}
              className="mt-2 border border-[var(--border-bright)] px-3 py-1 font-data text-[11px] text-[var(--text-primary)] transition-colors hover:border-[var(--accent-link)]"
            >
              Next step
            </button>
          )}
        </div>

        {/* shrinking address-space bar */}
        <div className="mt-4">
          <div className="h-3 w-full overflow-hidden border border-[var(--border)] bg-[var(--bg-inset)]">
            <div
              className="h-full bg-[color-mix(in_srgb,var(--accent-link)_35%,var(--bg-inset))] transition-all duration-500"
              style={{ width: `${barPct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between font-data text-[9px] text-[var(--text-dim)]">
            <span>/{min} = {describePrefix(min).totalAddresses.toLocaleString()}</span>
            <span className="text-[var(--accent-link)]">
              /{prefix} = {totalAddresses.toLocaleString()}
            </span>
            <span>/{max} = 1</span>
          </div>
        </div>

        {note && (
          <p className="mt-3 border-l-2 border-[var(--accent-amber)] bg-[rgba(240,180,41,0.06)] px-3 py-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {note}
          </p>
        )}
      </div>
    </div>
  )
}
