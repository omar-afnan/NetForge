import { FlaskConical, Play, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ALL_LABS } from '@/data/labs'
import { useNetworkStore } from '@/store/networkStore'
import { useUIStore } from '@/store/uiStore'

const labs = ALL_LABS

export function LabLibrary() {
  const activeLabId = useNetworkStore((s) => s.lab.id)
  const completedLabs = useNetworkStore((s) => s.completedLabs)
  const loadLab = useNetworkStore((s) => s.loadLab)
  const setActiveView = useUIStore((s) => s.setActiveView)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="panel-header">Lab Library</div>
      <div className="flex-1 overflow-auto p-4">
        <p className="mb-4 max-w-3xl text-[12px] leading-relaxed text-[var(--text-secondary)]">
          Each lab loads the same enterprise topology with one injected fault. Reproduce the
          symptom from the terminal (<span className="font-data text-[var(--text-primary)]">ping</span>,{' '}
          <span className="font-data text-[var(--text-primary)]">traceroute</span>,{' '}
          <span className="font-data text-[var(--text-primary)]">show ip route</span>), inspect the
          map and device panels, then reset the baseline to keep building.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {labs.map((lab) => {
            const active = lab.id === activeLabId
            const progress = completedLabs[lab.id]
            return (
              <div
                key={lab.id}
                className={`panel flex flex-col p-4 transition-colors ${
                  active ? 'border-[var(--accent-link)]' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {lab.id === 'starter' ? (
                      <FlaskConical className="h-3.5 w-3.5 text-[var(--accent-link)]" strokeWidth={1.75} />
                    ) : progress?.completed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-up)]" strokeWidth={1.75} />
                    ) : (
                      <FlaskConical className="h-3.5 w-3.5 text-[var(--accent-link)]" strokeWidth={1.75} />
                    )}
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">{lab.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {lab.id === 'starter' ? (
                      <span className="badge badge-cyan">Baseline</span>
                    ) : progress?.completed ? (
                      <span className="badge badge-completed">Completed</span>
                    ) : null}
                    <span className={`badge difficulty-${lab.difficulty}`}>{lab.difficulty}</span>
                  </div>
                </div>

                <div className="mt-1 font-data text-[10px] text-[var(--text-dim)]">
                  {lab.id} · {lab.id === 'starter' ? 'sandbox baseline' : `${lab.issueCount} injected ${lab.issueCount === 1 ? 'fault' : 'faults'}`}
                </div>

                {lab.id === 'starter' ? (
                  <div className="mt-1 font-data text-[10px] text-[var(--text-dim)]">
                    Baseline sandbox — no faults injected.
                  </div>
                ) : progress?.completed ? (
                  <div className="mt-1 font-data text-[10px] text-[var(--status-up)]">
                    ✓ Completed {progress.completedAt ? new Date(progress.completedAt).toLocaleDateString() : ''}
                    {progress.aiAssisted ? ' · AI assisted' : ''}
                  </div>
                ) : null}

                <p className="mt-2 flex-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {lab.description}
                </p>

                <Button
                  variant={active ? 'minimal' : progress?.completed ? 'secondary' : 'accent'}
                  size="sm"
                  disabled={active}
                  className="mt-3"
                  onClick={() => {
                    loadLab(lab)
                    setActiveView('topology')
                  }}
                >
                  <Play className="h-3 w-3" />
                  {active ? 'Currently loaded' : progress?.completed ? 'Open Lab' : 'Load Lab'}
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}