import { maskToPrefix } from '@/network/ip'
import { getDeviceById } from '@/network/devices'
import { useNetworkStore } from '@/store/networkStore'
import { useSettingsStore } from '@/store/settingsStore'
import { LinkInspector } from '@/components/topology/LinkInspector'
import { Monitor } from 'lucide-react'

const typeIcons: Record<string, string> = {
  pc: '/access-network-32.png',
  switch: '/switch-255-32.png',
  router: '/router-70-32.png',
  server: '/the-server-62-32.png',
}

export function DeviceInspector() {
  const selectedDeviceId = useNetworkStore((s) => s.selectedDeviceId)
  const selectedLinkId = useNetworkStore((s) => s.selectedLinkId)
  const devices = useNetworkStore((s) => s.devices)
  const simulator = useNetworkStore((s) => s.simulator)
  const compactTables = useSettingsStore((s) => s.compactTables)

  if (selectedLinkId) {
    return <LinkInspector />
  }

  const device = selectedDeviceId ? getDeviceById(devices, selectedDeviceId) : null

  if (!device) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center border border-[var(--border)] bg-[var(--bg-elevated)]">
          <Monitor className="h-5 w-5 text-[var(--text-dim)]" strokeWidth={1.5} />
        </div>
        <p className="text-[11px] text-[var(--text-dim)]">
          Select a device to inspect interfaces, routes, and ARP.
        </p>
      </div>
    )
  }

  const routes = simulator.getRoutingTable(device.hostname)
  const arp = simulator.getARPTable(device.hostname)
  const iconPath = typeIcons[device.type] ?? '/access-network-32.png'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--bg-elevated)] p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center border border-[var(--border-bright)] bg-[var(--bg-panel)]">
            <img src={iconPath} alt={device.type} className="h-6 w-6 object-contain" />
          </div>
          <div>
            <div className="font-data text-sm font-semibold">{device.hostname}</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
              {device.type}
              {device.role ? ` / ${device.role}` : ''}
            </div>
          </div>
        </div>
        {device.defaultGateway && (
          <div className="mt-2 font-data text-[10px] text-[var(--text-secondary)]">
            GW {device.defaultGateway}
          </div>
        )}
      </div>

      <div className={`flex-1 overflow-auto ${compactTables ? 'table-compact' : ''}`}>
        <section className="border-b border-[var(--border)]">
          <div className="panel-header">Interfaces</div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-[var(--bg-inset)] text-[var(--text-dim)]">
                <th className="px-2 py-1 text-left font-medium">Name</th>
                <th className="px-2 py-1 text-left font-medium">IP</th>
                <th className="px-2 py-1 text-left font-medium">State</th>
              </tr>
            </thead>
            <tbody className="font-data">
              {device.interfaces.map((iface) => (
                <tr key={iface.id} className="border-t border-[var(--border)]">
                  <td className="px-2 py-1">{iface.name}</td>
                  <td className="px-2 py-1">{iface.ipAddress ?? 'n/a'}</td>
                  <td className={`px-2 py-1 ${iface.status === 'up' ? 'status-up' : 'status-down'}`}>
                    {iface.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {routes.length > 0 && (
          <section className="border-b border-[var(--border)]">
            <div className="panel-header">Routing Table</div>
            <table className="w-full text-[10px]">
              <tbody className="font-data">
                {routes.map((route, i) => (
                  <tr key={`${route.destination}-${i}`} className="border-t border-[var(--border)]">
                    <td className="px-2 py-1">
                      {route.destination}/{maskToPrefix(route.mask)}
                    </td>
                    <td className="px-2 py-1 text-[var(--text-secondary)]">
                      {route.nextHop ? `via ${route.nextHop}` : route.interfaceName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {arp.length > 0 && (
          <section>
            <div className="panel-header">ARP</div>
            <table className="w-full text-[10px]">
              <tbody className="font-data">
                {arp.map((entry) => (
                  <tr key={`${entry.ipAddress}-${entry.macAddress}`} className="border-t border-[var(--border)]">
                    <td className="px-2 py-1">{entry.ipAddress}</td>
                    <td className="px-2 py-1 text-[var(--text-secondary)]">{entry.macAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  )
}
