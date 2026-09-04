import { cn } from '@/lib/utils'

/**
 * RadioGroup - the NetForge console take on a segmented single-choice control.
 * Each option is a bordered row that lights with the accent colour when
 * selected (filled dot + a faint static ring). Fully keyboard/AT accessible:
 * a real <input type="radio"> drives every option, visually hidden.
 *
 * Deliberately no spinning ring / infinite animation - it lives inside dense
 * panels and must stay quiet.
 */

export interface RadioOption {
  value: string
  label: string
  /** Optional one-line helper under the label. */
  hint?: string
}

export function RadioGroup({
  options,
  value,
  onChange,
  name,
  ariaLabel,
  columns = 1,
  className,
}: {
  options: RadioOption[]
  value: string | null
  onChange: (value: string) => void
  name: string
  ariaLabel?: string
  columns?: 1 | 2 | 3
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'grid gap-1.5',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <label
            key={opt.value}
            className={cn(
              'group flex cursor-pointer items-start gap-2.5 rounded-[var(--radius)] border px-3 py-2 transition-colors',
              selected
                ? 'border-[var(--accent-link)] bg-[color-mix(in_srgb,var(--accent-link)_10%,var(--bg-elevated))]'
                : 'border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--border-bright)]',
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <span
              className={cn(
                'relative mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
                selected
                  ? 'border-[var(--accent-link)]'
                  : 'border-[var(--border-bright)] group-hover:border-[var(--text-dim)]',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full bg-[var(--accent-link)] transition-transform duration-200',
                  selected ? 'scale-100' : 'scale-0',
                )}
              />
              {selected && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-[-4px] rounded-full border border-[var(--accent-link)] opacity-40"
                />
              )}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  'block text-[12px] leading-tight transition-colors',
                  selected
                    ? 'font-semibold text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]',
                )}
              >
                {opt.label}
              </span>
              {opt.hint && (
                <span className="mt-0.5 block text-[10.5px] leading-snug text-[var(--text-dim)]">
                  {opt.hint}
                </span>
              )}
            </span>
          </label>
        )
      })}
    </div>
  )
}
