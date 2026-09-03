import { useEffect, useMemo, useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { OCTET_WEIGHTS, bitsToValue, octetBits, toBinary } from '@/lib/subnetMath'

/**
 * Click the weighted bits of one octet and watch the decimal value and the
 * binary string update together. With `target` set, it becomes a small task:
 * "switch bits until the octet equals 192".
 */
export function OctetBitVisualizer({
  initial = 0,
  target,
  onSolved,
}: {
  initial?: number
  /** When set, the widget asks the learner to build this exact value. */
  target?: number
  onSolved?: () => void
}) {
  const [bits, setBits] = useState<boolean[]>(() => octetBits(initial).map((b) => b.on))
  const value = useMemo(
    () => bitsToValue(OCTET_WEIGHTS.map((weight, i) => ({ weight, on: bits[i] }))),
    [bits],
  )
  const solved = target != null && value === target
  const onBits = OCTET_WEIGHTS.filter((_, i) => bits[i])

  useEffect(() => {
    if (solved) onSolved?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved])

  const toggle = (i: number) => setBits((prev) => prev.map((b, idx) => (idx === i ? !b : b)))
  const reset = () => setBits(octetBits(0).map(() => false))

  return (
    <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="font-data text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          Octet bit builder
        </span>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1 border border-[var(--border)] px-2 py-0.5 font-data text-[10px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-link)] hover:text-[var(--accent-link)]"
        >
          <RotateCcw className="h-3 w-3" />
          Clear
        </button>
      </div>

      <div className="p-4">
        {target != null && (
          <p className="mb-3 text-center text-[12px] text-[var(--text-secondary)]">
            Switch bits on until this octet equals{' '}
            <span className="font-data font-bold text-[var(--accent-link)]">{target}</span>.
          </p>
        )}

        <div className="flex justify-center gap-1.5">
          {OCTET_WEIGHTS.map((weight, i) => (
            <button
              key={weight}
              type="button"
              onClick={() => toggle(i)}
              className={`flex h-14 w-11 flex-col items-center justify-center border font-data transition-colors ${
                bits[i]
                  ? 'border-[var(--accent-link)] bg-[var(--accent-link-dim)] text-[var(--text-primary)]'
                  : 'border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-dim)] hover:border-[var(--border-bright)]'
              }`}
            >
              <span className="text-[9px] text-[var(--text-dim)]">{weight}</span>
              <span className="text-lg font-bold leading-none">{bits[i] ? '1' : '0'}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 text-center">
          <div className="font-data text-[12px] text-[var(--text-secondary)]">
            {onBits.length ? onBits.join(' + ') : '0'}{' '}
            <span className="text-[var(--text-dim)]">=</span>{' '}
            <span className="text-lg font-bold text-[var(--text-primary)]">{value}</span>
          </div>
          <div className="mt-1 font-data text-[13px] tracking-[0.2em] text-[var(--accent-link)]">
            {toBinary(value)}
          </div>
        </div>

        {target != null && (
          <div
            className={`mt-3 flex items-center justify-center gap-1.5 border px-3 py-1.5 text-[12px] font-semibold ${
              solved
                ? 'border-[var(--status-up)] text-[var(--status-up)]'
                : 'border-[var(--border)] text-[var(--text-dim)]'
            }`}
          >
            {solved ? (
              <>
                <Check className="h-3.5 w-3.5" /> {toBinary(value)} = {value}. That is how binary
                becomes a mask octet.
              </>
            ) : (
              <>Keep going - {value} is not {target} yet.</>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
