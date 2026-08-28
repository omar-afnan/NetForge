import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'

interface AppShellProps {
  children: React.ReactNode
  rightPanel?: React.ReactNode
  bottomPanel?: React.ReactNode
}

export function AppShell({ children, rightPanel, bottomPanel }: AppShellProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
          {bottomPanel && (
            <div className="panel h-48 shrink-0 border-t">{bottomPanel}</div>
          )}
        </div>
        {rightPanel && (
          <aside className="panel w-72 shrink-0 border-l">{rightPanel}</aside>
        )}
      </div>
      <StatusBar />
    </div>
  )
}
