import { useNetworkStore } from '@/store/networkStore'
import { getPrimaryInterface } from '@/network/devices'

export function DeviceTable() {
  const devices = useNetworkStore((s) => s.devices)
  const selectedDeviceId = useNetworkStore((s) => s.selectedDeviceId)
  const selectDevice = useNetworkStore((s) => s.selectDevice)

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-inset)] text-[var(--text-dim)]">
            <th className="px-3 py-2 font-medium">Hostname</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Address</th>
            <th className="px-3 py-2 font-medium">Gateway</th>
            <th className="px-3 py-2 font-medium">State</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => {
            const primary = getPrimaryInterface(device)
            const selected = device.id === selectedDeviceId
            return (
              <tr
                key={device.id}
                onClick={() => selectDevice(device.id)}
                className={`cursor-pointer border-b border-[var(--border)] font-data transition-colors ${
                  selected
                    ? 'bg-[var(--accent-link-dim)]'
                    : 'hover:bg-[var(--bg-elevated)]'
                }`}
              >
                <td className="px-3 py-2 font-semibold text-[var(--text-primary)]">{device.hostname}</td>
                <td className="px-3 py-2 uppercase text-[var(--text-secondary)]">{device.type}</td>
                <td className="px-3 py-2">{primary?.ipAddress ?? 'n/a'}</td>
                <td className="px-3 py-2">{device.defaultGateway ?? 'n/a'}</td>
                <td className={`px-3 py-2 ${device.status === 'healthy' ? 'status-up' : 'status-down'}`}>
                  {device.status.toUpperCase()}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
