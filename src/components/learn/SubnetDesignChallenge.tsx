import { useMemo, useState } from 'react'
import { ArrowRight, Check, Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addressBreakdown, describePrefix } from '@/lib/subnetMath'
import { ipToInt, intToIp } from '@/network/ip'
import { useUIStore } from '@/store/uiStore'
import { bumpConcept } from '@/store/masteryStore'
import { celebrateLab } from '@/lib/celebrate'

/**
 * Practice Mode for the IPv4 & CIDR lesson. The learner sizes a subnet for
 * each department out of one /24, gets live capacity feedback, and on
 * "Validate" is told - in networking terms - exactly why a plan does or does
 * not work. Self-contained: no live simulator this phase, but a hand-off
 * button drops them into the Device Lab mask exercise.
 */

const BASE = '192.168.10.0/24'
const BASE_INT = ipToInt('192.168.10.0')
const BASE_SIZE = 256

interface Dept {
  id: string
  name: string
  need: number
}

const DEPARTMENTS: Dept[] = [
  { id: 'sales', name: 'Sales', need: 50 },
  { id: 'it', name: 'IT', need: 25 },
  { id: 'hr', name: 'HR', need: 10 },
  { id: 'mgmt', name: 'Management', need: 5 },
]

const MIN_PREFIX = 24
const MAX_PREFIX = 30

interface Placed extends Dept {
  prefix: number
  usable: number
  size: number
  /** Byte offset within the /24, or -1 if it did not fit. */
  offset: number
  network: string
  broadcast: string
}

/** Greedy aligned allocation in list order - mirrors how you'd hand-plan it. */
function allocate(prefixes: Record<string, number>): { placed: Placed[]; cursor: number } {
  let cursor = 0
  const placed = DEPARTMENTS.map((d) => {
    const prefix = prefixes[d.id]
    const facts = describePrefix(prefix)
    const size = facts.totalAddresses
    // align cursor up to a multiple of the block size
    const aligned = Math.ceil(cursor / size) * size
    const fits = aligned + size <= BASE_SIZE
    const offset = fits ? aligned : -1
    if (fits) cursor = aligned + size
    const netIp = fits ? intToIp((BASE_INT + aligned) >>> 0) : '-'
    const b = fits ? addressBreakdown(netIp, prefix) : null
    return {
      ...d,
      prefix,
      usable: facts.usableHosts,
      size,
      offset,
      network: fits ? `${netIp}/${prefix}` : '(no room)',
      broadcast: b ? b.broadcast : '-',
    }
  })
  return { placed, cursor }
}

