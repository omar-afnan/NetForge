import type { TraceHop } from './types'

export function traceRoute(source: string, destination: string): TraceHop[] {
  return [
    {
      hop: 1,
      device: source,
      status: 'failed',
      failureReason: `Traceroute to ${destination} not yet implemented`,
    },
  ]
}
