export type DeviceType = 'pc' | 'switch' | 'router' | 'server'

export interface NetworkInterface {
  id: string
  name: string
  ipAddress?: string
  subnetMask?: string
  macAddress: string
  status: 'up' | 'down'
  connectedLinkId?: string
}

export interface Device {
  id: string
  hostname: string
  type: DeviceType
  interfaces: NetworkInterface[]
  defaultGateway?: string
  status: 'healthy' | 'degraded' | 'failed'
}

export interface NetworkLink {
  id: string
  sourceDeviceId: string
  sourceInterfaceId: string
  targetDeviceId: string
  targetInterfaceId: string
  status: 'up' | 'down'
}

export interface Route {
  destination: string
  mask: string
  nextHop?: string
  interfaceId: string
  type: 'connected' | 'static'
  status: 'active' | 'inactive'
}

export interface ARPEntry {
  ipAddress: string
  macAddress: string
  interfaceId: string
  age: number
}

export interface Packet {
  id: string
  source: string
  destination: string
  protocol: string
  path: string[]
  status: 'success' | 'failed'
  failureReason?: string
}

export interface PingResult {
  success: boolean
  source: string
  destination: string
  latencyMs?: number
  packetLoss: number
  hops: string[]
  failureReason?: string
}

export interface TraceHop {
  hop: number
  device: string
  status: 'forwarded' | 'failed'
  failureReason?: string
}

export interface NetworkIssue {
  id: string
  severity: 'critical' | 'warning' | 'info'
  deviceId: string
  description: string
  detectedBy: string
  evidence: string
  status: 'open' | 'investigating' | 'fix_proposed' | 'awaiting_approval' | 'resolved'
}

export interface DiagnosticResult {
  success: boolean
  source: string
  destination: string
  hops: TraceHop[]
  failureReason?: string
}

export interface ProposedFix {
  id: string
  deviceId: string
  description: string
  change: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'applied'
}

export interface AgentAction {
  id: string
  timestamp: string
  message: string
  type: 'info' | 'success' | 'warning' | 'action' | 'human'
}
