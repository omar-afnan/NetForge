import { useEffect, useState } from 'react'
import { CheckCircle2, PartyPopper, X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { Button } from '@/components/ui/button'
import { ALL_LABS } from '@/data/labs'
import { labCompletionService, type LabCompletionEvent } from '@/features/labs/completion/completionEvents'

/**
 * Full-screen celebration overlay.
 * Subscribes to the one-shot completion-event bus — fires ONLY on a genuine
 * new completion, never replays on nav/reload/Dashboard.
 */
export function LabCompleteOverlay() {
  const setActiveView = useUIStore((s) => s.setActiveView)
  const [event, setEvent] = useState<LabCompletionEvent | null>(null)

  useEffect(() => {
    const off = labCompletionService.subscribe((e) => setEvent(e))
    return off
  }, [])

  if (!event) return null
  const lab = ALL_LABS.find((l) => l.id === event.labId)
  if (!lab) return null

  const skill = `${lab.title.replace(/^The /i, '').toUpperCase()} TROUBLESHOOTING`
  const close = () => setEvent(null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close} role="presentation">
      <div className="relative w-full max-w-md border border-[var(--border-bright)] bg-[var(--bg-elevated)] p-6 shadow-xl animate-[takeover-pop_0.25s_ease-out]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Lab complete">
        <span className="absolute -top-2 left-3 text-[var(--accent-amber)] opacity-40">✦</span>
        <span className="absolute top-3 right-4 text-[var(--status-up)] opacity-30">✦</span>
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
          <Button variant="icon" size="sm" aria-label="Close" onClick={close}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ul className="mt-5 space-y-2 border-t border-[var(--border)] pt-4">
          {['Fault identified and diagnosed', 'Network configuration corrected', 'End-to-end connectivity restored'].map((line) => (
            <li key={line} className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--status-up)]" strokeWidth={1.75} />
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-5 border border-[var(--accent-amber)] bg-[rgba(240,180,41,0.06)] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">Skill earned</div>
          <div className="mt-1 font-data text-[12px] font-semibold text-[var(--accent-amber)]">{skill}</div>
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="accent" size="sm" className="flex-1" onClick={() => { close(); setActiveView('labs') }}>Return to Lab Library</Button>
          <Button variant="secondary" size="sm" onClick={close}>Keep exploring</Button>
        </div>
      </div>
    </div>
  )
}