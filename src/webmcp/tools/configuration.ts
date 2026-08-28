import type { WebMCPToolResult } from '../types'
import type { ProposedFix } from '@/network/types'
import { useNetworkStore } from '@/store/networkStore'

export function proposeConfigurationChange(
  device: string,
  change: Record<string, unknown>,
): WebMCPToolResult<ProposedFix> {
  const fix: ProposedFix = {
    id: crypto.randomUUID(),
    deviceId: device,
    description: 'Proposed configuration change',
    change,
    status: 'pending',
  }

  useNetworkStore.setState((state) => ({
    proposedFixes: [...state.proposedFixes, fix],
  }))

  return { success: true, data: fix }
}

export function applyConfigurationChange(fixId: string): WebMCPToolResult {
  const { proposedFixes } = useNetworkStore.getState()
  const fix = proposedFixes.find((item) => item.id === fixId)

  if (!fix) {
    return { success: false, error: `Fix ${fixId} not found` }
  }

  if (fix.status !== 'approved' && fix.status !== 'pending') {
    return { success: false, error: `Fix ${fixId} cannot be applied in status ${fix.status}` }
  }

  return { success: true, data: { applied: fixId } }
}

export function verifyFix(source: string, destination: string): WebMCPToolResult {
  const { simulator } = useNetworkStore.getState()
  return { success: true, data: simulator.ping(source, destination) }
}
