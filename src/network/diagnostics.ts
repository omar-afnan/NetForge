import type { NetworkSimulator } from './simulator'
import type { DiagnosticResult } from './types'

export function checkConnectivity(
  simulator: NetworkSimulator,
  source: string,
  destination: string,
): DiagnosticResult {
  return simulator.checkConnectivity(source, destination)
}
