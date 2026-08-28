import type { DiagnosticResult } from './types'

export function checkConnectivity(source: string, destination: string): DiagnosticResult {
  return {
    success: false,
    source,
    destination,
    hops: [],
    failureReason: 'Diagnostics not yet implemented',
  }
}
