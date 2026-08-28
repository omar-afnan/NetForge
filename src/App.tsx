import { useEffect } from 'react'
import { AlertTriangle, HardDrive, Link2, Network } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { LabLibrary } from '@/components/labs/LabLibrary'
import { DeviceInspector } from '@/components/devices/DeviceInspector'
import { DeviceTable } from '@/components/devices/DeviceTable'
import { TopologyCanvas } from '@/components/topology/TopologyCanvas'
import { TopologyToolbar } from '@/components/topology/TopologyToolbar'
import { NetworkTerminal } from '@/components/terminal/NetworkTerminal'
import { SettingsView } from '@/components/settings/SettingsView'
import { useUIStore } from '@/store/uiStore'
import { useNetworkStore } from '@/store/networkStore'
import { useSettingsStore } from '@/store/settingsStore'

function DashboardView() {
  const devices = useNetworkStore((s) => s.devices)
  const links = useNetworkStore((s) => s.links)
  const lab = useNetworkStore((s) => s.lab)
  const issues = useNetworkStore((s) => s.issues)
  const compactTables = useSettingsStore((s) => s.compactTables)

  const stats = [
    { label: 'Devices', value: devices.length, icon: HardDrive, accent: 'var(--accent-link)' },
    { label: 'Links', value: links.length, icon: Link2, accent: 'var(--status-up)' },
    { label: 'Open Issues', value: issues.length, icon: AlertTriangle, accent: 'var(--status-warn)' },
    { label: 'Active Lab', value: lab.title, icon: Network, accent: 'var(--accent-amber)', isText: true },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="panel-header">Operations Dashboard</div>
      <div className="grid grid-cols-2 gap-3 p-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="stat-card p-4"
            style={{ '--stat-accent': stat.accent } as React.CSSProperties}
          >
            <div className="flex items-start justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                {stat.label}
              </div>
              <stat.icon className="h-4 w-4 text-[var(--text-dim)]" strokeWidth={1.5} />
            </div>
            <div
              className={`mt-2 font-data font-semibold text-[var(--text-primary)] ${
                stat.isText ? 'text-sm' : 'text-2xl'
              }`}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>
      <div className="panel mx-3 mb-3 min-h-0 flex-1 overflow-hidden border">
        <div className="panel-header">Device Inventory</div>
        <div className={compactTables ? 'table-compact' : ''}>
          <DeviceTable />
        </div>
      </div>
    </div>
  )
}

function TopologyView() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>Network Topology</span>
        <span className="badge badge-cyan font-data text-[9px] normal-case tracking-normal">
          drag to move · wire to connect
        </span>
      </div>
      <TopologyToolbar />
      <div className="min-h-0 flex-1">
        <TopologyCanvas />
      </div>
    </div>
  )
}

function PlaceholderView({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-full flex-col">
      <div className="panel-header">{title}</div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <div className="text-[11px] uppercase tracking-widest text-[var(--text-dim)]">Coming soon</div>
        <p className="max-w-sm text-[12px] text-[var(--text-secondary)]">{detail}</p>
      </div>
    </div>
  )
}

function App() {
  const activeView = useUIStore((s) => s.activeView)
  const glowEffects = useSettingsStore((s) => s.glowEffects)

  useEffect(() => {
    document.body.classList.toggle('glow-off', !glowEffects)
  }, [glowEffects])

  let main: React.ReactNode
  let bottom: React.ReactNode | undefined = <NetworkTerminal />
  let right: React.ReactNode | undefined = <DeviceInspector />

  switch (activeView) {
    case 'dashboard':
      main = <DashboardView />
      break
    case 'topology':
      main = <TopologyView />
      break
    case 'terminal':
      main = <NetworkTerminal />
      bottom = undefined
      right = undefined
      break
    case 'traffic':
      main = <PlaceholderView title="Traffic Monitor" detail="Packet flow logging arrives in a later phase." />
      break
    case 'issues':
      main = <PlaceholderView title="Issue Tracker" detail="Failure injection and issue detection arrive in Phase 5." />
      break
    case 'labs':
      main = <LabLibrary />
      break
    case 'settings':
      main = <SettingsView />
      bottom = undefined
      right = undefined
      break
    default:
      main = <TopologyView />
  }

  return (
    <AppShell rightPanel={right} bottomPanel={bottom}>
      {main}
    </AppShell>
  )
}

export default App
