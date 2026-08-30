import { useMemo, useState } from 'react'
import { ChevronRight, Radio, Trash2 } from 'lucide-react'
import { useNetworkStore } from '@/store/networkStore'
import { useUIStore } from '@/store/uiStore'
import type { Device, Packet } from '@/network/types'

type StatusFilter = 'all' | 'success' | 'failed'

/** Resolve a packet's source/destination against a device (hostname or any IP). */
function matchesDevice(packet: Packet, device: Device): boolean {
  const ids = new Set([
    device.hostname.toLowerCase(),
    ...device.interfaces.flatMap((iface) => (iface.ipAddress ? [iface.ipAddress] : [])),
  ])
  return (
    ids.has(packet.source.toLowerCase()) ||
    ids.has(packet.destination.toLowerCase()) ||
    packet.path.some((hop) => ids.has(hop.toLowerCase()))
  )
}

function formatTime(timestamp: string | undefined): string {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function TrafficMonitor() {
  const packets = useNetworkStore((s) => s.packets)
  const devices = useNetworkStore((s) => s.devices)
  const setPacketTrace = useNetworkStore((s) => s.setPacketTrace)
  const clearPackets = useNetworkStore((s) => s.clearPackets)
  const setActiveView = useUIStore((s) => s.setActiveView)

  const [deviceFilter, setDeviceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [cleared, setCleared] = useState(false)

  const successCount = useMemo(() => packets.filter((p) => p.status === 'success').length, [packets])
  const total = packets.length
  const successRate = total ? Math.round((successCount / total) * 100) : 0
  // Failures across the most recent 25 logged packets.
  const failuresRecent = useMemo(() => packets.slice(0, 25).filter((p) => p.status === 'failed').length, [packets])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return packets.filter((packet) => {
      if (deviceFilter) {
        const device = devices.find((d) => d.id === deviceFilter)
        if (device && !matchesDevice(packet, device)) return false
      }
      if (statusFilter !== 'all' && packet.status !== statusFilter) return false
      if (query) {
        const haystack = `${packet.source} ${packet.destination} ${packet.protocol} ${packet.failureReason ?? ''} ${packet.path.join(' ')}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [packets, deviceFilter, statusFilter, search, devices])

  const replay = (packet: Packet) => {
    setPacketTrace({ id: packet.id, path: packet.path, success: packet.status === 'success' })
    setActiveView('topology')
  }

  const togglePath = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  const handleClear = () => {
    clearPackets()
    setCleared(true)
    window.setTimeout(() => setCleared(false), 1200)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="panel-header flex items-center justify-between">
        <span>Traffic Monitor</span>
        <button
          type="button"
          className="flex items-center gap-1.5 border border-[var(--border)] px-2 py-0.5 font-data text-[10px] font-normal normal-case tracking-normal text-[var(--text-secondary)] transition-colors hover:border-[var(--status-down)] hover:text-[var(--status-down)]"
          onClick={handleClear}
          disabled={packets.length === 0}
        >
          <Trash2 className="h-3 w-3" />
          {cleared ? 'Cleared' : 'Clear log'}
        </button>
      </div>

      {/* Header stats */}
      <div className="grid grid-cols-3 gap-2 border-b border-[var(--border)] bg-[var(--bg-elevated)] p-3">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">Packets</div>
          <div className="mt-0.5 font-data text-lg leading-none text-[var(--text-primary)]">{total}</div>
        </div>
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">Success rate</div>
          <div className={`mt-0.5 font-data text-lg leading-none ${total ? (successRate === 100 ? 'status-up' : 'status-warn') : 'text-[var(--text-dim)]'}`}>
            {total ? `${successRate}%` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">Recent failures</div>
          <div className={`mt-0.5 font-data text-lg leading-none ${failuresRecent ? 'status-down' : 'status-up'}`}>
            {failuresRecent}
          </div>
        </div>
      </div>
{/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-inset)] px-3 py-2">
        <select
          value={deviceFilter}
          onChange={(e) => setDeviceFilter(e.target.value)}
          className="border border-[var(--border)] bg-[var(--bg-panel)] px-2 py-1 font-data text-[10px] text-[var(--text-secondary)] outline-none focus:border-[var(--border-bright)]"
          aria-label="Filter by device"
        >
          <option value="">All devices</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.hostname}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="border border-[var(--border)] bg-[var(--bg-panel)] px-2 py-1 font-data text-[10px] text-[var(--text-secondary)] outline-none focus:border-[var(--border-bright)]"
          aria-label="Filter by status"
        >
          <option value="all">All status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="min-w-0 flex-1 border border-[var(--border)] bg-[var(--bg-panel)] px-2 py-1 font-data text-[10px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)] focus:border-[var(--border-bright)]"
          aria-label="Search traffic"
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center border border-[var(--border)] bg-[var(--bg-elevated)]">
              <Radio className="h-5 w-5 text-[var(--text-dim)]" strokeWidth={1.5} />
            </div>
            <p className="max-w-xs text-[11px] text-[var(--text-secondary)]">
              {packets.length === 0
                ? 'No traffic yet - run a ping or traceroute from the Terminal to see it here.'
                : 'No packets match the current filters.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-[10px]">
            <thead>
              <tr className="sticky top-0 bg-[var(--bg-inset)] text-left text-[var(--text-dim)]">
                <th className="px-2 py-1.5 font-medium">Time</th>
                <th className="px-2 py-1.5 font-medium">Path</th>
                <th className="px-2 py-1.5 font-medium">Protocol</th>
                <th className="px-2 py-1.5 font-medium">Status</th>
                <th className="px-2 py-1.5 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="font-data">
              {filtered.map((packet) => {
                const showPath = expanded[packet.id]
                return (
                  <tr
                    key={packet.id}
                    onClick={() => replay(packet)}
                    className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-[var(--bg-elevated)]"
                    title="Click to replay on the topology"
                  >
                    <td className="whitespace-nowrap px-2 py-1.5 text-[var(--text-dim)]">
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--accent-link)]"
                        onClick={(e) => {
                          e.stopPropagation()
                          togglePath(packet.id)
                        }}
                        title={packet.path.join(' → ')}
                      >
                        <ChevronRight className={`h-3 w-3 transition-transform ${showPath ? 'rotate-90' : ''}`} strokeWidth={1.75} />
                        {showPath ? `${packet.source} → ${packet.destination}` : formatTime(packet.timestamp)}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-[var(--text-secondary)]">
                      <span className="text-[var(--accent-link)]">{packet.source}</span>
                      <span className="mx-1 text-[var(--text-dim)]">→</span>
                      <span>{packet.destination}</span>
                    </td>
                    <td className="px-2 py-1.5 text-[var(--text-dim)]">{packet.protocol}</td>
                    <td className="px-2 py-1.5">
                      <span className={packet.status === 'success' ? 'status-up' : 'status-down'}>
                        {packet.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-[var(--text-dim)]">
                      {packet.status === 'failed' && packet.failureReason ? (
                        <span className="status-down">{packet.failureReason}</span>
                      ) : (
                        <span>
                          {packet.path.length} hop{packet.path.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}