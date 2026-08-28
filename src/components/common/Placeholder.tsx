export function Placeholder({ label }: { label: string }) {
  return (
    <div className="rounded border border-slate-700/50 bg-slate-900/40 p-4 text-sm text-slate-400">
      {label} (coming soon)
    </div>
  )
}
