import { Network } from 'lucide-react'

function App() {
  return (
    <div className="flex h-full min-h-screen flex-col items-center justify-center bg-[#0a0e17] p-8">
      <div className="w-full max-w-2xl rounded-lg border border-cyan-500/20 bg-slate-900/60 p-10 text-center shadow-[0_0_40px_rgba(34,211,238,0.08)] backdrop-blur-sm">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 p-4">
            <Network className="h-10 w-10 text-cyan-400" />
          </div>
        </div>
        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-slate-100">
          NetForge
        </h1>
        <p className="mb-6 text-cyan-400/90">
          A network that agents can actually debug.
        </p>
        <p className="text-sm text-slate-400">
          React · TypeScript · Vite · Tailwind CSS · React Flow · Zustand
        </p>
        <p className="mt-4 text-xs text-slate-500">
          Project scaffold ready. Run <code className="text-cyan-400">npm run dev</code> to start.
        </p>
      </div>
    </div>
  )
}

export default App