export function SubnetDesignChallenge({ onExit }: { onExit?: () => void }) {
  const [prefixes, setPrefixes] = useState<Record<string, number>>(() =>
    Object.fromEntries(DEPARTMENTS.map((d) => [d.id, 26])),
  )
  const [checked, setChecked] = useState(false)

  const { placed, cursor } = useMemo(() => allocate(prefixes), [prefixes])

  const problems = useMemo(() => {
    const out: string[] = []
    for (const p of placed) {
      if (p.usable < p.need) {
        out.push(
          `${p.name} needs ${p.need} hosts but /${p.prefix} only provides ${p.usable} usable. Borrow one fewer bit - try /${p.prefix - 1}.`,
        )
      }
      if (p.offset < 0) {
        out.push(
          `${p.name} does not fit: the earlier subnets already use the space a /${p.prefix} block would need.`,
        )
      }
    }
    if (cursor > BASE_SIZE) {
      out.push(
        `The plan reserves ${cursor} addresses, but ${BASE} only has ${BASE_SIZE}. Make the larger subnets tighter.`,
      )
    }
    return out
  }, [placed, cursor])

  const solved = checked && problems.length === 0

  const validate = () => {
    setChecked(true)
    if (problems.length === 0) {
      celebrateLab()
      bumpConcept('network-addresses', 40)
      bumpConcept('cidr', 25)
      bumpConcept('subnet-masks', 15)
    }
  }

  const step = (id: string, delta: number) => {
    setChecked(false)
    setPrefixes((prev) => ({
      ...prev,
      [id]: Math.max(MIN_PREFIX, Math.min(MAX_PREFIX, prev[id] + delta)),
    }))
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>Practice · Design an office network</span>
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
            You are wiring a small office. You have been given{' '}
            <span className="font-data text-[var(--text-primary)]">{BASE}</span>. Size a subnet for
            each department - big enough for its hosts, no bigger than it needs.
          </p>

          {/* the /24 as one bar */}
          <div className="mt-4">
            <div className="flex h-9 w-full overflow-hidden border border-[var(--border)]">
              {placed.map((p) =>
                p.offset < 0 ? null : (
                  <div
                    key={p.id}
                    className="flex items-center justify-center border-r border-[var(--bg-root)] transition-all duration-300 last:border-r-0"
                    style={{
                      flexBasis: `${(p.size / BASE_SIZE) * 100}%`,
                      background:
                        p.usable < p.need
                          ? 'color-mix(in srgb, var(--status-down) 22%, var(--bg-inset))'
                          : 'color-mix(in srgb, var(--accent-link) 18%, var(--bg-inset))',
                    }}
                  >
                    <span className="truncate px-1 font-data text-[9px] text-[var(--text-secondary)]">
                      {p.name}
                    </span>
                  </div>
                ),
              )}
              {cursor < BASE_SIZE && (
                <div
                  className="flex items-center justify-center bg-[var(--bg-inset)]"
                  style={{ flexBasis: `${((BASE_SIZE - cursor) / BASE_SIZE) * 100}%` }}
                >
                  <span className="font-data text-[9px] text-[var(--text-dim)]">free</span>
                </div>
              )}
            </div>
            <div className="mt-1 flex justify-between font-data text-[9px] text-[var(--text-dim)]">
              <span>.0</span>
              <span>
                {Math.min(cursor, BASE_SIZE)} / {BASE_SIZE} used
              </span>
              <span>.255</span>
            </div>
          </div>

          {/* department controls */}
          <div className="mt-4 space-y-2">
            {placed.map((p) => {
              const ok = p.usable >= p.need && p.offset >= 0
              const waste = p.offset >= 0 ? Math.max(0, p.usable - p.need) : 0
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]">
                      {p.name}
                      <span className="font-data text-[10px] font-normal text-[var(--text-dim)]">
                        needs {p.need} hosts
                      </span>
                    </div>
                    <div className="mt-0.5 font-data text-[10px] text-[var(--text-dim)]">
                      {p.network}
                      {p.offset >= 0 && (
                        <>
                          {' '}
                          · {p.usable} usable
                          {ok && waste > 0 && (
                            <span className="text-[var(--accent-amber)]"> · {waste} wasted</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-[var(--border-bright)]">
                      <button
                        type="button"
                        onClick={() => step(p.id, -1)}
                        disabled={p.prefix <= MIN_PREFIX}
                        className="flex h-7 w-7 items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-link)] disabled:opacity-30"
                        aria-label={`Larger subnet for ${p.name}`}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-10 text-center font-data text-[12px] font-bold text-[var(--text-primary)]">
                        /{p.prefix}
                      </span>
                      <button
                        type="button"
                        onClick={() => step(p.id, 1)}
                        disabled={p.prefix >= MAX_PREFIX}
                        className="flex h-7 w-7 items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent-link)] disabled:opacity-30"
                        aria-label={`Smaller subnet for ${p.name}`}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span
                      className={`flex h-5 w-5 items-center justify-center border ${
                        ok
                          ? 'border-[var(--status-up)] text-[var(--status-up)]'
                          : 'border-[var(--status-down)] text-[var(--status-down)]'
                      }`}
                    >
                      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button variant="accent" size="sm" onClick={validate}>
              Validate design
            </Button>
            {checked && !solved && (
              <span className="font-data text-[11px] text-[var(--status-down)]">
                {problems.length} problem{problems.length > 1 ? 's' : ''} to fix
              </span>
            )}
          </div>

          {checked && problems.length > 0 && (
            <ul className="mt-3 space-y-1.5 border border-[var(--status-down)]/40 bg-[color-mix(in_srgb,var(--status-down)_7%,transparent)] p-3">
              {problems.map((p, i) => (
                <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  <X className="mt-0.5 h-3 w-3 shrink-0 text-[var(--status-down)]" />
                  {p}
                </li>
              ))}
            </ul>
          )}

          {solved && (
            <div className="mt-3 border border-[var(--status-up)]/40 bg-[color-mix(in_srgb,var(--status-up)_8%,transparent)] p-3">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--status-up)]">
                <Check className="h-4 w-4" /> Every department fits, with room to spare.
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                Notice the bigger subnets sit first: aligning each block to its own size is what
                keeps a plan from fragmenting. Next, configure these addresses on real devices.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => useUIStore.getState().openDeviceLabLesson('pc', 'p-mask')}
              >
                Configure a subnet mask in Device Lab
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
