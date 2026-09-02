import type { Device, NetworkInterface, NetworkLink } from '@/network/types'
import type { FailureInjection } from '@/network/failures'

export interface LabDefinition {
  id: string
  title: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  description: string
  issueCount: number
  devices: Device[]
  links: NetworkLink[]
  /** Faults applied on top of the baseline topology when the lab loads. */
  failures?: FailureInjection[]
}

function iface(
  id: string,
  name: string,
  mac: string,
  ip?: string,
  mask?: string,
  status: NetworkInterface['status'] = 'up',
): NetworkInterface {
  return { id, name, macAddress: mac, ipAddress: ip, subnetMask: mask, status }
}

function pc(
  id: string,
  hostname: string,
  ip: string,
  gateway: string,
  position: { x: number; y: number },
): Device {
  return {
    id,
    hostname,
    type: 'pc',
    status: 'healthy',
    defaultGateway: gateway,
    position,
    interfaces: [iface(`${id}-eth0`, 'Eth0', `00:1A:2B:3C:4D:${id.slice(-2)}`, ip, '255.255.255.0')],
  }
}

function server(
  id: string,
  hostname: string,
  ip: string,
  gateway: string,
  role: string,
  position: { x: number; y: number },
): Device {
  return {
    id,
    hostname,
    type: 'server',
    role,
    status: 'healthy',
    defaultGateway: gateway,
    position,
    interfaces: [iface(`${id}-eth0`, 'Eth0', `00:AA:BB:CC:DD:${id.slice(-2)}`, ip, '255.255.255.0')],
  }
}

function switchDevice(
  id: string,
  hostname: string,
  mgmtIp: string,
  position: { x: number; y: number },
  portCount = 4,
): Device {
  const interfaces: NetworkInterface[] = [
    iface(`${id}-mgmt`, 'Mgmt0', `00:11:22:33:44:${id.slice(-2)}`, mgmtIp, '255.255.255.0'),
  ]
  for (let i = 1; i <= portCount; i += 1) {
    interfaces.push(iface(`${id}-fa${i}`, `Fa0/${i}`, `00:11:22:33:${i.toString().padStart(2, '0')}:${id.slice(-2)}`))
  }
  interfaces.push(iface(`${id}-gi1`, 'Gi0/1', `00:11:22:44:00:${id.slice(-2)}`))
  return { id, hostname, type: 'switch', status: 'healthy', position, interfaces }
}

function router(
  id: string,
  hostname: string,
  interfaces: NetworkInterface[],
  staticRoutes: Device['staticRoutes'],
  position: { x: number; y: number },
): Device {
  return { id, hostname, type: 'router', status: 'healthy', interfaces, staticRoutes, position }
}

function link(
  id: string,
  a: { deviceId: string; ifaceId: string },
  b: { deviceId: string; ifaceId: string },
  status: NetworkLink['status'] = 'up',
): NetworkLink {
  return {
    id,
    sourceDeviceId: a.deviceId,
    sourceInterfaceId: a.ifaceId,
    targetDeviceId: b.deviceId,
    targetInterfaceId: b.ifaceId,
    status,
  }
}

