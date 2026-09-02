import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, PartyPopper, X } from 'lucide-react'
import { useNetworkStore } from '@/store/networkStore'
import { useUIStore } from '@/store/uiStore'
import { ALL_LABS } from '@/data/labs'

/**
 * Full-screen "🎉 Lab Complete" celebration. Fires the first time a lab's
 * connectivity matrix fully passes - listing what was achieved and the skill
 * earned, with a one-click return to the Lab Library.
 */
export function LabCompleteOverlay() {
  const completedLabs = useNetworkStore((s) => s.completedLabs)
  const setActiveView = useUIStore((s) => s.setActiveView)
  const [labId, setLabId] = useState<string | null>(null)
  const prevCompleted = useRef<Set<string>>(new Set())

  useEffect(() => {
    const nowCompleted = new Set(
      Object.entries(completedLabs)
        .filter(([, p]) => p?.completed)
        .map(([id]) => id),
    )
    for (const id of nowCompleted) {
      if (!prevCompleted.current.has(id)) {
        setLabId(id)
        break
      }
    }
    prevCompleted.current = nowCompleted
  }, [completedLabs])

  if (!labId) return null
  const lab = ALL_LABS.find((l) => l.id === labId)
  if (!lab) return null

  const skill = `${lab.title.replace(/^The /i, '').toUpperCase()} TROUBLESHOOTING`
  const close = () => setLabId(null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full max-w-md border border-[var(--border-bright)] bg-[var(--bg-elevated)] p-6 shadow-xl animate-[takeover-pop_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Lab complete"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center border border-[var(--status-up)] bg-[rgba(22,163,74,0.08)]">
              <PartyPopper className="h-5 w-5 text-[var(--status-up)]" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-base font-bold text-[var(--text-primary)]">Lab Complete!</div>
              <div className="text-[12px] text-[var(--text-secondary)]">{lab.title}</div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
            onClick={close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="mt-5 space-y-2 border-t border-[var(--border)] pt-4">
          {[
            'Fault identified and diagnosed',
            'Network configuration corrected',
            'End-to-end connectivity restored',
          ].map((line) => (
            <li key={line} className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--status-up)]" strokeWidth={1.75} />
              {line}
            </li>
          ))}
        </ul>

        <div className="mt-5 border border-[var(--accent-amber)] bg-[rgba(240,180,41,0.06)] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
            Skill earned
          </div>
          <div className="mt-1 font-data text-[12px] font-semibold text-[var(--accent-amber)]">
            {skill}
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            className="flex-1 border border-[var(--accent-link)] bg-[var(--accent-link)]/10 px-4 py-2 text-[12px] font-semibold text-[var(--accent-link)] transition-colors hover:bg-[var(--accent-link)]/20"
            onClick={() => {
              close()
              setActiveView('labs')
            }}
          >
            Return to Lab Library
          </button>
          <button
            type="button"
            className="border border-[var(--border)] px-4 py-2 text-[12px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            onClick={close}
          >
            Keep exploring
          </button>
        </div>
      </div>
    </div>
  )
}
