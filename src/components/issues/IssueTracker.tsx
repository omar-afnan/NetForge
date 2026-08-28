import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react'
import { describeFailure } from '@/network/failures'
import { getDeviceById } from '@/network/devices'
import { useNetworkStore } from '@/store/networkStore'

const severityLabel: Record<string, string> = {
  critical: 'CRITICAL',
  warning: 'WARNING',
  info: 'INFO',
}

export function IssueTracker() {
  const issues = useNetworkStore((s) => s.issues)
  const failures = useNetworkStore((s) => s.failures)
  const devices = useNetworkStore((s) => s.devices)
  const revalidate = useNetworkStore((s) => s.revalidate)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>Issue Tracker</span>
        <button
          type="button"
          className="flex items-center gap-1.5 border border-[var(--border)] px-2 py-0.5 font-data text-[10px] font-normal normal-case tracking-normal text-[var(--text-secondary)] transition-colors hover:border-[var(--border-bright)] hover:text-[var(--text-primary)]"
          onClick={() => revalidate()}
        >
          <RefreshCw className="h-3 w-3" />
          Re-scan
        </button>
      </div>

      {failures.length > 0 && (
        <div className="border-b border-[var(--border)] bg-[rgba(248,113,113,0.06)] px-3 py-2">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-[var(--status-down)]">
            Injected faults in this lab
          </div>
          <ul className="mt-1 space-y-0.5">
            {failures.map((failure, index) => (
              <li key={`${failure.type}-${failure.deviceId}-${index}`} className="font-data text-[10px] text-[var(--text-secondary)]">
                {describeFailure(failure, devices)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {issues.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <ShieldCheck className="h-6 w-6 text-[var(--status-up)]" strokeWidth={1.5} />
            <div className="text-[12px] text-[var(--text-secondary)]">No issues detected</div>
            <div className="max-w-xs text-[11px] text-[var(--text-dim)]">
              Config and reachability audits run automatically after every change.
            </div>
          </div>
        ) : (
          <ul>
            {issues.map((issue) => {
              const device = getDeviceById(devices, issue.deviceId)
              return (
                <li key={issue.id} className="border-b border-[var(--border)] p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={`h-3.5 w-3.5 shrink-0 ${issue.severity === 'critical' ? 'text-[var(--status-down)]' : 'text-[var(--status-warn)]'}`}
                      strokeWidth={1.75}
                    />
                    <span
                      className={`badge ${issue.severity === 'critical' ? 'difficulty-advanced' : 'difficulty-intermediate'}`}
                    >
                      {severityLabel[issue.severity] ?? issue.severity}
                    </span>
                    <span className="font-data text-[11px] text-[var(--text-primary)]">
                      {device?.hostname ?? issue.deviceId}
                    </span>
                    <span className="ml-auto font-data text-[9px] text-[var(--text-dim)]">{issue.detectedBy}</span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-[var(--text-secondary)]">{issue.description}</div>
                  <div className="mt-1 font-data text-[10px] text-[var(--text-dim)]">evidence: {issue.evidence}</div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}