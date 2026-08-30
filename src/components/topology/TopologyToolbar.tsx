import { Cable, MousePointer2, RotateCcw, Trash2 } from 'lucide-react'
import type { DeviceType } from '@/network/types'
import { CABLE_KINDS, cableMeta } from '@/network/cables'
import { useNetworkStore } from '@/store/networkStore'
import { useUIStore } from '@/store/uiStore'

const TOOLS: { tool: 'select' | 'wire' | 'delete'; label: string; icon: typeof Cable }[] = [
  { tool: 'select', label: 'Select', icon: MousePointer2 },
  { tool: 'wire', label: 'Wire', icon: Cable },
  { tool: 'delete', label: 'Delete', icon: Trash2 },
]

const DEVICE_TYPES: { type: DeviceType; label: string; icon: string }[] = [
  { type: 'pc', label: 'PC', icon: '/access-network-32.png' },
  { type: 'switch', label: 'Switch', icon: '/switch-255-32.png' },
  { type: 'router', label: 'Router', icon: '/router-70-32.png' },
  { type: 'server', label: 'Server', icon: '/the-server-62-32.png' },
]

const TOOL_HINTS: Record<string, string> = {
  select: 'Drag devices to move them · click a device or cable to inspect · Del removes',
  wire: 'Click the first device, then the second — pick a cable type below',
  delete: 'Click any device or cable to remove it',
  place: 'Click on the canvas to place the selected device',
}

export function TopologyToolbar() {
  const topologyTool = useUIStore((s) => s.topologyTool)
  const setTopologyTool = useUIStore((s) => s.setTopologyTool)
  const pendingDeviceType = useUIStore((s) => s.pendingDeviceType)
  const setPendingDeviceType = useUIStore((s) => s.setPendingDeviceType)
  const wireKind = useUIStore((s) => s.wireKind)
  const setWireKind = useUIStore((s) => s.setWireKind)
  const topologyNotice = useUIStore((s) => s.topologyNotice)
  const setTopologyNotice = useUIStore((s) => s.setTopologyNotice)
  const loadLab = useNetworkStore((s) => s.loadLab)

  function toolButtonClass(active: boolean) {
    return `flex items-center gap-1.5 border px-2 py-1 font-data text-[10px] transition-colors ${
      active
        ? 'border-[var(--accent-link)] bg-[rgba(46,200,240,0.12)] text-[var(--accent-link)]'
        : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-bright)] hover:text-[var(--text-primary)]'
    }`
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2">
      <div className="flex items-center gap-1">
        {TOOLS.map(({ tool, label, icon: Icon }) => (
          <button
            key={tool}
            type="button"
            className={toolButtonClass(topologyTool === tool)}
            onClick={() => {
              setTopologyTool(tool)
              setTopologyNotice(null)
            }}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-[var(--border)]" />

      <div className="flex items-center gap-1">
        <span className="mr-1 text-[9px] uppercase tracking-wider text-[var(--text-dim)]">Add:</span>
        {DEVICE_TYPES.map(({ type, label, icon }) => (
          <button
            key={type}
            className={toolButtonClass(topologyTool === 'place' && pendingDeviceType === type)}
            onClick={() => {
              setPendingDeviceType(type)
              setTopologyTool('place')
            }}
          >
            <img src={icon} alt={label} className="h-5 w-5 object-contain" />
            {label}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-[var(--border)]" />

      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-[9px] uppercase tracking-wider text-[var(--text-dim)]">Cable:</span>
        {CABLE_KINDS.map((kind) => {
          const meta = cableMeta(kind)
          const active = wireKind === kind
          return (
            <button
              key={kind}
              title={`${meta.label} · ${meta.bandwidthMbps >= 1000 ? `${meta.bandwidthMbps / 1000} Gbps` : `${meta.bandwidthMbps} Mbps`}`}
              className={`flex items-center gap-1.5 border px-1.5 py-1 font-data text-[10px] transition-colors ${
                active
                  ? 'border-[var(--border-bright)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-secondary)]'
              }`}
              onClick={() => setWireKind(kind)}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: meta.color,
                  boxShadow: active ? `0 0 0 2px var(--bg-panel), 0 0 0 3.5px ${meta.color}` : undefined,
                }}
              />
              {meta.label}
            </button>
          )
        })}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {topologyNotice ? (
          <span className="font-data text-[10px] text-[var(--accent-link)]">{topologyNotice}</span>
        ) : (
          <span className="font-data text-[10px] text-[var(--text-dim)]">
            {TOOL_HINTS[topologyTool === 'place' ? 'place' : topologyTool]}
          </span>
        )}
        <button
          className="flex items-center gap-1.5 border border-[var(--border)] px-2 py-1 font-data text-[10px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-bright)] hover:text-[var(--text-primary)]"
          onClick={() => {
            loadLab(useNetworkStore.getState().lab)
            setTopologyTool('select')
            setTopologyNotice('Lab reset to baseline')
          }}
        >
          <RotateCcw className="h-3 w-3" />
          Reset Lab
        </button>
      </div>
    </div>
  )
}