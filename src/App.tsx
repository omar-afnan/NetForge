import { AppShell } from '@/components/layout/AppShell'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { LabLibrary } from '@/components/labs/LabLibrary'
import { LabCompleteOverlay } from '@/components/labs/LabCompleteOverlay'
import { IssueTracker } from '@/components/issues/IssueTracker'
import { TrafficMonitor } from '@/components/traffic/TrafficMonitor'
const RightSidebar = lazy(() => import('@/components/assistant/RightSidebar').then((m) => ({ default: m.RightSidebar })))
const DeviceLabRightSidebar = lazy(() => import('@/components/devicelab/DeviceLabRightSidebar').then((m) => ({ default: m.DeviceLabRightSidebar })))
const TopologyCanvas = lazy(() => import('@/components/topology/TopologyCanvas').then((m) => ({ default: m.TopologyCanvas })))
import { TopologyToolbar } from '@/components/topology/TopologyToolbar'
const NetworkTerminal = lazy(() => import('@/components/terminal/NetworkTerminal').then((m) => ({ default: m.NetworkTerminal })))
import { SettingsView } from '@/components/settings/SettingsView'
import { LearnView } from '@/components/learn/LearnView'
import { DeviceLabView } from '@/components/devicelab/DeviceLabView'
import { LandingPage } from '@/components/landing/LandingPage'
import { TakeoverOverlay } from '@/components/assistant/TakeoverOverlay'
import { useUIStore } from '@/store/uiStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useAuth } from '@clerk/react'

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
  const deviceLabLessonOpen = useUIStore((s) => s.deviceLabLessonOpen)
  const glowEffects = useSettingsStore((s) => s.glowEffects)
  const { isSignedIn } = useAuth()

  useEffect(() => {
    document.body.classList.toggle('glow-off', !glowEffects)
  }, [glowEffects])

  // After signing in from the landing page, land on Learn - the primary
  // experience for a networking learner. Only fire on the false→true transition,
  // not on every activeView change (which would re-trigger on every sidebar
  // click and trap the user on Learn).
  const wasSignedIn = useRef(false)
  useEffect(() => {
    if (isSignedIn && !wasSignedIn.current) {
      useUIStore.getState().setActiveView('learn')
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
    case 'learn':
      main = <LearnView />
      bottom = undefined
      right = undefined
      break
    case 'devicelab':
      main = <DeviceLabView />
      bottom = undefined
      // Show AI Copilot only after the user explicitly presses "Ask Copilot"
      // inside a lesson - the right sidebar is otherwise closed, and never
      // shows on the lesson picker or hardware bench.
      if (deviceLabCopilotRequested && deviceLabLessonOpen) {
        right = (
          <Suspense fallback={null}>
            <DeviceLabRightSidebar
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
      main = <LearnView />
      bottom = undefined
      right = undefined
  }

  return (
    <AppShell rightPanel={right} bottomPanel={bottom}>
      {main}
      <LabCompleteOverlay />
    </AppShell>
  )
}

export default App
