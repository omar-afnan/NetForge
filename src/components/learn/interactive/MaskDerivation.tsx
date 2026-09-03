import { useState } from 'react'
import { ArrowDown, RotateCcw } from 'lucide-react'
import { describePrefix } from '@/lib/subnetMath'

/**
 * Walks the chain /24 -> "24 network bits" -> binary -> dotted-decimal mask,
 * one reveal per click. The point is that the mask value is derived, not
 * memorised.
 */
export function MaskDerivation({ prefix = 24 }: { prefix?: number }) {
  const facts = describePrefix(prefix)
  const steps = [
    { k: 'prefix', node: <span className="text-lg font-bold text-[var(--accent-link)]">/{prefix}</span> },
    {
      k: 'bits',
      node: (
        <span className="text-[12px] text-[var(--text-secondary)]">
          {facts.networkBits} network bits, then {facts.hostBits} host bits
        </span>
      ),
    },
    {
      k: 'binary',
      node: (
        <span className="font-data text-[12px] text-[var(--text-primary)]">{facts.maskBinary}</span>
      ),
    },
    {
      k: 'decimal',
      node: (
        <span className="font-data text-lg font-bold text-[var(--status-up)]">{facts.mask}</span>
      ),
    },
  ]

  const [shown, setShown] = useState(1)
  const done = shown >= steps.length

  return (
    <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="font-data text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          Where the mask comes from
        </span>
        <button
          type="button"
          onClick={() => setShown(1)}
          className="flex items-center gap-1 border border-[var(--border)] px-2 py-0.5 font-data text-[10px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-link)] hover:text-[var(--accent-link)]"
        >
          <RotateCcw className="h-3 w-3" />
          Restart
        </button>
      </div>

      <div className="flex flex-col items-center gap-2 p-5">
        {steps.slice(0, shown).map((s, i) => (
          <div key={s.k} className="flex flex-col items-center gap-2">
            {i > 0 && <ArrowDown className="h-3.5 w-3.5 text-[var(--text-dim)]" />}
            {s.node}
          </div>
        ))}

        {!done ? (
          <button
            type="button"
            onClick={() => setShown((n) => Math.min(steps.length, n + 1))}
            className="mt-2 border border-[var(--border-bright)] px-3 py-1 font-data text-[11px] text-[var(--text-primary)] transition-colors hover:border-[var(--accent-link)]"
          >
            Next step
          </button>
        ) : (
          <p className="mt-2 text-center text-[11px] text-[var(--text-secondary)]">
            No memorising: count the network bits, fill them with 1s, read the octets.
          </p>
        )}
      </div>
    </div>
  )
}
