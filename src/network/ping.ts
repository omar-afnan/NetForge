import type { PingResult } from './types'

export function ping(source: string, destination: string): PingResult {
  return {
    success: false,
    source,
    destination,
    packetLoss: 100,
    hops: [],
    failureReason: 'Simulator not yet implemented',
  }
}
