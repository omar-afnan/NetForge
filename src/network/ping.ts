import type { NetworkSimulator } from './simulator'
import type { PingResult } from './types'

export function ping(simulator: NetworkSimulator, source: string, destination: string): PingResult {
  return simulator.ping(source, destination)
}
