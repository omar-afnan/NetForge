import type { NetworkSimulator } from './simulator'
import type { TraceHop } from './types'

export function traceRoute(
  simulator: NetworkSimulator,
  source: string,
  destination: string,
): TraceHop[] {
  return simulator.traceRoute(source, destination)
}
