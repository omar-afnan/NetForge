import { useMemo, useState } from 'react'
import { RotateCcw, Split } from 'lucide-react'
import { splitNetwork } from '@/lib/subnetMath'
import { ExplainPopover } from '@/components/learn/ExplainPopover'

/**
 * Watch an address block physically break into smaller ones. "Split each"
 * bumps every block's prefix by one; the bars halve their width with a
 * transition so the learner sees the space dividing. Capped at /29 so the
 * blocks stay readable.
 */
export function SubnetSplitter({
  baseCidr = '192.168.1.0/24',
  maxPrefix = 29,
}: {
  baseCidr?: string
  maxPrefix?: number
}) {
  const [, basePrefixStr] = baseCidr.split('/')
  const basePrefix = Number(basePrefixStr)
  const [prefix, setPrefix] = useState(basePrefix)

  const blocks = useMemo(() => splitNetwork(baseCidr, prefix), [baseCidr, prefix])
  const canSplit = prefix < maxPrefix

  return (
    <div className="my-3 border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <span className="font-data text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          Subnet splitter - {baseCidr}
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={!canSplit}
            onClick={() => setPrefix((p) => Math.min(maxPrefix, p + 1))}
            className="flex items-center gap-1 border border-[var(--border-bright)] px-2 py-0.5 font-data text-[10px] text-[var(--text-primary)] transition-colors hover:border-[var(--accent-link)] disabled:opacity-40"
          >
            <Split className="h-3 w-3" />
            Split each
          </button>
          <button
            type="button"
            disabled={prefix === basePrefix}
            onClick={() => setPrefix(basePrefix)}
            className="flex items-center gap-1 border border-[var(--border)] px-2 py-0.5 font-data text-[10px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-link)] hover:text-[var(--accent-link)] disabled:opacity-40"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-1 font-data text-[11px] text-[var(--text-secondary)]">
          <span>
            {blocks.length} subnet{blocks.length > 1 ? 's' : ''} of{' '}
          </span>
          <ExplainPopover objectKey={`cidr:/${prefix}`} label={`/${prefix}`} />
          <span>- {blocks[0].usableHosts.toLocaleString()} usable hosts each</span>
        </div>

        {/* proportional bars */}
        <div className="mt-3 flex h-10 w-full overflow-hidden border border-[var(--border)]">
          {blocks.map((b, i) => (
            <div
              key={b.cidr}
              className="flex items-center justify-center border-r border-[var(--bg-root)] bg-[color-mix(in_srgb,var(--accent-link)_16%,var(--bg-inset))] transition-all duration-500 last:border-r-0"
              style={{ flexBasis: `${100 / blocks.length}%` }}
            >
              <span className="truncate px-1 font-data text-[9px] text-[var(--text-secondary)]">
                {blocks.length <= 8 ? b.network.split('.').pop() : i === 0 ? '.0' : ''}
              </span>
            </div>
          ))}
        </div>

        {/* detail list */}
        <div className="mt-3 grid gap-1 sm:grid-cols-2">
          {blocks.slice(0, 8).map((b) => (
            <div
              key={b.cidr}
              className="flex items-center justify-between border border-[var(--border)] bg-[var(--bg-inset)] px-2.5 py-1.5 font-data text-[11px]"
            >
              <span className="font-bold text-[var(--text-primary)]">{b.cidr}</span>
              <span className="text-[var(--text-dim)]">
                {b.firstHost.split('.').pop()}-{b.lastHost.split('.').pop()}
              </span>
            </div>
          ))}
        </div>
        {blocks.length > 8 && (
          <p className="mt-2 font-data text-[10px] text-[var(--text-dim)]">
            + {blocks.length - 8} more subnets
          </p>
        )}
      </div>
    </div>
  )
}
