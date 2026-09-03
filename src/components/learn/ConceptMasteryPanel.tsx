import { CONCEPT_LABELS, CONCEPT_ORDER, useConceptMastery } from '@/store/masteryStore'

/**
 * Concept mastery - a compact, professional read-out of how solid each core
 * concept is, driven by the interactive lessons. No points, no badges: just a
 * bar per concept so a learner can see what still needs work.
 */
export function ConceptMasteryPanel() {
  const scores = useConceptMastery((s) => s.scores)
  const anyProgress = CONCEPT_ORDER.some((c) => scores[c] > 0)
  if (!anyProgress) return null

  return (
    <div className="mb-3 border border-[var(--border)] bg-[var(--bg-panel)] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
        Concept mastery
      </div>
      <div className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {CONCEPT_ORDER.map((c) => {
          const pct = scores[c] ?? 0
          return (
            <div key={c} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-[11px] text-[var(--text-secondary)]">
                {CONCEPT_LABELS[c]}
              </span>
              <div className="h-1.5 flex-1 bg-[var(--bg-inset)]">
                <div
                  className="h-full bg-[var(--accent-link)] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right font-data text-[10px] text-[var(--text-dim)]">
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
