import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'

interface AppShellProps {
  children: React.ReactNode
  rightPanel?: React.ReactNode
  bottomPanel?: React.ReactNode
}

export function AppShell({ children, rightPanel, bottomPanel }: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="app-shell-body">
        <Sidebar />
        <div className="app-shell-content">
          <div className={`netforge-layout${rightPanel ? ' with-diagnostics' : ''}`}>
            <main className="topology-panel">
              <div className="topology-column">
                <div className="topology-view">{children}</div>
                {bottomPanel && <div className="console-dock panel border-t">{bottomPanel}</div>}
              </div>
            </main>
            {rightPanel && (
              <aside className="diagnostics-panel panel border-l">{rightPanel}</aside>
            )}
          </div>
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
