import { AlertTriangle, HardDrive, Link2, Network } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { LabLibrary } from '@/components/labs/LabLibrary'
import { LabCompleteOverlay } from '@/components/labs/LabCompleteOverlay'
import { IssueTracker } from '@/components/issues/IssueTracker'
import { TrafficMonitor } from '@/components/traffic/TrafficMonitor'
const RightSidebar = lazy(() => import('@/components/assistant/RightSidebar').then((m) => ({ default: m.RightSidebar })))
import { DeviceTable } from '@/components/devices/DeviceTable'
const TopologyCanvas = lazy(() => import('@/components/topology/TopologyCanvas').then((m) => ({ default: m.TopologyCanvas })))
import { TopologyToolbar } from '@/components/topology/TopologyToolbar'
const NetworkTerminal = lazy(() => import('@/components/terminal/NetworkTerminal').then((m) => ({ default: m.NetworkTerminal })))
import { SettingsView } from '@/components/settings/SettingsView'
import { LearnView } from '@/components/learn/LearnView'
import { DeviceLabView } from '@/components/devicelab/DeviceLabView'
import { LandingPage } from '@/components/landing/LandingPage'
import { TakeoverOverlay } from '@/components/assistant/TakeoverOverlay'
import { useUIStore } from '@/store/uiStore'
import { useNetworkStore } from '@/store/networkStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useAuth } from '@clerk/react'

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
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>Network Topology</span>
        <span className="badge badge-cyan font-data text-[9px] normal-case tracking-normal">
          drag to move · wire to connect
        </span>
      </div>
      <TopologyToolbar />
      <div className="min-h-0 flex-1">
        <Suspense fallback={null}>
          <TopologyCanvas />
        </Suspense>
      </div>
      {/* Live AI takeover overlay - docked over the real topology canvas. */}
      <TakeoverOverlay />
    </div>
  )
}

function App() {
  const activeView = useUIStore((s) => s.activeView)
  const deviceLabCopilotRequested = useUIStore((s) => s.deviceLabCopilotRequested)
  const glowEffects = useSettingsStore((s) => s.glowEffects)
  const { isSignedIn } = useAuth()

  useEffect(() => {
    document.body.classList.toggle('glow-off', !glowEffects)
  }, [glowEffects])

  // After signing in from the landing page, land on the dashboard - but only on the
  // false→true transition, not on every activeView change (which would re-trigger on
  // every sidebar click and trap the user on the dashboard).
  const wasSignedIn = useRef(false)
  useEffect(() => {
    if (isSignedIn && !wasSignedIn.current) {
      useUIStore.getState().setActiveView('dashboard')
    }
    wasSignedIn.current = isSignedIn ?? false
  }, [isSignedIn])

  // Avoid blocking the whole app while Clerk finishes initializing.
  // Some environments (local/dev) may delay Clerk network calls; render the
  // app UI and let Clerk-controlled components handle their own readiness.
  if (!isSignedIn) {
    return <LandingPage />
  }

  let main: React.ReactNode
  let bottom: React.ReactNode | undefined = (
    <Suspense fallback={null}>
      <NetworkTerminal />
    </Suspense>
  )
  let right: React.ReactNode | undefined = undefined

  switch (activeView) {
    case 'dashboard':
      main = <DashboardView />
      break
    case 'learn':
      main = <LearnView />
      bottom = undefined
      right = undefined
      break
    case 'devicelab':
      main = <DeviceLabView />
      bottom = undefined
      // Show AI Copilot only after the user explicitly presses "Ask Copilot"
      // inside the lesson - the right sidebar is otherwise closed.
      if (deviceLabCopilotRequested) {
        right = (
          <Suspense fallback={null}>
            <RightSidebar
              defaultMode="copilot"
              onClose={() => useUIStore.getState().setDeviceLabCopilotRequested(false)}
            />
          </Suspense>
        )
      }
      break
    case 'topology':
      main = <TopologyView />
      // The right sidebar (Inspector / AI Copilot) is only relevant on the
      // topology page where users select devices/links on the canvas.
      right = (
        <Suspense fallback={null}>
          <RightSidebar />
        </Suspense>
      )
      break
    case 'terminal':
      main = <NetworkTerminal />
      bottom = undefined
      right = undefined
      break
    case 'traffic':
      main = <TrafficMonitor />
      break
    case 'issues':
      main = <IssueTracker />
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
      <LabCompleteOverlay />
    </AppShell>
  )
}

export default App
