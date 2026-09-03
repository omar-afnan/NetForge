import { useState } from 'react'
import { describePrefix } from '@/lib/subnetMath'
import { ExplainPopover } from '@/components/learn/ExplainPopover'

/**
 * The CIDR visualiser. Drag the prefix from /8 to /32 and watch the
 * network/host boundary move one bit at a time across a 32-cell strip, with
 * the mask, the address count and the usable-host count all recomputed from
 * subnetMath so the picture and the numbers can never disagree.
 */
export function CidrExplorer({
  min = 8,
  max = 32,
  initialPrefix = 24,
  baseAddress = '192.168.10.0',
  onChange,
}: {
  min?: number
  max?: number
  initialPrefix?: number
  baseAddress?: string
  onChange?: (prefix: number) => void
}) {
  const [prefix, setPrefix] = useState(initialPrefix)
  const facts = describePrefix(prefix)

  const set = (p: number) => {
    const clamped = Math.max(min, Math.min(max, p))
    setPrefix(clamped)
    onChange?.(clamped)
  }

  return (
    <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="font-data text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          CIDR explorer
        </span>
        <span className="flex items-center gap-1 font-data text-[12px] font-bold text-[var(--accent-link)]">
          {baseAddress}
          <ExplainPopover objectKey={`cidr:/${prefix}`} label={`/${prefix}`} />
        </span>
      </div>

      <div className="p-4">
        {/* 32-bit strip, split at the prefix */}
        <div className="flex gap-[2px]">
          {Array.from({ length: 32 }, (_, i) => {
            const isNetwork = i < prefix
            const isBoundary = i === prefix - 1
            const octetEnd = i % 8 === 7 && i !== 31
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center"
                style={{ marginRight: octetEnd ? 4 : 0 }}
              >
                <div
                  className={`h-7 w-full border transition-colors duration-500 ${
                    isNetwork
                      ? 'border-[var(--status-up)] bg-[color-mix(in_srgb,var(--status-up)_22%,var(--bg-inset))]'
                      : 'border-[var(--border)] bg-[var(--bg-inset)]'
                  } ${isBoundary ? 'shadow-[inset_-2px_0_0_var(--accent-link)]' : ''}`}
                />
                <span
                  className={`mt-0.5 font-data text-[9px] ${
                    isNetwork ? 'text-[var(--status-up)]' : 'text-[var(--text-dim)]'
                  }`}
                >
                  {isNetwork ? '1' : '0'}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-1 flex justify-between font-data text-[9px] uppercase tracking-widest">
          <span className="text-[var(--status-up)]">
            &lt;-- {facts.networkBits} network bits --&gt;
          </span>
          <span className="text-[var(--text-dim)]">&lt;-- {facts.hostBits} host bits --&gt;</span>
        </div>

        {/* slider */}
        <div className="mt-4">
          <input
            type="range"
            min={min}
            max={max}
            value={prefix}
            onChange={(e) => set(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: 'var(--accent-link)' }}
            aria-label="CIDR prefix length"
          />
          <div className="mt-1 flex justify-between font-data text-[9px] text-[var(--text-dim)]">
            <span>/{min}</span>
            <span className="text-[var(--accent-link)]">/{prefix}</span>
            <span>/{max}</span>
          </div>
        </div>

        {/* stats + mask */}
        <div className="mt-4 grid grid-cols-2 gap-2 font-data text-[11px] sm:grid-cols-4">
          <Stat label="Network bits" value={String(facts.networkBits)} />
          <Stat label="Host bits" value={String(facts.hostBits)} />
          <Stat label="Total addresses" value={facts.totalAddresses.toLocaleString()} />
          <Stat label="Usable hosts" value={facts.usableHosts.toLocaleString()} />
        </div>

        <div className="mt-3 border-t border-[var(--border)] pt-3 text-center">
          <div className="font-data text-[11px] text-[var(--text-dim)]">{facts.maskBinary}</div>
          <div className="mt-0.5 font-data text-sm font-bold text-[var(--text-primary)]">
            {facts.mask}
          </div>
        </div>

        {facts.note && (
          <p className="mt-3 border-l-2 border-[var(--accent-amber)] bg-[rgba(240,180,41,0.06)] px-3 py-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
            {facts.note}
          </p>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--bg-inset)] px-2 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-widest text-[var(--text-dim)]">{label}</div>
      <div className="mt-0.5 text-[13px] font-bold text-[var(--text-primary)]">{value}</div>
    </div>
  )
}
