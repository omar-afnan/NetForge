import { CABLE_KINDS, cableMeta, formatBandwidth } from '@/network/cables'
import { useNetworkStore } from '@/store/networkStore'

export function LinkInspector() {
  const links = useNetworkStore((s) => s.links)
  const devices = useNetworkStore((s) => s.devices)
  const selectedLinkId = useNetworkStore((s) => s.selectedLinkId)
  const selectLink = useNetworkStore((s) => s.selectLink)
  const setLinkStatus = useNetworkStore((s) => s.setLinkStatus)
  const setLinkKind = useNetworkStore((s) => s.setLinkKind)
  const removeLink = useNetworkStore((s) => s.removeLink)

  const link = links.find((entry) => entry.id === selectedLinkId)
  if (!link) return null

  const source = devices.find((device) => device.id === link.sourceDeviceId)
  const target = devices.find((device) => device.id === link.targetDeviceId)
  const sourceIface = source?.interfaces.find((iface) => iface.id === link.sourceInterfaceId)
  const targetIface = target?.interfaces.find((iface) => iface.id === link.targetInterfaceId)
  const up = link.status === 'up'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--bg-elevated)] p-3">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Cable</div>
        <div className="mt-1 font-data text-[11px] text-[var(--text-primary)]">
          {source?.hostname ?? '?'}/{sourceIface?.name ?? '?'} ↔{' '}
          {target?.hostname ?? '?'}/{targetIface?.name ?? '?'}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className={`font-data text-[10px] ${up ? 'status-up' : 'status-down'}`}>
            {up ? 'LINK UP' : 'LINK DOWN'}
          </span>
          <button
            className="border border-[var(--border)] px-2 py-0.5 font-data text-[10px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-bright)] hover:text-[var(--text-primary)]"
            onClick={() => setLinkStatus(link.id, up ? 'down' : 'up')}
          >
            {up ? 'Set Down' : 'Set Up'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <section className="border-b border-[var(--border)]">
          <div className="panel-header">Cable Type</div>
          <div className="grid grid-cols-2 gap-1 p-2">
            {CABLE_KINDS.map((kind) => {
              const kindMeta = cableMeta(kind)
              const active = (link.kind ?? 'copper') === kind
              return (
                <button
                  key={kind}
                  className={`flex items-center gap-2 border px-2 py-1.5 text-left font-data text-[10px] transition-colors ${
                    active
                      ? 'border-[var(--border-bright)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => setLinkKind(link.id, kind)}
                >
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: kindMeta.color }}
                  />
                  <span>
                    {kindMeta.label}
                    <span className="block text-[9px] text-[var(--text-dim)]">
                      {formatBandwidth(kindMeta.bandwidthMbps)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="p-2">
          <button
            className="w-full border border-[var(--border)] px-2 py-1.5 font-data text-[10px] text-[var(--status-down)] transition-colors hover:border-[var(--status-down)]"
            onClick={() => removeLink(link.id)}
          >
            Remove Cable
          </button>
          <button
            className="mt-2 w-full border border-[var(--border)] px-2 py-1.5 font-data text-[10px] text-[var(--text-dim)] transition-colors hover:text-[var(--text-secondary)]"
            onClick={() => selectLink(null)}
          >
            Close
          </button>
        </section>
      </div>
    </div>
  )
}