/** Fresh, unmutated baseline topology - callers clone from this. */
export function buildStarterTopology(): { devices: Device[]; links: NetworkLink[] } {
  return {
    devices: [
      pc('pc-01', 'PC-01', '10.1.10.10', '10.1.10.1', { x: 40, y: 60 }),
      pc('pc-02', 'PC-02', '10.1.10.11', '10.1.10.1', { x: 40, y: 160 }),
      pc('pc-03', 'PC-03', '10.1.10.12', '10.1.10.1', { x: 40, y: 260 }),
      switchDevice('sw-01', 'SW-01', '10.1.1.2', { x: 200, y: 160 }, 3),
      switchDevice('sw-02', 'SW-02', '10.1.1.3', { x: 400, y: 320 }, 4),
      switchDevice('sw-03', 'SW-03', '10.1.1.4', { x: 900, y: 160 }, 4),
      router(
        'r-01',
        'R-01',
        [
          iface('r-01-gi0', 'Gi0/0', '00:DE:AD:01:00:01', '10.1.10.1', '255.255.255.0'),
          iface('r-01-gi1', 'Gi0/1', '00:DE:AD:01:00:02', '10.1.0.1', '255.255.255.252'),
        ],
        [{ destination: '10.1.20.0', mask: '255.255.255.0', nextHop: '10.1.0.2', interfaceId: 'r-01-gi1' }],
        { x: 380, y: 160 },
      ),
      router(
        'r-02',
        'R-02',
        [
          iface('r-02-gi0', 'Gi0/0', '00:DE:AD:02:00:01', '10.1.0.2', '255.255.255.252'),
          iface('r-02-gi1', 'Gi0/1', '00:DE:AD:02:00:02', '10.1.0.5', '255.255.255.252'),
        ],
        [
          { destination: '10.1.10.0', mask: '255.255.255.0', nextHop: '10.1.0.1', interfaceId: 'r-02-gi0' },
          { destination: '10.1.20.0', mask: '255.255.255.0', nextHop: '10.1.0.6', interfaceId: 'r-02-gi1' },
        ],
        { x: 560, y: 160 },
      ),
      router(
        'r-03',
        'R-03',
        [
          iface('r-03-gi0', 'Gi0/0', '00:DE:AD:03:00:01', '10.1.0.6', '255.255.255.252'),
          iface('r-03-gi1', 'Gi0/1', '00:DE:AD:03:00:02', '10.1.20.1', '255.255.255.0'),
        ],
        [{ destination: '10.1.10.0', mask: '255.255.255.0', nextHop: '10.1.0.5', interfaceId: 'r-03-gi0' }],
        { x: 740, y: 160 },
      ),
      server('srv-01', 'SRV-01', '10.1.20.10', '10.1.20.1', 'Web Server', { x: 1100, y: 40 }),
      server('srv-02', 'SRV-02', '10.1.20.11', '10.1.20.1', 'Application Server', { x: 1100, y: 130 }),
      server('srv-03', 'SRV-03', '10.1.20.12', '10.1.20.1', 'Database Server', { x: 1100, y: 220 }),
      server('srv-04', 'SRV-04', '10.1.20.13', '10.1.20.1', 'File Server', { x: 1100, y: 310 }),
    ],
    links: [
      link('l1', { deviceId: 'pc-01', ifaceId: 'pc-01-eth0' }, { deviceId: 'sw-01', ifaceId: 'sw-01-fa1' }),
      link('l2', { deviceId: 'pc-02', ifaceId: 'pc-02-eth0' }, { deviceId: 'sw-01', ifaceId: 'sw-01-fa2' }),
      link('l3', { deviceId: 'pc-03', ifaceId: 'pc-03-eth0' }, { deviceId: 'sw-01', ifaceId: 'sw-01-fa3' }),
      link('l4', { deviceId: 'sw-01', ifaceId: 'sw-01-gi1' }, { deviceId: 'r-01', ifaceId: 'r-01-gi0' }),
      link('l5', { deviceId: 'r-01', ifaceId: 'r-01-gi1' }, { deviceId: 'r-02', ifaceId: 'r-02-gi0' }),
      link('l6', { deviceId: 'r-02', ifaceId: 'r-02-gi1' }, { deviceId: 'r-03', ifaceId: 'r-03-gi0' }),
      link('l7', { deviceId: 'r-03', ifaceId: 'r-03-gi1' }, { deviceId: 'sw-03', ifaceId: 'sw-03-gi1' }),
      link('l8', { deviceId: 'srv-01', ifaceId: 'srv-01-eth0' }, { deviceId: 'sw-03', ifaceId: 'sw-03-fa1' }),
      link('l9', { deviceId: 'srv-02', ifaceId: 'srv-02-eth0' }, { deviceId: 'sw-03', ifaceId: 'sw-03-fa2' }),
      link('l10', { deviceId: 'srv-03', ifaceId: 'srv-03-eth0' }, { deviceId: 'sw-03', ifaceId: 'sw-03-fa3' }),
      link('l11', { deviceId: 'srv-04', ifaceId: 'srv-04-eth0' }, { deviceId: 'sw-03', ifaceId: 'sw-03-fa4' }),
    ],
  }
}

export const starterLab: LabDefinition = {
  id: 'starter',
  title: 'Competition Lab',
  difficulty: 'beginner',
  description: 'Baseline enterprise topology with PCs, switches, routers, and servers.',
  issueCount: 0,
  ...buildStarterTopology(),
}

/** Empty workspace shown to brand-new users until they build a topology or load a lab. */
export const blankLab: LabDefinition = {
  id: 'blank',
  title: 'Untitled Lab',
  difficulty: 'beginner',
  description: 'Empty workspace — add devices or load a lab from the Lab Library.',
  issueCount: 0,
  devices: [],
  links: [],
}
