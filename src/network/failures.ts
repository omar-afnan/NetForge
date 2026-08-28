export type FailureType =
  | 'wrong_ip'
  | 'wrong_subnet'
  | 'wrong_gateway'
  | 'missing_route'
  | 'wrong_next_hop'
  | 'interface_down'
  | 'link_failure'
  | 'arp_problem'
  | 'routing_misconfig'

export interface FailureInjection {
  type: FailureType
  deviceId: string
  details: Record<string, unknown>
}
