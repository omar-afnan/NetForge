import { useMemo, useState } from 'react'
import { Monitor, Router, Server, HardDrive, Wifi, WifiOff, MapPin, Cable } from 'lucide-react'
import { useNetworkStore } from '@/store/networkStore'
import { getDeviceById, getPrimaryInterface } from '@/network/devices'
import { maskToPrefix } from '@/network/ip'
import type { Device, NetworkLink } from '@/network/types'

const typeIcons: Record<string, React.FC<{ className?: string }>> = {
  pc: Monitor,
  router: Router,
  server: Server,
  switch: HardDrive,
}

const typeLabels: Record<string, string> = {
  pc: 'Personal Computer',
  router: 'Router',
  server: 'Server',
  switch: 'Switch',
}

export function InspectorPanel() {
  const selectedDeviceId = useNetworkStore((s) => s.selectedDeviceId)
  const selectedLinkId = useNetworkStore((s) => s.selectedLinkId)
  const devices = useNetworkStore((s) => s.devices)
  const links = useNetworkStore((s) => s.links)
  const simulator = useNetworkStore((s) => s.simulator)

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['general', 'network']))

  const device = useMemo(() => {
    if (!selectedDeviceId) return null
    return getDeviceById(devices, selectedDeviceId)
  }, [selectedDeviceId, devices])

  const link = useMemo(() => {
    if (!selectedLinkId) return null
    return links.find((l) => l.id === selectedLinkId) ?? null
  }, [selectedLinkId, links])

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  if (!device && !link) {
    return (
      <div className="inspector-panel">
        <div className="inspector-empty">
          <div className="inspector-empty-icon">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="inspector-empty-title">Nothing selected</div>
          <div className="inspector-empty-detail">
            Select a device or connection on the network canvas to inspect its properties.
          </div>
        </div>
      </div>
    )
  }

  if (link) {
    return <LinkInspectorContent link={link} devices={devices} />
  }

  if (!device) {
    return (
      <div className="inspector-panel">
        <div className="inspector-empty">
          <div className="inspector-empty-icon">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="inspector-empty-title">Nothing selected</div>
          <div className="inspector-empty-detail">
            Select a device or connection on the network canvas to inspect its properties.
          </div>
        </div>
      </div>
    )
  }

  const Icon = typeIcons[device.type] ?? Monitor
  const primaryIface = getPrimaryInterface(device)
  const routes = simulator.getRoutingTable(device.hostname)
  const arp = simulator.getARPTable(device.hostname)

  return (
    <div className="inspector-panel">
      <div className="inspector-header">
        <div className="inspector-header-icon">
          <Icon className="h-4 w-4" />
        </div>
        <div className="inspector-header-info">
          <div className="inspector-header-name">{device.hostname}</div>
          <div className="inspector-header-type">{typeLabels[device.type] ?? device.type}</div>
        </div>
        <div className={`inspector-status-dot ${device.status === 'healthy' ? 'status-up' : 'status-down'}`} />
      </div>

      <div className="inspector-sections">
        <Section title="General" expanded={expandedSections.has('general')} onToggle={() => toggleSection('general')}>
          <Row label="Name" value={device.hostname} />
          <Row label="Type" value={typeLabels[device.type] ?? device.type} />
          <Row label="Status" value={device.status === 'healthy' ? 'Healthy' : device.status === 'degraded' ? 'Degraded' : 'Failed'} />
          {device.role && <Row label="Role" value={device.role} />}
        </Section>

        <Section title="Network" expanded={expandedSections.has('network')} onToggle={() => toggleSection('network')}>
          {primaryIface && (
            <>
              <Row label="IPv4" value={primaryIface.ipAddress ?? 'n/a'} mono />
              <Row label="Subnet Mask" value={primaryIface.subnetMask ?? 'n/a'} mono />
              <Row label="Prefix" value={primaryIface.subnetMask ? `/${maskToPrefix(primaryIface.subnetMask)}` : 'n/a'} />
            </>
          )}
          <Row label="Gateway" value={device.defaultGateway ?? 'n/a'} mono />
        </Section>

        <Section title="Interfaces" expanded={expandedSections.has('interfaces')} onToggle={() => toggleSection('interfaces')}>
          {device.interfaces.length === 0 && (
            <div className="inspector-empty-text">No interfaces configured.</div>
          )}
          {device.interfaces.map((iface) => (
            <div key={iface.id} className="inspector-interface">
              <div className="inspector-interface-header">
                <span className="inspector-interface-name">{iface.name}</span>
                <span className={`inspector-interface-status ${iface.status === 'up' ? 'status-up' : 'status-down'}`}>
                  {iface.status === 'up' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                </span>
              </div>
              <div className="inspector-interface-details">
                <Row label="IP" value={iface.ipAddress ?? 'n/a'} mono />
                <Row label="Mask" value={iface.subnetMask ?? 'n/a'} mono />
                <Row label="Status" value={iface.status === 'up' ? 'Up' : 'Down'} />
              </div>
            </div>
          ))}
        </Section>

        {routes.length > 0 && (
          <Section title="Routing Table" expanded={expandedSections.has('routes')} onToggle={() => toggleSection('routes')}>
            {routes.map((route, i) => (
              <div key={`${route.destination}-${i}`} className="inspector-route">
                <span className="inspector-route-dest">{route.destination}/{maskToPrefix(route.mask)}</span>
                <span className="inspector-route-via">
                  {route.nextHop ? `via ${route.nextHop}` : route.interfaceName}
                </span>
              </div>
            ))}
          </Section>
        )}

        {arp.length > 0 && (
          <Section title="ARP Table" expanded={expandedSections.has('arp')} onToggle={() => toggleSection('arp')}>
            {arp.map((entry, i) => (
              <div key={`${entry.ipAddress}-${entry.macAddress}-${i}`} className="inspector-arp">
                <span className="inspector-arp-ip">{entry.ipAddress}</span>
                <span className="inspector-arp-mac">{entry.macAddress}</span>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="inspector-section">
      <button type="button" className="inspector-section-header" onClick={onToggle}>
        <span className="inspector-section-title">{title}</span>
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && <div className="inspector-section-body">{children}</div>}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="inspector-row">
      <span className="inspector-row-label">{label}</span>
      <span className={`inspector-row-value${mono ? ' font-data' : ''}`}>{value}</span>
    </div>
  )
}

function LinkInspectorContent({
  link,
  devices,
}: {
  link: NetworkLink
  devices: Device[]
}) {
  const source = devices.find((d) => d.id === link.sourceDeviceId)
  const target = devices.find((d) => d.id === link.targetDeviceId)

  return (
    <div className="inspector-panel">
      <div className="inspector-header">
        <div className="inspector-header-icon">
          <Cable className="h-4 w-4" strokeWidth={1.5} />
        </div>
        <div className="inspector-header-info">
          <div className="inspector-header-name">Connection</div>
          <div className="inspector-header-type">{link.kind ?? 'cable'}</div>
        </div>
        <div className={`inspector-status-dot ${link.status === 'up' ? 'status-up' : 'status-down'}`} />
      </div>

      <div className="inspector-sections">
        <Section title="General" expanded={true} onToggle={() => {}}>
          <Row label="Source" value={source?.hostname ?? 'unknown'} />
          <Row label="Target" value={target?.hostname ?? 'unknown'} />
          <Row label="Cable" value={link.kind ?? 'unknown'} />
          <Row label="Status" value={link.status === 'up' ? 'Connected' : 'Disconnected'} />
        </Section>
      </div>
    </div>
  )
}
