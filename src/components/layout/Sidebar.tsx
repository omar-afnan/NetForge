import {
  Activity,
  AlertTriangle,
  BookOpen,
  LayoutDashboard,
  Library,
  Network,
  Radio,
  Settings,
  Terminal,
} from 'lucide-react'
import { UserButton } from '@clerk/react'
import { useNetworkStore } from '@/store/networkStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useUIStore } from '@/store/uiStore'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'learn', label: 'Learn', icon: BookOpen },
  { id: 'labs', label: 'Lab Library', icon: Library },
  { id: 'topology', label: 'Topology', icon: Network },
  { id: 'traffic', label: 'Traffic', icon: Radio },
  { id: 'issues', label: 'Issues', icon: AlertTriangle },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

export function Sidebar() {
  const activeView = useUIStore((s) => s.activeView)
  const setActiveView = useUIStore((s) => s.setActiveView)
  const lab = useNetworkStore((s) => s.lab)
  const devices = useNetworkStore((s) => s.devices)
  const links = useNetworkStore((s) => s.links)
  const glowEffects = useSettingsStore((s) => s.glowEffects)

  return (
    <aside className={`panel flex w-52 shrink-0 flex-col border-r ${glowEffects ? 'shadow-[var(--glow-cyan)]' : ''}`}>
      <div className="relative border-b border-[var(--border)] px-3 py-4">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-link)] to-transparent opacity-60" />
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center border border-[var(--border-bright)] bg-[var(--bg-elevated)]">
            <Activity className="h-4 w-4 text-[var(--accent-link)]" strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wider text-[var(--text-primary)]">NETFORGE</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--accent-link)]">NOC Console</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-2">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = activeView === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveView(id)}
              className={`mb-0.5 flex w-full items-center gap-2.5 border px-2.5 py-2 text-left text-[12px] transition-all ${
                active
                  ? 'nav-active'
                  : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-[var(--accent-link)]' : ''}`}
                strokeWidth={1.75}
              />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-[var(--border)] bg-[var(--bg-inset)] p-3 text-[11px]">
        <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
          Environment
        </div>
        <div className="font-data text-[12px] text-[var(--text-primary)]">{lab.title}</div>
        <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-[var(--border)] pt-2 text-[10px]">
          <span className="text-[var(--text-dim)]">Devices</span>
          <span className="font-data text-right text-[var(--accent-link)]">{devices.length}</span>
          <span className="text-[var(--text-dim)]">Links</span>
          <span className="font-data text-right text-[var(--accent-link)]">{links.length}</span>
        </div>
      </div>

      <div className="border-t border-[var(--border)] p-3">
        <UserButton />
      </div>
    </aside>
  )
}
