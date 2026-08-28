import { useNetworkStore } from '@/store/networkStore'
import { useUIStore } from '@/store/uiStore'

export function StatusBar() {
  const devices = useNetworkStore((s) => s.devices)
  const links = useNetworkStore((s) => s.links)
  const issues = useNetworkStore((s) => s.issues)
  const lab = useNetworkStore((s) => s.lab)
  const topologyTool = useUIStore((s) => s.topologyTool)

  const modeClass =
    topologyTool === 'delete'
      ? 'status-down'
      : topologyTool === 'select'
        ? 'text-[var(--text-primary)]'
        : 'status-warn'

  const healthy = devices.filter((d) => d.status === 'healthy').length
  const upLinks = links.filter((l) => l.status === 'up').length
  const healthPct = devices.length ? Math.round((healthy / devices.length) * 100) : 0

  return (
    <footer className="panel flex h-8 shrink-0 items-center justify-between border-t bg-[var(--bg-inset)] px-3 font-data text-[10px] text-[var(--text-secondary)]">
      <div className="flex items-center gap-4">
        <span>
          LAB <span className="text-[var(--text-primary)]">{lab.title}</span>
        </span>
        <span>
          MODE <span className={modeClass}>{topologyTool.toUpperCase()}</span>
        </span>
        <span>
          IF_UP <span className="text-[var(--status-up)]">{upLinks}</span>/{links.length}
        </span>
        <span>
          BROKEN{' '}
          <span className={links.length - upLinks > 0 ? 'status-down' : 'text-[var(--text-dim)]'}>
            {links.length - upLinks}
          </span>
        </span>
        <span>
          ISSUES <span className={issues.length ? 'status-warn' : 'text-[var(--text-dim)]'}>{issues.length}</span>
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className={healthPct === 100 ? 'status-up' : 'status-warn'}>
          HEALTH {healthPct}%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="pulse-dot" />
          SIM ONLINE
        </span>
      </div>
    </footer>
  )
}
